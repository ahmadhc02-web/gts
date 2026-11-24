import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { overlayMotion, dialogMotion } from '../lib/motionPresets';
import {
  ArrowLeft,
  Activity,
  Plus,
  Server,
  Trash2,
  Edit2,
  RefreshCw,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Search,
  X,
  AlertTriangle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  Layers,
  Wifi,
  Laptop
} from 'lucide-react';
import { SkServerCardRow, SkBar } from './skeleton/Skeleton';
import { useSkeletonGate } from './skeleton/useSkeletonGate';
import { DeferredBody } from './ui/DeferredBody';
import { LazySection } from './ui/LazySection';
import { usePopupTiming } from '../lib/usePopupTiming';
import { cn } from '../lib/utils';
import { UserProfile, MonitorTarget } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { toast } from 'sonner';
import {
  ProbePacketDetail,
  PingProbeResponse,
  DEVICE_PACKET_TIMEOUT_MS,
  DEVICE_PACKET_INTERVAL_MS,
  formatPingRtt,
  formatCmdReplyTime,
  formatCmdStatTime,
  resolveDeviceProbeUrl,
  probeSingleDevicePacket,
  probeDeviceMultiPacket,
  createDevicePingScheduler,
  isLocalSelfHost
} from '../lib/devicePing';
import {
  resolveHostIp,
  getCachedDnsIp,
  startDnsBackgroundRefresh,
  isHttpOnlyOrNonWebTarget
} from '../lib/dnsResolve';

export type { ProbePacketDetail, PingProbeResponse };
export { resolveDeviceProbeUrl, probeSingleDevicePacket, probeDeviceMultiPacket };

export interface ServerTarget {
  id: string;
  name: string;
  host: string; // IP or domain URL
  category?: string;
  icon?: string;
  customLogo?: string;
}

export interface LatencyPoint {
  time: string;
  elapsedSec: number;
  timestamp: number;
  ms: number | null;
  failed: boolean;
  failTick?: number;
  isLastPoint?: boolean;
}

export interface ServerState {
  currentMs: number | 'Error' | 'warming...';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  noWebResponseHttps?: boolean;
  history: LatencyPoint[];
  minMs: number;
  maxMs: number;
  avgMs: number;
  mdevMs?: number;
  jitter?: number;
  packetLoss: number;
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  resolvedIp?: string | null;
  dnsMs?: number | null;
  dnsError?: string | null;
  connectMs?: number | null;
  ttl?: number | null;
  packets?: ProbePacketDetail[];
  lastError?: string | null;
  lastUpdated: number;
  method?: string;
  linkMode?: 'device' | 'server';
  vpsPingMs?: number | null;
  yMax: number;
}

interface ServiceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

const STORAGE_KEY = 'gts_server_monitor_user_targets_v5';
const SESSION_DURATION_SEC = 300; // 5 minutes

// Known popular sites mapping for auto-name & quick add
export const KNOWN_SITES: Record<string, string> = {
  'google.com': 'Google',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'tiktok.com': 'TikTok',
  'whatsapp.com': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  'netflix.com': 'Netflix',
  '1.1.1.1': 'Cloudflare 1.1.1.1',
  '8.8.8.8': 'Google DNS 8.8.8.8',
  'speedtest.net': 'Speedtest'
};

export const QUICK_ADD_SITES = [
  { name: 'Google', host: 'google.com' },
  { name: 'Facebook', host: 'facebook.com' },
  { name: 'TikTok', host: 'tiktok.com' },
  { name: 'YouTube', host: 'youtube.com' },
  { name: 'Instagram', host: 'instagram.com' },
  { name: 'WhatsApp', host: 'web.whatsapp.com' },
  { name: 'Netflix', host: 'netflix.com' },
  { name: 'Cloudflare 1.1.1.1', host: '1.1.1.1' },
  { name: 'Google DNS', host: '8.8.8.8' },
  { name: 'Speedtest', host: 'speedtest.net' }
];

// Parse terminal ping commands like "ping facebook.com" or "ping -c 4 https://facebook.com/path"
export function parsePingInput(raw: string): { host: string; requestedCount: number | null } {
  if (!raw) return { host: '', requestedCount: null };
  let s = raw.trim();
  let requestedCount: number | null = null;

  if (/^ping\s+/i.test(s)) {
    const tokens = s.split(/\s+/).slice(1);
    let candidate = '';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if ((tok === '-c' || tok === '-n') && i + 1 < tokens.length) {
        const parsed = parseInt(tokens[i + 1], 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          requestedCount = parsed;
        }
        i++;
        continue;
      }
      if ((tok === '-W' || tok === '-w' || tok === '-i' || tok === '-s' || tok === '-t') && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1])) {
        i++;
        continue;
      }
      if (tok.startsWith('-')) continue;
      candidate = tok;
    }
    s = candidate;
  }

  s = s.replace(/^[a-zA-Z]+:\/\//i, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  if (s.startsWith('[')) {
    const endBracket = s.indexOf(']');
    if (endBracket !== -1) s = s.slice(1, endBracket);
  } else if ((s.match(/:/g) || []).length === 1) {
    s = s.split(':')[0];
  }
  s = s.trim().toLowerCase();
  s = s.replace(/\.+$/, '');
  return { host: s, requestedCount };
}

// Normalize any user-pasted input to clean hostname (supports "ping domain.com", URLs, or IPs)
export function normalizeHost(raw: string): string {
  return parsePingInput(raw).host;
}

// Format numeric latency cleanly (<1ms when under 1ms, 1 decimal place otherwise)
function formatMs(val: number | null | undefined): string {
  if (typeof val !== 'number' || isNaN(val)) return '—';
  if (val < 1) return '<1';
  return String(Math.round(val * 10) / 10);
}

// Format probe method label cleanly
function formatMethodLabel(method?: string): string {
  if (!method || method === 'device-net' || method === 'echo' || method === 'probe') {
    return 'Device HTTP ping (your network)';
  }
  if (method === 'failed') return 'Unreachable';
  return 'Cloud server ping';
}

function buildCmdOutputText(displayHost: string, state: ServerState): string {
  const ipLabel = state.resolvedIp || displayHost;
  const header = `Pinging ${displayHost} [${ipLabel}] with 32 bytes of data:`;
  const counted = (state.packets || []).filter(p => !p.isConnect).slice(-60);
  const lines = counted.map(pkt => {
    if (pkt.status === 'ok') {
      const pktIp = pkt.ip || ipLabel;
      const timePart = formatCmdReplyTime(pkt.timeMs);
      const ttlPart = typeof pkt.ttl === 'number' && pkt.ttl > 0 ? `TTL=${pkt.ttl}` : 'TTL=n/a';
      return `Reply from ${pktIp}: bytes=32 ${timePart} ${ttlPart}`;
    }
    return 'Request timed out.';
  });

  if (lines.length === 0) {
    lines.push('Waiting for reply...');
  }

  const minText = state.packetsReceived > 0 ? formatCmdStatTime(state.minMs) : '--ms';
  const maxText = state.packetsReceived > 0 ? formatCmdStatTime(state.maxMs) : '--ms';
  const avgText = state.packetsReceived > 0 ? formatCmdStatTime(state.avgMs) : '--ms';

  return [
    header,
    ...lines,
    '',
    `Ping statistics for ${ipLabel}:`,
    `    Packets: Sent = ${state.packetsSent}, Received = ${state.packetsReceived}, Lost = ${state.packetsLost} (${state.packetLoss}% loss),`,
    'Approximate round trip times in milli-seconds:',
    `    Minimum = ${minText}, Maximum = ${maxText}, Average = ${avgText}`,
  ].join('\n');
}

// Check if target is app's own host or local/VPS origin
export function isSelfHost(host: string): boolean {
  return isLocalSelfHost(host);
}

// Requirement 3: Website domain instead of IP for app server entry
export function getDisplayHostAndName(srv: ServerTarget): { displayName: string; displayHost: string; isAppServer: boolean } {
  const clean = normalizeHost(srv.host);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAppServer = clean === '167.233.41.7' || (Boolean(currentHostname) && clean === currentHostname.toLowerCase());

  if (isAppServer && currentHostname) {
    return {
      displayName: currentHostname,
      displayHost: currentHostname,
      isAppServer: true
    };
  }
  return {
    displayName: srv.name || srv.host,
    displayHost: srv.host,
    isAppServer: false
  };
}

// Resolve original real favicon / logo URL for any domain or IP
export function getRealLogoUrl(host: string): string {
  const clean = normalizeHost(host);

  if (clean.includes('tiktok')) {
    return 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=128';
  }
  if (clean.includes('whatsapp')) {
    return 'https://www.google.com/s2/favicons?domain=whatsapp.com&sz=128';
  }
  if (clean === '1.1.1.1' || clean === '1.0.0.1' || clean.includes('cloudflare')) {
    return 'https://www.google.com/s2/favicons?domain=cloudflare.com&sz=128';
  }
  if (clean === '8.8.8.8' || clean === '8.8.4.4' || clean.includes('google')) {
    return 'https://www.google.com/s2/favicons?domain=google.com&sz=128';
  }
  if (clean === '9.9.9.9' || clean.includes('quad9')) {
    return 'https://www.google.com/s2/favicons?domain=quad9.net&sz=128';
  }
  if (clean === '208.67.222.222' || clean === '208.67.220.220' || clean.includes('opendns')) {
    return 'https://www.google.com/s2/favicons?domain=opendns.com&sz=128';
  }
  if (clean === '167.233.41.7' || clean.includes('hetzner')) {
    return 'https://www.google.com/s2/favicons?domain=hetzner.com&sz=128';
  }
  if (clean.includes('facebook') || clean.includes('fb.com')) {
    return 'https://www.google.com/s2/favicons?domain=facebook.com&sz=128';
  }
  if (clean.includes('instagram')) {
    return 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128';
  }
  if (clean.includes('youtube')) {
    return 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128';
  }
  if (clean.includes('netflix')) {
    return 'https://www.google.com/s2/favicons?domain=netflix.com&sz=128';
  }
  if (clean.includes('microsoft') || clean.includes('azure') || clean.includes('bing')) {
    return 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128';
  }
  if (clean.includes('speedtest') || clean.includes('ookla')) {
    return 'https://www.google.com/s2/favicons?domain=speedtest.net&sz=128';
  }
  if (clean.includes('ptcl')) {
    return 'https://www.google.com/s2/favicons?domain=ptcl.com.pk&sz=128';
  }
  if (clean.includes('nayatel')) {
    return 'https://www.google.com/s2/favicons?domain=nayatel.com&sz=128';
  }
  if (clean.includes('greennet')) {
    return 'https://www.google.com/s2/favicons?domain=greennet.pk&sz=128';
  }

  // Pure IP address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return `https://www.google.com/s2/favicons?domain=${clean}&sz=128`;
  }

  // General domain favicon fetcher
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=128`;
}

// Logo Component with automatic image error fallback
const ServerLogo: React.FC<{ host: string; name: string }> = ({ host, name }) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = useMemo(() => getRealLogoUrl(host), [host]);

  if (hasError || !logoUrl) {
    const initial = (name || host || 'S').trim().charAt(0).toUpperCase();
    return (
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 p-2 flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden group-hover:border-emerald-500/50 transition-colors">
      <img
        src={logoUrl}
        alt={name}
        width={28}
        height={28}
        onError={() => setHasError(true)}
        className="w-full h-full object-contain rounded-lg drop-shadow-sm"
        loading="lazy"
      />
    </div>
  );
};

const SPARKLINE_WINDOW_MS = 60000;
const SPARKLINE_VIEWBOX_W = 360;
const SPARKLINE_VIEWBOX_H = 66;

// Lightweight Pure SVG Latency Sparkline with identical 60-second time window & x-scale across all rows
const LatencySparkline: React.FC<{
  history: LatencyPoint[];
  yMax: number;
  status: ServerState['status'];
  srvId: string;
  windowEndMs: number;
}> = React.memo(({ history, yMax, status, srvId, windowEndMs }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = SPARKLINE_VIEWBOX_W;
  const height = SPARKLINE_VIEWBOX_H;
  const padTop = 6;
  const padBottom = 8;
  const usableH = height - padTop - padBottom;
  const effectiveYMax = Math.max(15, yMax || 40);

  const windowEnd = useMemo(() => {
    const lastTs = history.length > 0 ? history[history.length - 1].timestamp : 0;
    return Math.max(windowEndMs, lastTs);
  }, [history, windowEndMs]);
  const windowStart = windowEnd - SPARKLINE_WINDOW_MS;

  const samples = useMemo(() => {
    return history.filter(
      pt => pt.timestamp >= windowStart - 2000 && pt.timestamp <= windowEnd + 1000
    );
  }, [history, windowStart, windowEnd]);

  // Compute (x, y) coordinates mapped uniformly to the shared 60-second x-scale
  const { pathD, areaD, points, lastValidPoint } = useMemo(() => {
    if (samples.length === 0) {
      return { pathD: '', areaD: '', points: [], lastValidPoint: null };
    }

    const pts = samples.map((s, idx) => {
      const ratio = Math.max(0, Math.min(1, (s.timestamp - windowStart) / SPARKLINE_WINDOW_MS));
      const x = ratio * width;
      const isFailed = s.failed || s.ms === null || typeof s.ms !== 'number';
      const val = isFailed ? 0 : s.ms;
      const clampedVal = Math.min(val, effectiveYMax);
      const y = isFailed ? height - padBottom : padTop + (1 - clampedVal / effectiveYMax) * usableH;
      return { x, y, isFailed, raw: s, idx };
    });

    let lastValid: { x: number; y: number; ms: number } | null = null;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (!pts[i].isFailed && typeof pts[i].raw.ms === 'number') {
        lastValid = { x: pts[i].x, y: pts[i].y, ms: pts[i].raw.ms as number };
        break;
      }
    }

    if (pts.length === 1) {
      const p0 = pts[0];
      const segStart = Math.max(0, p0.x - 6);
      const segEnd = Math.min(width, p0.x + 2);
      const dSingle = `M ${segStart.toFixed(1)} ${p0.y.toFixed(1)} L ${segEnd.toFixed(1)} ${p0.y.toFixed(1)}`;
      const aSingle = `${dSingle} L ${segEnd.toFixed(1)} ${height} L ${segStart.toFixed(1)} ${height} Z`;
      return {
        pathD: dSingle,
        areaD: aSingle,
        points: pts,
        lastValidPoint: lastValid
      };
    }

    // Build smooth segments across contiguous points (break across > 5s gaps such as tab pauses)
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    const areaSegments: string[] = [];
    let segStartX = pts[0].x;
    let segPath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      if (p2.raw.timestamp - p1.raw.timestamp > 5000) {
        areaSegments.push(`${segPath} L ${p1.x.toFixed(1)} ${height} L ${segStartX.toFixed(1)} ${height} Z`);
        segStartX = p2.x;
        segPath = `M ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        d += ` M ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        continue;
      }

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;
      const curve = ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      d += curve;
      segPath += curve;
    }

    const lastX = pts[pts.length - 1].x;
    areaSegments.push(`${segPath} L ${lastX.toFixed(1)} ${height} L ${segStartX.toFixed(1)} ${height} Z`);

    return { pathD: d, areaD: areaSegments.join(' '), points: pts, lastValidPoint: lastValid };
  }, [samples, windowStart, effectiveYMax, width, height, padTop, padBottom, usableH]);

  const statusColor = status === 'poor' ? '#f43f5e' : status === 'fair' ? '#f59e0b' : status === 'offline' ? '#94a3b8' : '#10b981';

  return (
    <div
      className="relative w-full h-[76px] bg-slate-50/80 dark:bg-slate-950/90 border border-slate-200/80 dark:border-white/5 rounded-xl overflow-hidden group/chart select-none"
      onMouseLeave={() => setHoveredIdx(null)}
      onMouseMove={(e) => {
        if (points.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const targetX = (mouseX / Math.max(1, rect.width)) * width;
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < points.length; i++) {
          const dist = Math.abs(points[i].x - targetX);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        setHoveredIdx(closestIdx);
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        <defs>
          <linearGradient id={`sparkGrad-${srvId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={statusColor} stopOpacity={0.28} />
            <stop offset="90%" stopColor={statusColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Subtle horizontal reference grid lines */}
        <line x1="0" y1="18" x2={width} y2="18" stroke="currentColor" strokeDasharray="3 4" strokeWidth="0.8" className="text-slate-200/70 dark:text-white/5" />
        <line x1="0" y1="38" x2={width} y2="38" stroke="currentColor" strokeDasharray="3 4" strokeWidth="0.8" className="text-slate-200/70 dark:text-white/5" />
        <line x1="0" y1="58" x2={width} y2="58" stroke="currentColor" strokeDasharray="3 4" strokeWidth="0.8" className="text-slate-200/70 dark:text-white/5" />

        {/* Area Fill */}
        {areaD && (
          <path d={areaD} fill={`url(#sparkGrad-${srvId})`} />
        )}

        {/* Line Stroke */}
        {pathD ? (
          <path
            d={pathD}
            fill="none"
            stroke={statusColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <line
            x1="0"
            y1="34"
            x2={width}
            y2="34"
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth="1"
            className="text-slate-300 dark:text-slate-700"
          />
        )}

        {/* Red markers for failed packets */}
        {points.filter(p => p.isFailed).map((p, i) => (
          <rect
            key={`fail-${i}`}
            x={Math.max(0, p.x - 1.5)}
            y={height - 10}
            width={3}
            height={10}
            rx={1.5}
            fill="#f43f5e"
          />
        ))}

        {/* Leading (rightmost) valid point */}
        {lastValidPoint && (
          <g transform={`translate(${lastValidPoint.x}, ${lastValidPoint.y})`}>
            <circle r="6" fill={statusColor} opacity="0.2" />
            <circle r="3.5" fill="#ffffff" stroke={statusColor} strokeWidth="2" />
          </g>
        )}

        {/* Hover vertical crosshair */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={0}
              x2={points[hoveredIdx].x}
              y2={height}
              stroke="currentColor"
              strokeDasharray="2 2"
              strokeWidth="1"
              className="text-slate-400 dark:text-slate-500"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].y}
              r="4"
              fill={statusColor}
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Frame Axis Watermarks: Top Max and Bottom Zero */}
      <div className="absolute top-1 right-2 flex items-center gap-1 pointer-events-none">
        <span className="text-[8px] font-mono tabular-nums font-bold text-slate-400/80 dark:text-slate-500">
          ~{Math.round(effectiveYMax)}ms
        </span>
      </div>
      <div className="absolute bottom-1 right-2 flex items-center gap-1 pointer-events-none">
        <span className="text-[8px] font-mono tabular-nums font-bold text-slate-400/60 dark:text-slate-600">
          0ms
        </span>
      </div>
      <div className="absolute bottom-1 left-2 flex items-center gap-1 pointer-events-none">
        <span className="text-[8px] font-mono tabular-nums font-bold text-slate-400/70 dark:text-slate-500">
          60s window
        </span>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute z-20 pointer-events-none -top-1 px-2 py-0.5 rounded-lg bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[10px] font-mono font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap"
          style={{
            left: `${Math.min(85, Math.max(15, (points[hoveredIdx].x / width) * 100))}%`,
            transform: 'translateX(-50%) translateY(-6px)'
          }}
        >
          <span>{points[hoveredIdx].raw.time}</span>
          <span>·</span>
          <span className={points[hoveredIdx].isFailed ? "text-rose-400" : "text-emerald-400 dark:text-emerald-600 font-black"}>
            {points[hoveredIdx].isFailed ? "Request timed out." : formatPingRtt(points[hoveredIdx].raw.ms)}
          </span>
        </div>
      )}
    </div>
  );
});

// Helper: calculate 95th percentile
function calculateP95(samples: number[]): number {
  if (samples.length === 0) return 40;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

// Format seconds to mm:ss
function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return '00:00';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Memoized Server Card Component with uniform grid layout & Windows CMD details drawer
const ServerCard = React.memo<{
  srv: ServerTarget;
  state: ServerState;
  copiedHost: string | null;
  idx: number;
  isSessionActive: boolean;
  isExpanded: boolean;
  isProbing?: boolean;
  linkMode: 'device' | 'server';
  windowEndMs: number;
  onToggleExpand: (id: string) => void;
  onToggleLinkMode: (srv: ServerTarget) => void;
  onRestart: () => void;
  onCopyHost: (host: string) => void;
  onPing: (srv: ServerTarget, packetCount?: number) => void;
  onEdit: (srv: ServerTarget) => void;
  onDelete: (srv: ServerTarget) => void;
}>(function ServerCard({
  srv,
  state,
  copiedHost,
  idx,
  isSessionActive,
  isExpanded,
  isProbing,
  linkMode,
  windowEndMs,
  onToggleExpand,
  onToggleLinkMode,
  onRestart,
  onCopyHost,
  onPing,
  onEdit,
  onDelete
}) {
  const statusColors = state.noWebResponseHttps
    ? {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-500/30',
        dot: 'bg-amber-500'
      }
    : {
        excellent: {
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-500/30',
          dot: 'bg-emerald-500'
        },
        good: {
          bg: 'bg-teal-50 dark:bg-teal-500/10',
          text: 'text-teal-700 dark:text-teal-400',
          border: 'border-teal-200 dark:border-teal-500/30',
          dot: 'bg-teal-500'
        },
        fair: {
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-500/30',
          dot: 'bg-amber-500'
        },
        poor: {
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          text: 'text-rose-700 dark:text-rose-400',
          border: 'border-rose-200 dark:border-rose-500/30',
          dot: 'bg-rose-500'
        },
        offline: {
          bg: 'bg-slate-100 dark:bg-slate-500/10',
          text: 'text-slate-600 dark:text-slate-400',
          border: 'border-slate-200 dark:border-slate-500/30',
          dot: 'bg-slate-400'
        }
      }[state.status] || {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        dot: 'bg-emerald-500'
      };

  const isWarming = state.currentMs === 'warming...';
  const { displayName, displayHost } = useMemo(() => getDisplayHostAndName(srv), [srv]);
  const cmdText = useMemo(() => buildCmdOutputText(displayHost, state), [displayHost, state]);
  const methodBadgeLabel = linkMode === 'server' ? 'Cloud server ping' : 'Device HTTP ping (your network)';
  const ipTooltip =
    linkMode === 'device'
      ? 'Resolved from your device network via DNS-over-HTTPS; the browser may connect to another edge IP'
      : 'Resolved via Cloud server DNS lookup';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
      className="w-full bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/90 dark:border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition-all duration-300 shadow-xs hover:shadow-md group flex flex-col gap-3 relative overflow-hidden"
    >
      {/* Session Stopped Overlay */}
      {!isSessionActive && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/85 backdrop-blur-[2px] z-10 flex items-center justify-center p-3 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl shadow-lg">
            <Clock size={15} className="text-amber-500 shrink-0" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
              Monitoring stopped after 5 min
            </span>
            <button
              onClick={onRestart}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider transition-all shadow-xs flex items-center gap-1 cursor-pointer ml-1 whitespace-nowrap shrink-0"
            >
              <RefreshCw size={12} />
              <span>Restart</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,240px)_auto] items-stretch xl:items-center gap-4">
        {/* Column 1: Identity & Resolved DoH IP */}
        <div className="flex items-center gap-3 w-full min-w-0">
          <div className="relative shrink-0">
            <ServerLogo host={displayHost} name={displayName} />
            <span className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900", statusColors.dot)} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight uppercase" title={displayName}>
              {displayName}
            </h4>
            <div className="flex items-center gap-1 mt-0.5 min-w-0">
              <span
                className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate min-w-0"
                title={displayHost}
              >
                {displayHost}
              </span>
              <button
                type="button"
                onClick={() => onCopyHost(displayHost)}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Host"
              >
                {copiedHost === displayHost ? (
                  <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
            {/* Always show small monospace IP line under host name */}
            <div className="flex items-center gap-1 mt-0.5 min-w-0 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {state.resolvedIp ? (
                <>
                  <span className="truncate text-slate-600 dark:text-slate-300" title={ipTooltip}>
                    IP {state.resolvedIp}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyHost(state.resolvedIp!)}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Resolved IP"
                  >
                    {copiedHost === state.resolvedIp ? (
                      <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </>
              ) : state.dnsError ? (
                <span className="truncate text-amber-600 dark:text-amber-400" title={state.dnsError}>
                  IP - · {state.dnsError}
                </span>
              ) : (
                <span className="truncate" title={ipTooltip}>
                  IP resolving...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0 text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 truncate">
              {typeof state.connectMs === 'number' && (
                <span>Connect: {formatMs(state.connectMs)}ms</span>
              )}
              {typeof state.connectMs === 'number' && typeof state.dnsMs === 'number' && (
                <span>·</span>
              )}
              {typeof state.dnsMs === 'number' && (
                <span>DNS {formatMs(state.dnsMs)}ms</span>
              )}
              {typeof state.ttl === 'number' && state.ttl > 0 && (
                <>
                  <span>·</span>
                  <span>TTL {state.ttl}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Fixed-width shared-scale 60s Vector Sparkline */}
        <div className="w-full min-w-0">
          <LatencySparkline
            history={state.history}
            yMax={state.yMax}
            status={state.status}
            srvId={srv.id}
            windowEndMs={windowEndMs}
          />
        </div>

        {/* Column 3: Latency Stats */}
        <div className="w-full min-w-0 flex items-center gap-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/5 rounded-xl px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1">
              {isWarming ? (
                <span className="text-xs font-black font-mono tracking-tight text-amber-500 animate-pulse">
                  probing...
                </span>
              ) : (
                <>
                  <span className={cn("text-xl font-black font-mono tabular-nums tracking-tight", statusColors.text)}>
                    {typeof state.currentMs === 'number' ? formatMs(state.currentMs) : (state.noWebResponseHttps ? 'No HTTPS' : state.currentMs)}
                  </span>
                  {typeof state.currentMs === 'number' && (
                    <span className="text-[10px] font-black uppercase text-slate-400">ms</span>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums font-semibold mt-0.5 truncate">
              <span>Min {formatMs(state.minMs)}</span>
              <span>·</span>
              <span>Avg {formatMs(state.avgMs)}</span>
              <span>·</span>
              <span>Max {formatMs(state.maxMs)}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums mt-0.5 truncate">
              <span className="text-slate-600 dark:text-slate-300 font-semibold">
                Pkts {state.packetsReceived}/{state.packetsSent}
              </span>
              <span className="text-slate-400">·</span>
              <span className={state.packetLoss > 0 ? "text-rose-500 dark:text-rose-400 font-black" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                {state.packetLoss}% loss
              </span>
            </div>
          </div>
          {state.noWebResponseHttps ? (
            <span
              title="Browsers cannot send ICMP. Use Cloud mode for this host"
              className={cn(
                "ml-auto px-2 py-1 rounded-lg text-[9px] font-bold tracking-tight border shrink-0 whitespace-nowrap max-w-[105px] truncate",
                statusColors.bg,
                statusColors.text,
                statusColors.border
              )}
            >
              No web response (HTTPS)
            </span>
          ) : (
            <span
              className={cn(
                "ml-auto px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shrink-0 whitespace-nowrap",
                statusColors.bg,
                statusColors.text,
                statusColors.border
              )}
            >
              {state.status}
            </span>
          )}
        </div>

        {/* Column 4: Actions (identical width across every row) */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end xl:justify-start">
          <button
            type="button"
            onClick={() => onToggleLinkMode(srv)}
            className={cn(
              "w-[66px] px-2 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1 whitespace-nowrap shrink-0",
              linkMode === 'server'
                ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10"
            )}
            title={
              linkMode === 'server'
                ? 'This host uses Cloud server ping (click to switch to Device network)'
                : 'This host uses Device network HTTP ping (click to switch to Cloud server ping)'
            }
          >
            {linkMode === 'server' ? <Wifi size={12} /> : <Laptop size={12} />}
            <span>{linkMode === 'server' ? 'Cloud' : 'Device'}</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleExpand(srv.id)}
            className={cn(
              "px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 whitespace-nowrap shrink-0",
              isExpanded
                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10"
            )}
            title="Show CMD ping output & RTT statistics"
          >
            <Terminal size={12} />
            <span>CMD</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            type="button"
            onClick={() => onPing(srv, 4)}
            disabled={isProbing}
            className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px] font-bold whitespace-nowrap shrink-0 disabled:opacity-60"
            title="Run Packet 0 (Connect) + 4 Sequential Pings (1s interval)"
          >
            <RefreshCw size={12} className={cn("text-emerald-600 dark:text-emerald-400", isProbing && "animate-spin")} />
            <span>Ping 4x</span>
          </button>
          <button
            type="button"
            onClick={() => onEdit(srv)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs group/btn shrink-0"
            title="Edit Server"
          >
            <Edit2 size={14} className="group-hover/btn:scale-110 transition-transform text-teal-600 dark:text-teal-400" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(srv)}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-all cursor-pointer shadow-xs group/btn shrink-0"
            title="Delete Server"
          >
            <Trash2 size={14} className="group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Expandable Full-Width Windows CMD Details Drawer */}
      {isExpanded && (
        <div className="pt-3 mt-1 border-t border-slate-200/80 dark:border-white/10 space-y-2.5 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-semibold">
                {methodBadgeLabel}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Probe: HEAD {resolveDeviceProbeUrl(displayHost)}
              </span>
              {typeof state.connectMs === 'number' && (
                <span className="text-slate-500 dark:text-slate-400">
                  · Connect: {formatMs(state.connectMs)} ms
                </span>
              )}
              {(typeof state.jitter === 'number' || typeof state.mdevMs === 'number') && (
                <span className="text-slate-500 dark:text-slate-400">
                  · Jitter {formatMs(state.jitter)} ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {state.noWebResponseHttps && linkMode === 'device' && (
                <button
                  type="button"
                  onClick={() => onToggleLinkMode(srv)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Browsers cannot send ICMP. Use Cloud mode for this host"
                >
                  Use Cloud mode for this host
                </button>
              )}
              <button
                type="button"
                onClick={() => onCopyHost(cmdText)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy CMD ping output"
              >
                {copiedHost === cmdText ? (
                  <>
                    <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-3.5 text-[12px] leading-relaxed font-mono tabular-nums whitespace-pre-wrap select-text">
            {cmdText}
          </pre>
        </div>
      )}
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.srv === nextProps.srv &&
    prevProps.state === nextProps.state &&
    prevProps.copiedHost === nextProps.copiedHost &&
    prevProps.isSessionActive === nextProps.isSessionActive &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isProbing === nextProps.isProbing &&
    prevProps.linkMode === nextProps.linkMode &&
    prevProps.windowEndMs === nextProps.windowEndMs &&
    prevProps.idx === nextProps.idx
  );
});

export default function ServiceMonitor({ isOpen, onClose, user }: ServiceMonitorProps) {
  // Target Servers state
  const [servers, setServers] = useState<ServerTarget[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load servers from storage:', e);
    }
    return [];
  });

  const [isLoadingFromDb, setIsLoadingFromDb] = useState(true);
  const showServersSkeleton = useSkeletonGate(isLoadingFromDb) && servers.length === 0;

  // Subscribe to database `monitor_targets` table in real-time
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingFromDb(true);

    const dealerId = user?.dealerId || 'main';
    const unsub = supabaseService.subscribeMonitorTargets((dbTargets: MonitorTarget[]) => {
      setIsLoadingFromDb(false);
      if (Array.isArray(dbTargets)) {
        const parsed: ServerTarget[] = dbTargets.map(t => {
          let meta: any = {};
          if (t.label && t.label.startsWith('{')) {
            try {
              meta = JSON.parse(t.label);
            } catch (e) {}
          }
          return {
            id: t.id,
            name: meta.name || t.label || t.domain,
            host: t.domain
          };
        });
        setServers(parsed);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {}
      }
    }, dealerId);

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, user]);

  // Requirement 4: 5-minute session state & countdown
  const sessionStartTimeRef = useRef<number>(Date.now());
  const [sessionIteration, setSessionIteration] = useState<number>(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(SESSION_DURATION_SEC);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(true);

  // Reset session when modal opens
  useEffect(() => {
    if (isOpen) {
      sessionStartTimeRef.current = Date.now();
      setRemainingSeconds(SESSION_DURATION_SEC);
      setIsSessionActive(true);
      setSessionIteration(prev => prev + 1);
    }
  }, [isOpen]);

  // 1-second countdown timer for 5-minute session
  useEffect(() => {
    if (!isOpen || !isSessionActive) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
      const left = SESSION_DURATION_SEC - elapsed;
      if (left <= 0) {
        setRemainingSeconds(0);
        setIsSessionActive(false);
        clearInterval(timer);
      } else {
        setRemainingSeconds(left);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isSessionActive, sessionIteration]);

  // Restart 5-minute session handler
  const handleRestartSession = useCallback(() => {
    sessionStartTimeRef.current = Date.now();
    setRemainingSeconds(SESSION_DURATION_SEC);
    setIsSessionActive(true);
    runtimeMapRef.current.clear();
    setLiveStates({});
    setSessionIteration(prev => prev + 1);
  }, []);

  // Real-time Live Latency Engine State
  const [liveStates, setLiveStates] = useState<Record<string, ServerState>>({});
  const [probeMode, setProbeMode] = useState<'device' | 'server'>(() => {
    try {
      const saved = localStorage.getItem('gts_latency_probe_mode_v2');
      if (saved === 'server' || saved === 'device') return saved;
      const oldSaved = localStorage.getItem('gts_latency_probe_mode');
      if (oldSaved === 'server') return oldSaved;
    } catch {}
    return 'server';
  });
  const [perLinkMode, setPerLinkMode] = useState<Record<string, 'device' | 'server'>>({});
  const probeModeRef = useRef<'device' | 'server'>(probeMode);
  const perLinkModeRef = useRef<Record<string, 'device' | 'server'>>(perLinkMode);
  useEffect(() => { probeModeRef.current = probeMode; }, [probeMode]);
  useEffect(() => { perLinkModeRef.current = perLinkMode; }, [perLinkMode]);

  const [isTabHidden, setIsTabHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
  );
  const [windowEndMs, setWindowEndMs] = useState<number>(() => Date.now());

  const serversRef = useRef<ServerTarget[]>(servers);
  useEffect(() => { serversRef.current = servers; }, [servers]);

  const devicePingScheduler = useMemo(() => createDevicePingScheduler(4), []);

  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsTabHidden(hidden);
      if (!hidden) {
        setWindowEndMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Advance shared 60-second sparkline time window every second while visible & active
  useEffect(() => {
    if (!isOpen || !isSessionActive || isTabHidden) return;
    setWindowEndMs(Date.now());
    const timer = setInterval(() => {
      setWindowEndMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isSessionActive, isTabHidden]);

  const handleToggleMode = useCallback((mode: 'device' | 'server') => {
    setProbeMode(mode);
    probeModeRef.current = mode;
    setPerLinkMode({});
    perLinkModeRef.current = {};
    try {
      localStorage.setItem('gts_latency_probe_mode_v2', mode);
      localStorage.setItem('gts_latency_probe_mode', mode);
    } catch {}
    devicePingScheduler.clear();
    runtimeMapRef.current.clear();
    setLiveStates({});
    toast.success(
      mode === 'device'
        ? 'Switched to Device HTTP ping (your network)'
        : 'Switched to Cloud server ping'
    );
  }, [devicePingScheduler]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHost, setCopiedHost] = useState<string | null>(null);
  const [expandedServerIds, setExpandedServerIds] = useState<Record<string, boolean>>({});
  const [probingServerIds, setProbingServerIds] = useState<Record<string, boolean>>({});
  const probingServerIdsRef = useRef<Record<string, boolean>>({});

  // Quick Ping Domain Command Bar State (e.g. "ping facebook.com")
  const [quickPingInput, setQuickPingInput] = useState('');
  const [isQuickPinging, setIsQuickPinging] = useState(false);
  const [quickPingResult, setQuickPingResult] = useState<PingProbeResponse | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerTarget | null>(null);
  const [serverToDelete, setServerToDelete] = useState<ServerTarget | null>(null);
  usePopupTiming('ServiceMonitorAddModal', isAddModalOpen);
  usePopupTiming('ServiceMonitorDeleteModal', Boolean(serverToDelete));
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');

  // Per-server runtime statistics & sample history
  const runtimeMapRef = useRef<Map<string, {
    hasConnectProbe: boolean;
    connectMs: number | null;
    lastSampleTime: number;
    sessionSamples: { ms: number; failed: boolean; elapsedSec: number; time: string; timestamp: number }[];
    goodSamples: number[];
    packetsSent: number;
    packetsReceived: number;
    packetsLost: number;
    packets: ProbePacketDetail[];
    resolvedIp: string | null;
    dnsMs: number | null;
    dnsError: string | null;
    noWebResponseHttps: boolean;
    ttl: number | null;
    method: string;
    mdevMs: number;
    lastJitter: number;
    lastError: string | null;
    currentYMax: number;
    lastYMaxUpdate: number;
  }>>(new Map());

  // Performance batching & throttling refs
  const pendingUpdatesRef = useRef<Map<string, ServerState>>(new Map());
  const lastRenderedRef = useRef<Map<string, { ms: number | string; pktCount: number; lastPushed: number }>>(new Map());
  const batchRafRef = useRef<number | null>(null);

  const toggleServerExpand = useCallback((id: string) => {
    setExpandedServerIds(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Batched state updater
  const scheduleStateUpdate = useCallback((srvId: string, newState: ServerState, force = false) => {
    const now = Date.now();
    const last = lastRenderedRef.current.get(srvId);
    const pktCount = newState.packetsSent || 0;

    let shouldUpdate = force;
    if (!shouldUpdate) {
      if (!last) {
        shouldUpdate = true;
      } else if (typeof newState.currentMs !== typeof last.ms || pktCount !== last.pktCount) {
        shouldUpdate = true;
      } else if (typeof newState.currentMs === 'number' && typeof last.ms === 'number') {
        if (Math.abs(newState.currentMs - last.ms) >= 0.2 || (now - last.lastPushed >= 2500)) {
          shouldUpdate = true;
        }
      } else if (newState.currentMs !== last.ms || (now - last.lastPushed >= 2500)) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      pendingUpdatesRef.current.set(srvId, newState);
      lastRenderedRef.current.set(srvId, { ms: newState.currentMs, pktCount, lastPushed: now });

      if (batchRafRef.current === null) {
        batchRafRef.current = requestAnimationFrame(() => {
          batchRafRef.current = null;
          if (pendingUpdatesRef.current.size === 0) return;
          const updates = new Map<string, ServerState>(pendingUpdatesRef.current);
          pendingUpdatesRef.current.clear();
          setLiveStates(prev => {
            const next = { ...prev };
            updates.forEach((val: ServerState, key: string) => {
              next[key] = val;
            });
            return next;
          });
        });
      }
    }
  }, []);

  // Re-resolve DoH A/AAAA IP records in the background every 5 minutes for monitored targets
  useEffect(() => {
    if (!isOpen) return;
    const stopRefresh = startDnsBackgroundRefresh(
      () => serversRef.current.map(s => parsePingInput(s.host).host).filter(Boolean),
      (cleanHost, result) => {
        serversRef.current.forEach(srv => {
          if (parsePingInput(srv.host).host === cleanHost) {
            const rt = runtimeMapRef.current.get(srv.id);
            if (rt) {
              if (result.ip) rt.resolvedIp = result.ip;
              if (typeof result.dnsMs === 'number') rt.dnsMs = result.dnsMs;
              rt.dnsError = result.ip ? null : (result.error || null);
            }
          }
        });
      }
    );
    return stopRefresh;
  }, [isOpen]);

  // Real-time ping engine supporting CMD-matched device HTTP ping (Packet 0 Connect + 1s packets) & Cloud server mode
  const pingServerReal = useCallback(async (srv: ServerTarget, explicitCount?: number, explicitMode?: 'device' | 'server') => {
    const parsed = parsePingInput(srv.host);
    const cleanHost = parsed.host;
    if (!cleanHost) return;

    const effectiveMode = explicitMode || perLinkModeRef.current[srv.id] || probeModeRef.current;

    // Skip overlapping continuous tick while a manual Ping 4x burst is executing for this server
    if (!explicitCount && probingServerIdsRef.current[srv.id]) {
      return;
    }

    let rt = runtimeMapRef.current.get(srv.id);
    if (!rt) {
      const cachedDns = getCachedDnsIp(cleanHost);
      rt = {
        hasConnectProbe: false,
        connectMs: null,
        lastSampleTime: 0,
        sessionSamples: [],
        goodSamples: [],
        packetsSent: 0,
        packetsReceived: 0,
        packetsLost: 0,
        packets: [],
        resolvedIp: cachedDns?.ip || null,
        dnsMs: cachedDns?.dnsMs ?? null,
        dnsError: cachedDns?.error || null,
        noWebResponseHttps: false,
        ttl: null,
        method: effectiveMode === 'server' ? 'server-probe' : 'device-net',
        mdevMs: 0,
        lastJitter: 0,
        lastError: null,
        currentYMax: 40,
        lastYMaxUpdate: 0
      };
      runtimeMapRef.current.set(srv.id, rt);
    }

    const packetCount = explicitCount ?? 1;
    const isBurst = typeof explicitCount === 'number' && explicitCount > 1;
    if (isBurst) {
      probingServerIdsRef.current[srv.id] = true;
      setProbingServerIds(prev => ({ ...prev, [srv.id]: true }));
    }

    const { isAppServer } = getDisplayHostAndName(srv);

    const buildAndPushState = (
      currentDisplayMs: number | 'Error' | 'warming...',
      force = false
    ) => {
      const targetRt = rt!;
      const ts = Date.now();
      const minMs = targetRt.goodSamples.length > 0 ? Math.round(Math.min(...targetRt.goodSamples) * 10) / 10 : 0;
      const maxMs = targetRt.goodSamples.length > 0 ? Math.round(Math.max(...targetRt.goodSamples) * 10) / 10 : 0;
      const avgMs = targetRt.goodSamples.length > 0
        ? Math.round((targetRt.goodSamples.reduce((a, b) => a + b, 0) / targetRt.goodSamples.length) * 10) / 10
        : 0;

      if (targetRt.goodSamples.length >= 2) {
        let diffSum = 0;
        for (let i = 1; i < targetRt.goodSamples.length; i++) {
          diffSum += Math.abs(targetRt.goodSamples[i] - targetRt.goodSamples[i - 1]);
        }
        targetRt.lastJitter = Math.round((diffSum / (targetRt.goodSamples.length - 1)) * 10) / 10;
        const mean = targetRt.goodSamples.reduce((a, b) => a + b, 0) / targetRt.goodSamples.length;
        const variance = targetRt.goodSamples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / targetRt.goodSamples.length;
        targetRt.mdevMs = Math.round(Math.sqrt(variance) * 10) / 10;
      }

      const packetLoss = targetRt.packetsSent > 0
        ? Math.round((targetRt.packetsLost / targetRt.packetsSent) * 1000) / 10
        : 0;

      let status: ServerState['status'] = 'offline';
      if (targetRt.noWebResponseHttps) {
        status = 'fair';
      } else if (typeof currentDisplayMs === 'number') {
        if (currentDisplayMs > 180) status = 'poor';
        else if (currentDisplayMs > 90) status = 'fair';
        else if (currentDisplayMs > 35) status = 'good';
        else status = 'excellent';
      } else if (currentDisplayMs === 'warming...') {
        status = 'good';
      }

      if (!targetRt.currentYMax || (ts - targetRt.lastYMaxUpdate >= 10000)) {
        const p95 = calculateP95(targetRt.goodSamples);
        targetRt.currentYMax = Math.max(40, Math.round(p95 * 1.3));
        targetRt.lastYMaxUpdate = ts;
      }

      const failTickHeight = Math.round(targetRt.currentYMax * 0.08);
      const history: LatencyPoint[] = targetRt.sessionSamples.map(s => ({
        time: s.time,
        elapsedSec: s.elapsedSec,
        timestamp: s.timestamp,
        ms: s.failed ? null : s.ms,
        failed: s.failed,
        failTick: s.failed ? failTickHeight : undefined
      }));

      scheduleStateUpdate(
        srv.id,
        {
          currentMs: currentDisplayMs,
          status,
          noWebResponseHttps: targetRt.noWebResponseHttps,
          history,
          minMs,
          maxMs,
          avgMs,
          mdevMs: targetRt.mdevMs,
          jitter: targetRt.lastJitter,
          packetLoss,
          packetsSent: targetRt.packetsSent,
          packetsReceived: targetRt.packetsReceived,
          packetsLost: targetRt.packetsLost,
          resolvedIp: targetRt.resolvedIp,
          dnsMs: targetRt.dnsMs,
          dnsError: targetRt.dnsError,
          connectMs: targetRt.connectMs,
          ttl: targetRt.ttl,
          packets: [...targetRt.packets],
          lastError: targetRt.lastError,
          lastUpdated: ts,
          method: targetRt.method || (effectiveMode === 'server' ? 'server-probe' : 'device-net'),
          linkMode: effectiveMode,
          yMax: targetRt.currentYMax
        },
        force
      );
    };

    const appendPacketSample = (pkt: ProbePacketDetail, sampleTs: number) => {
      const targetRt = rt!;
      const seqNum = targetRt.packetsSent + 1;
      const recordedPkt: ProbePacketDetail = {
        ...pkt,
        seq: seqNum,
        ip: pkt.ip || targetRt.resolvedIp || cleanHost,
        timestamp: sampleTs
      };

      targetRt.packetsSent += 1;
      if (recordedPkt.status === 'ok' && typeof recordedPkt.timeMs === 'number') {
        targetRt.packetsReceived += 1;
      } else {
        targetRt.packetsLost += 1;
      }

      targetRt.packets.push(recordedPkt);
      if (targetRt.packets.length > 60) {
        targetRt.packets = targetRt.packets.slice(-60);
      }

      const elapsedSec = Math.min(
        SESSION_DURATION_SEC,
        Math.max(0, Math.floor((sampleTs - sessionStartTimeRef.current) / 1000))
      );
      const timeStr = new Date(sampleTs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const isOk = recordedPkt.status === 'ok' && typeof recordedPkt.timeMs === 'number';
      if (isOk) {
        const val = Math.round((recordedPkt.timeMs as number) * 10) / 10;
        targetRt.goodSamples.push(val);
        if (targetRt.goodSamples.length > 150) targetRt.goodSamples = targetRt.goodSamples.slice(-150);
        targetRt.sessionSamples.push({ ms: val, failed: false, elapsedSec, time: timeStr, timestamp: sampleTs });
      } else {
        targetRt.sessionSamples.push({ ms: 0, failed: true, elapsedSec, time: timeStr, timestamp: sampleTs });
      }

      // Retain trailing 90s / max 150 points for uniform 60s sparkline coverage
      const cutoff = sampleTs - 90000;
      targetRt.sessionSamples = targetRt.sessionSamples
        .filter(s => s.timestamp >= cutoff)
        .slice(-150);

      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
      targetRt.noWebResponseHttps =
        effectiveMode === 'device' &&
        isHttpsPage &&
        isHttpOnlyOrNonWebTarget(srv.host, cleanHost) &&
        targetRt.packetsReceived === 0;
    };

    try {
      if (effectiveMode === 'device') {
        rt.method = 'device-net';

        if (isBurst) {
          let lastAppliedSeq = -1;
          await probeDeviceMultiPacket(srv.host, packetCount, (partial) => {
            if (partial.resolvedIp) rt!.resolvedIp = partial.resolvedIp;
            if (typeof partial.dnsMs === 'number') rt!.dnsMs = partial.dnsMs;
            rt!.dnsError = partial.resolvedIp ? null : (partial.dnsError || null);

            const pkt0 = partial.packets.find(p => p.isConnect || p.seq === 0);
            if (pkt0 && !rt!.hasConnectProbe) {
              rt!.hasConnectProbe = true;
              if (pkt0.status === 'ok' && typeof pkt0.timeMs === 'number') {
                rt!.connectMs = pkt0.timeMs;
              }
            }
            if (typeof partial.connectMs === 'number') {
              rt!.connectMs = partial.connectMs;
            }

            const newCounted = partial.packets.filter(p => !p.isConnect && p.seq > lastAppliedSeq);
            if (newCounted.length === 0) {
              buildAndPushState(
                rt!.packetsSent === 0 ? 'warming...' : (rt!.packets[rt!.packets.length - 1]?.timeMs ?? 'Error'),
                true
              );
              return;
            }

            newCounted.forEach(pkt => {
              lastAppliedSeq = Math.max(lastAppliedSeq, pkt.seq);
              appendPacketSample(pkt, pkt.timestamp || Date.now());
            });

            const lastPkt = newCounted[newCounted.length - 1];
            const displayMs: number | 'Error' =
              lastPkt.status === 'ok' && typeof lastPkt.timeMs === 'number'
                ? Math.round(lastPkt.timeMs * 10) / 10
                : 'Error';
            rt!.lastSampleTime = Date.now();
            rt!.lastError = lastPkt.status === 'ok' ? null : (rt!.noWebResponseHttps ? 'Browsers cannot send ICMP. Use Cloud mode for this host' : 'Request timed out.');
            buildAndPushState(displayMs, true);
          });
          return;
        }

        // Continuous mode (`ping -t`): DoH lookup cached 5 min, max 4 links probing at once
        const dnsRes = await resolveHostIp(cleanHost);
        if (dnsRes.ip) {
          rt.resolvedIp = dnsRes.ip;
          rt.dnsError = null;
        } else {
          rt.dnsError = dnsRes.error || 'DNS lookup failed';
        }
        if (typeof dnsRes.dnsMs === 'number') {
          rt.dnsMs = dnsRes.dnsMs;
        }

        if (!rt.hasConnectProbe) {
          const pkt0 = await devicePingScheduler.run(() =>
            probeSingleDevicePacket(cleanHost, 0, DEVICE_PACKET_TIMEOUT_MS, rt!.resolvedIp)
          );
          rt.hasConnectProbe = true;
          rt.connectMs = pkt0.status === 'ok' && typeof pkt0.timeMs === 'number' ? pkt0.timeMs : null;
          rt.lastSampleTime = Date.now();
          buildAndPushState(rt.packetsSent === 0 ? 'warming...' : (rt.packets[rt.packets.length - 1]?.timeMs ?? 'Error'), true);
          return;
        }

        const nextSeq = rt.packetsSent + 1;
        const pkt = await devicePingScheduler.run(() =>
          probeSingleDevicePacket(cleanHost, nextSeq, DEVICE_PACKET_TIMEOUT_MS, rt!.resolvedIp)
        );
        const nowTs = Date.now();
        rt.lastSampleTime = nowTs;
        appendPacketSample(pkt, nowTs);
        rt.lastError =
          pkt.status === 'ok'
            ? null
            : rt.noWebResponseHttps
              ? 'Browsers cannot send ICMP. Use Cloud mode for this host'
              : 'Request timed out.';

        const displayMs: number | 'Error' =
          pkt.status === 'ok' && typeof pkt.timeMs === 'number'
            ? Math.round(pkt.timeMs * 10) / 10
            : 'Error';
        buildAndPushState(displayMs, false);
        return;
      }

      // Cloud server mode (or same-origin app echo in server mode)
      let probeData: PingProbeResponse;
      const now = Date.now();

      if (isAppServer || isSelfHost(cleanHost)) {
        const echoPackets: ProbePacketDetail[] = [];
        for (let seq = 1; seq <= packetCount; seq++) {
          const t0 = performance.now();
          let ok = true;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            await fetch(`${window.location.origin}/api/ping-echo?_t=${Date.now()}_${seq}`, {
              method: 'HEAD',
              cache: 'no-store',
              signal: controller.signal
            });
            clearTimeout(timer);
          } catch {
            ok = false;
          }
          const dt = Math.round(Math.max(0.1, performance.now() - t0) * 10) / 10;
          echoPackets.push({
            seq,
            bytes: 32,
            ip: window.location.hostname || cleanHost,
            ttl: null,
            timeMs: ok ? dt : null,
            status: ok ? 'ok' : 'timeout',
            error: ok ? undefined : 'Request timed out.',
            timestamp: Date.now()
          });
        }
        const okTimes = echoPackets.filter(p => p.status === 'ok' && typeof p.timeMs === 'number').map(p => p.timeMs as number);
        const avg = okTimes.length > 0 ? Math.round((okTimes.reduce((a, b) => a + b, 0) / okTimes.length) * 10) / 10 : null;
        probeData = {
          host: cleanHost,
          resolvedIp: window.location.hostname || cleanHost,
          dnsMs: 0,
          status: okTimes.length > 0 ? 'online' : 'offline',
          method: 'echo',
          ms: avg ?? 'Error',
          minMs: okTimes.length > 0 ? Math.min(...okTimes) : null,
          avgMs: avg,
          maxMs: okTimes.length > 0 ? Math.max(...okTimes) : null,
          mdevMs: 0,
          jitterMs: 0,
          packetsSent: echoPackets.length,
          packetsReceived: okTimes.length,
          packetsLost: echoPackets.length - okTimes.length,
          packetLoss: Math.round(((echoPackets.length - okTimes.length) / echoPackets.length) * 1000) / 10,
          ttl: null,
          packets: echoPackets
        };
      } else {
        const res = await fetch(
          `/api/network-ping?host=${encodeURIComponent(cleanHost)}&count=${packetCount}`,
          { signal: AbortSignal.timeout(14000) }
        );
        const json = await res.json();
        if (!res.ok && json?.error) {
          probeData = {
            host: cleanHost,
            resolvedIp: null,
            dnsMs: null,
            status: 'offline',
            method: 'failed',
            ms: 'Error',
            minMs: null,
            avgMs: null,
            maxMs: null,
            mdevMs: null,
            jitterMs: null,
            packetsSent: packetCount,
            packetsReceived: 0,
            packetsLost: packetCount,
            packetLoss: 100,
            ttl: null,
            packets: [],
            error: json.error
          };
        } else {
          probeData = json as PingProbeResponse;
        }
      }

      rt.hasConnectProbe = true;
      rt.lastSampleTime = now;
      if (probeData.resolvedIp) {
        rt.resolvedIp = probeData.resolvedIp;
        rt.dnsError = null;
      }
      if (typeof probeData.dnsMs === 'number') rt.dnsMs = probeData.dnsMs;
      if (typeof probeData.ttl === 'number') rt.ttl = probeData.ttl;
      if (probeData.method) rt.method = probeData.method;
      rt.lastError = probeData.error || null;
      rt.noWebResponseHttps = false;

      const incomingPackets: ProbePacketDetail[] =
        Array.isArray(probeData.packets) && probeData.packets.length > 0
          ? probeData.packets
          : [
              {
                seq: 1,
                bytes: 32,
                ip: rt.resolvedIp,
                ttl: rt.ttl,
                timeMs: typeof probeData.avgMs === 'number' ? probeData.avgMs : null,
                status: probeData.status === 'online' ? 'ok' : 'timeout',
                error: probeData.error,
                timestamp: now
              }
            ];

      incomingPackets.forEach(p => {
        appendPacketSample(p, p.timestamp || now);
      });

      const validPacketTimes = incomingPackets
        .filter(p => p.status === 'ok' && typeof p.timeMs === 'number' && p.timeMs >= 0)
        .map(p => p.timeMs as number);

      const displayMs: number | 'Error' =
        validPacketTimes.length === 0
          ? 'Error'
          : Math.round((typeof probeData.avgMs === 'number' ? probeData.avgMs : validPacketTimes[0]) * 10) / 10;

      buildAndPushState(displayMs, isBurst);
    } catch (err: any) {
      rt.lastError = err?.message || 'Probe failed';
      const nowErr = Date.now();
      appendPacketSample(
        {
          seq: rt.packetsSent + 1,
          bytes: null,
          ip: rt.resolvedIp || cleanHost,
          ttl: rt.ttl,
          timeMs: null,
          status: 'timeout',
          error: rt.lastError || 'Request timed out.',
          timestamp: nowErr
        },
        nowErr
      );
      buildAndPushState('Error', true);
    } finally {
      if (isBurst) {
        probingServerIdsRef.current[srv.id] = false;
        setProbingServerIds(prev => ({ ...prev, [srv.id]: false }));
      }
    }
  }, [devicePingScheduler, scheduleStateUpdate]);

  const handleToggleLinkMode = useCallback((srv: ServerTarget) => {
    const current = perLinkModeRef.current[srv.id] || probeModeRef.current;
    const nextMode: 'device' | 'server' = current === 'device' ? 'server' : 'device';
    const nextMap = { ...perLinkModeRef.current, [srv.id]: nextMode };
    perLinkModeRef.current = nextMap;
    setPerLinkMode(nextMap);

    runtimeMapRef.current.delete(srv.id);
    setLiveStates(prev => {
      const next = { ...prev };
      delete next[srv.id];
      return next;
    });

    toast.success(
      `${srv.name}: switched to ${nextMode === 'server' ? 'Cloud server ping' : 'Device HTTP ping (your network)'}`
    );
    void pingServerReal(srv, undefined, nextMode);
  }, [pingServerReal]);

  // Quick Ping runner for instant command bar (e.g. "ping facebook.com")
  const handleQuickPing = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { host, requestedCount } = parsePingInput(quickPingInput);
    if (!host) {
      toast.error('Enter a domain, URL, or ping command (e.g. ping facebook.com)');
      return;
    }

    const count = requestedCount || 4;
    setIsQuickPinging(true);
    try {
      if (probeMode === 'device') {
        let data = await probeDeviceMultiPacket(quickPingInput, count, (partial) => {
          setQuickPingResult(partial);
        });
        if (data.packetsReceived === 0) {
          try {
            const fbRes = await fetch(`/api/network-ping?host=${encodeURIComponent(host)}&count=${count}`, {
              signal: AbortSignal.timeout(8000)
            });
            if (fbRes.ok) {
              const fbJson = await fbRes.json();
              if (fbJson && (fbJson.packetsReceived > 0 || (Array.isArray(fbJson.packets) && fbJson.packets.length > 0))) {
                data = fbJson as PingProbeResponse;
              }
            }
          } catch {}
        }
        setQuickPingResult(data);
      } else {
        const res = await fetch(`/api/network-ping?host=${encodeURIComponent(host)}&count=${count}`, {
          signal: AbortSignal.timeout(14000)
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error || 'Could not ping target');
          setQuickPingResult({
            host,
            resolvedIp: null,
            dnsMs: null,
            status: 'offline',
            method: 'failed',
            ms: 'Error',
            minMs: null,
            avgMs: null,
            maxMs: null,
            mdevMs: null,
            jitterMs: null,
            packetsSent: count,
            packetsReceived: 0,
            packetsLost: count,
            packetLoss: 100,
            ttl: null,
            packets: [],
            error: data?.error || 'Ping failed'
          });
          return;
        }
        setQuickPingResult(data as PingProbeResponse);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network ping request failed');
    } finally {
      setIsQuickPinging(false);
    }
  }, [quickPingInput, probeMode]);

  // Continuous `ping -t` loop: staggered 1000 ms ticks per link, auto-pauses when tab hidden, stops after 5 min
  useEffect(() => {
    if (!isOpen || servers.length === 0 || !isSessionActive) return;

    let isCancelled = false;
    const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const cancellableDelay = (ms: number): Promise<boolean> => {
      return new Promise<boolean>(resolve => {
        if (isCancelled) {
          resolve(false);
          return;
        }
        const timerId = setTimeout(() => {
          activeTimeouts.delete(timerId);
          resolve(!isCancelled);
        }, ms);
        activeTimeouts.add(timerId);
      });
    };

    const runServerLoop = async (srv: ServerTarget, initialDelay: number) => {
      if (initialDelay > 0) {
        const ok = await cancellableDelay(initialDelay);
        if (!ok || isCancelled) return;
      }

      while (!isCancelled) {
        const elapsedSec = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        if (elapsedSec >= SESSION_DURATION_SEC) {
          setIsSessionActive(false);
          setRemainingSeconds(0);
          break;
        }

        if (document.visibilityState === 'hidden') {
          await new Promise<void>(resolve => {
            const onVisible = () => {
              if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', onVisible);
                resolve();
              }
            };
            document.addEventListener('visibilitychange', onVisible);
          });
          if (isCancelled) break;
        }

        const tickStart = performance.now();
        await pingServerReal(srv);

        if (isCancelled) break;
        const linkEffectiveMode = perLinkModeRef.current[srv.id] || probeModeRef.current;
        const targetCadence = linkEffectiveMode === 'device' ? DEVICE_PACKET_INTERVAL_MS : 2500;
        const waitMs = Math.max(50, targetCadence - (performance.now() - tickStart));
        const ok = await cancellableDelay(waitMs);
        if (!ok || isCancelled) break;
      }
    };

    const total = Math.max(1, servers.length);
    servers.forEach((srv, idx) => {
      const staggerDelay = Math.floor((idx * DEVICE_PACKET_INTERVAL_MS) / total);
      runServerLoop(srv, staggerDelay);
    });

    return () => {
      isCancelled = true;
      activeTimeouts.forEach(t => clearTimeout(t));
      activeTimeouts.clear();
    };
  }, [isOpen, servers, isSessionActive, sessionIteration, pingServerReal]);

  // Filtered servers list
  const filteredServers = useMemo(() => {
    return servers.filter(srv => {
      const { displayName, displayHost } = getDisplayHostAndName(srv);
      const q = searchQuery.toLowerCase();
      return (
        srv.name.toLowerCase().includes(q) ||
        srv.host.toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        displayHost.toLowerCase().includes(q)
      );
    });
  }, [servers, searchQuery]);

  // Global summary statistics
  const globalStats = useMemo(() => {
    const allStates: ServerState[] = Object.values(liveStates);
    if (allStates.length === 0 || servers.length === 0) {
      return { total: 0, avgMs: 0, fastCount: 0, totalPackets: 0, lostPackets: 0, lossPct: 0 };
    }
    const validStates = allStates.filter(s => typeof s.currentMs === 'number');
    const totalMs = validStates.reduce((acc, s) => acc + (s.currentMs as number), 0);
    const avgMs = validStates.length > 0 ? Math.round((totalMs / validStates.length) * 10) / 10 : 0;
    const fastCount = validStates.filter(s => s.status === 'excellent' || s.status === 'good').length;
    const totalPackets = allStates.reduce((acc, s) => acc + (s.packetsSent || 0), 0);
    const lostPackets = allStates.reduce((acc, s) => acc + (s.packetsLost || 0), 0);
    const lossPct = totalPackets > 0 ? Math.round((lostPackets / totalPackets) * 1000) / 10 : 0;
    return {
      total: servers.length,
      avgMs,
      fastCount,
      totalPackets,
      lostPackets,
      lossPct
    };
  }, [servers, liveStates]);

  // Helper to add a server directly from quick ping or modal
  const addTargetServerToMonitor = useCallback(async (rawHostOrCmd: string, customName?: string) => {
    const parsed = parsePingInput(rawHostOrCmd);
    const cleanHost = parsed.host;
    if (!cleanHost) {
      toast.error('Please enter a valid Host IP, domain, or ping command');
      return null;
    }

    const finalName = (customName || '').trim() || KNOWN_SITES[cleanHost] || KNOWN_SITES[cleanHost.replace(/^www\./i, '')] || cleanHost;
    const metaJson = JSON.stringify({ name: finalName });
    const creator = user || ({ username: 'Admin', role: 'admin', uid: 'admin-1' } as any);
    const newDbTarget = await supabaseService.createMonitorTarget(cleanHost, creator, metaJson);

    const newSrv: ServerTarget = {
      id: newDbTarget.id,
      name: finalName,
      host: cleanHost
    };

    setServers(prev => [newSrv, ...prev]);
    setExpandedServerIds(prev => ({ ...prev, [newSrv.id]: true }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newSrv, ...servers]));
    } catch {}

    toast.success(`Server "${newSrv.name}" added & probing 4 packets...`);
    void pingServerReal(newSrv, parsed.requestedCount || 4);
    return newSrv;
  }, [pingServerReal, servers, user]);

  // Open Add Modal
  const handleOpenAddModal = useCallback(() => {
    setEditingServer(null);
    setFormName('');
    setFormHost('');
    setIsAddModalOpen(true);
  }, []);

  // Open Edit Modal
  const handleOpenEditModal = useCallback((srv: ServerTarget) => {
    setEditingServer(srv);
    setFormName(srv.name);
    setFormHost(srv.host);
    setIsAddModalOpen(true);
  }, []);

  // Quick Add selection
  const handleSelectQuickSite = (site: { name: string; host: string }) => {
    setFormName(site.name);
    setFormHost(site.host);
  };

  // Host input change with automatic normalization & known-site name detection
  const handleHostInputChange = (val: string) => {
    setFormHost(val);
    const clean = normalizeHost(val);
    const apex = clean.replace(/^(www\.)+/i, '');
    const detected = KNOWN_SITES[clean] || KNOWN_SITES[apex];
    if (detected && (!formName.trim() || Object.values(KNOWN_SITES).includes(formName.trim()))) {
      setFormName(detected);
    }
  };

  // Save Server (Add or Edit) to database
  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePingInput(formHost);
    const cleanHost = parsed.host;
    if (!cleanHost) {
      toast.error('Please enter a valid Host IP, domain, or ping command');
      return;
    }

    const finalName = formName.trim() || KNOWN_SITES[cleanHost] || KNOWN_SITES[cleanHost.replace(/^www\./i, '')] || cleanHost;

    setIsSaving(true);
    try {
      const metaJson = JSON.stringify({
        name: finalName
      });

      if (editingServer) {
        await supabaseService.updateMonitorTarget(editingServer.id, {
          domain: cleanHost,
          label: metaJson
        });

        const updatedSrv = {
          ...editingServer,
          name: finalName,
          host: cleanHost
        };
        setServers(prev => prev.map(s => (s.id === editingServer.id ? updatedSrv : s)));
        toast.success(`Server "${finalName}" updated in database.`);
        void pingServerReal(updatedSrv, parsed.requestedCount || 4);
      } else {
        await addTargetServerToMonitor(formHost, finalName);
      }

      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save server to database:', err);
      toast.error(`Database error: ${err.message || 'Could not save server'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Server from database
  const handleConfirmDelete = async () => {
    if (!serverToDelete) return;
    try {
      await supabaseService.deleteMonitorTarget(serverToDelete.id);
      const updated = servers.filter(s => s.id !== serverToDelete.id);
      setServers(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      toast.success(`Server "${serverToDelete.name}" removed from database.`);
    } catch (err: any) {
      toast.error(`Failed to delete server: ${err.message || 'Unknown database error'}`);
    } finally {
      setServerToDelete(null);
    }
  };

  // Copy IP to Clipboard
  const handleCopyHost = useCallback((host: string) => {
    navigator.clipboard.writeText(host);
    setCopiedHost(host);
    toast.success(`Copied "${host}" to clipboard`);
    setTimeout(() => setCopiedHost(null), 2000);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] w-screen h-[100dvh] max-h-[100dvh] h-dvh-fallback bg-slate-100/90 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs group"
            title="Return to Dashboard"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Activity size={20} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Global Latency & Packet Diagnostics
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500", !isTabHidden && isSessionActive && "animate-ping")} />
                  {probeMode === 'device' ? 'Device HTTP ping (your network)' : 'Cloud server ping'}
                </span>
                {isTabHidden && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                    Paused (tab hidden)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {probeMode === 'device'
                  ? 'Sequential 1s HTTPS HEAD probes & DoH IP lookup from your own device network (CMD ping -t style).'
                  : 'Cloud server-side ICMP & TCP RTT, DNS lookup, TTL, jitter, and per-packet loss tracking.'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Actions: Mode Toggle, Countdown, Restart and Add Server Buttons */}
        <div className="flex items-center gap-3">
          {/* Probe Mode Selector: Device Internet (PC) vs Cloud Server */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
            <button
              type="button"
              onClick={() => handleToggleMode('device')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black uppercase text-[11px] transition-all cursor-pointer whitespace-nowrap",
                probeMode === 'device'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Ping directly through this PC's internet connection (same as Windows CMD ping)"
            >
              <Laptop size={13} />
              <span>Device Net (PC)</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode('server')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black uppercase text-[11px] transition-all cursor-pointer whitespace-nowrap",
                probeMode === 'server'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="Ping via cloud server VPS node"
            >
              <Wifi size={13} />
              <span>Cloud Server</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className={cn(
              "px-3 py-1.5 rounded-xl border font-mono tabular-nums text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors",
              isSessionActive
                ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
            )}>
              <Clock size={13} className={isSessionActive ? "text-emerald-600 dark:text-emerald-400 animate-pulse" : "text-amber-500"} />
              <span>{isSessionActive ? `Session: ${formatCountdown(remainingSeconds)}` : 'Stopped (5:00)'}</span>
            </div>

            <button
              onClick={handleRestartSession}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              title="Restart 5-minute session and clear in-memory chart history"
            >
              <RefreshCw size={13} className={!isSessionActive ? "animate-spin text-emerald-500" : ""} />
              <span>Restart</span>
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer group whitespace-nowrap shrink-0"
          >
            <Plus size={16} className="text-white group-hover:rotate-90 transition-transform" />
            <span>Add Server</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        className="flex-1 w-full max-w-[1720px] mx-auto p-5 md:p-6 flex flex-col gap-5 overflow-y-auto no-scrollbar"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Top 4 Global Statistics Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Monitored Targets</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">{globalStats.total} Servers</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Synced with Database</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Server size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Average Probe RTT</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
                {globalStats.total > 0 && globalStats.avgMs > 0 ? `${formatMs(globalStats.avgMs)} ms` : '—'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 truncate">
                {probeMode === 'device' ? 'Device HTTP ping (your network)' : 'Cloud server ping'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Zap size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Session Packets</p>
              <h3 className="text-2xl font-black text-teal-600 dark:text-cyan-400 font-mono tabular-nums mt-1">
                {globalStats.totalPackets > 0 ? `${globalStats.totalPackets - globalStats.lostPackets}/${globalStats.totalPackets}` : '0'}
              </h3>
              <p className={cn("text-[10px] font-bold mt-0.5", globalStats.lossPct > 0 ? "text-rose-500" : "text-slate-500 dark:text-slate-400")}>
                {globalStats.lossPct}% Packet Loss
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-cyan-500/10 border border-teal-100 dark:border-cyan-500/20 flex items-center justify-center text-teal-600 dark:text-cyan-400">
              <ShieldCheck size={22} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Session Sampling</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
                {isSessionActive ? formatCountdown(remainingSeconds) : 'Finished'}
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                {isSessionActive ? `${globalStats.fastCount} healthy nodes` : 'Stopped after 5 min'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock size={22} />
            </div>
          </div>
        </section>

        {/* Quick Domain Ping Command & Search Bar */}
        <section className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-3.5 rounded-2xl shadow-xs space-y-3 shrink-0">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Quick Ping Domain / Command Input */}
            <form onSubmit={handleQuickPing} className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Terminal size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
                <input
                  type="text"
                  placeholder={probeMode === 'device' ? "Ping from your device network: e.g. ping facebook.com, youtube.com, or 1.1.1.1" : "Check server latency: e.g. ping facebook.com, youtube.com, or 1.1.1.1"}
                  value={quickPingInput}
                  onChange={e => setQuickPingInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-28 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                />
                {normalizeHost(quickPingInput) && (
                  <span className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[110px]">
                    {normalizeHost(quickPingInput)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={isQuickPinging}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <RefreshCw size={13} className={isQuickPinging ? "animate-spin" : ""} />
                  <span>{isQuickPinging ? 'Pinging...' : 'Ping 4 Packets'}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const clean = normalizeHost(quickPingInput);
                    if (!clean) {
                      toast.error('Enter a domain or ping command first (e.g. ping facebook.com)');
                      return;
                    }
                    try {
                      await addTargetServerToMonitor(quickPingInput);
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to add server');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus size={14} />
                  <span>Save Target</span>
                </button>
              </div>
            </form>

            {/* Existing Server Filter */}
            <div className="relative w-full lg:w-64 shrink-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter monitored servers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Instant Multi-Packet Quick Ping Result Panel */}
          {quickPingResult && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                  <span
                    className={cn(
                      "font-black uppercase",
                      quickPingResult.noWebResponseHttps
                        ? "text-amber-600 dark:text-amber-400"
                        : quickPingResult.status === 'online'
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                    )}
                    title={quickPingResult.noWebResponseHttps ? 'Browsers cannot send ICMP. Use Cloud mode for this host' : undefined}
                  >
                    {quickPingResult.noWebResponseHttps
                      ? `No web response (HTTPS): ${quickPingResult.host}`
                      : `PING ${quickPingResult.host}`}
                  </span>
                  {quickPingResult.resolvedIp && (
                    <span className="text-slate-500 dark:text-slate-400">({quickPingResult.resolvedIp})</span>
                  )}
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">
                    {quickPingResult.packetsSent} transmitted, {quickPingResult.packetsReceived} received,{' '}
                    <span className={quickPingResult.packetLoss > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}>
                      {quickPingResult.packetLoss}% packet loss
                    </span>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatMethodLabel(quickPingResult.method)}
                    {typeof quickPingResult.connectMs === 'number' ? ` · Connect: ${formatMs(quickPingResult.connectMs)} ms` : ''}
                    {typeof quickPingResult.ttl === 'number' ? ` · TTL ${quickPingResult.ttl}` : ''}
                    {typeof quickPingResult.dnsMs === 'number' ? ` · DNS ${formatMs(quickPingResult.dnsMs)} ms` : ''}
                  </span>
                </div>
                <button
                  onClick={() => setQuickPingResult(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title="Close quick ping result"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Min RTT</p>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">{formatMs(quickPingResult.minMs)} ms</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Avg RTT</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatMs(quickPingResult.avgMs)} ms</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Max RTT</p>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">{formatMs(quickPingResult.maxMs)} ms</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Jitter</p>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">{formatMs(quickPingResult.jitterMs)} ms</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">StdDev (mdev)</p>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">{formatMs(quickPingResult.mdevMs)} ms</p>
                </div>
              </div>

              {quickPingResult.error && (
                <p className={cn("text-xs font-mono", quickPingResult.noWebResponseHttps ? "text-amber-600 dark:text-amber-400" : "text-rose-500")}>
                  {quickPingResult.error}
                </p>
              )}

              {quickPingResult.packets.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/60">
                  <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-2 px-3">Seq</th>
                        <th className="py-2 px-3">Resolved IP</th>
                        <th className="py-2 px-3">Size</th>
                        <th className="py-2 px-3">TTL</th>
                        <th className="py-2 px-3">Time</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                      {quickPingResult.packets.map(pkt => (
                        <tr key={pkt.seq}>
                          <td className="py-1.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                            {pkt.isConnect ? 'Connect' : `#${pkt.seq}`}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{pkt.ip || quickPingResult.resolvedIp || quickPingResult.host}</td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{pkt.bytes ? `${pkt.bytes} bytes` : '—'}</td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{typeof pkt.ttl === 'number' ? pkt.ttl : 'n/a'}</td>
                          <td className={cn("py-1.5 px-3 font-black", pkt.status === 'ok' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                            {typeof pkt.timeMs === 'number' ? `${formatMs(pkt.timeMs)} ms` : 'Request timed out.'}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className={cn("font-bold", pkt.status === 'ok' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
                              {pkt.isConnect ? (pkt.status === 'ok' ? 'Connect (excluded)' : 'Connect timed out') : (pkt.status === 'ok' ? 'Reply OK' : (pkt.error || 'Request timed out.'))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Single-Column Equal-Width Rows List of Servers */}
        <section className="flex-1 flex flex-col gap-3 pb-8">
          {showServersSkeleton ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkServerCardRow key={i} />
              ))}
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <Server size={32} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  No Monitored Servers Found
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mt-1">
                  Add any domain, link, or ping command (e.g. <code>ping facebook.com</code>, <code>google.com</code>, <code>1.1.1.1</code>) to inspect accurate RTT ms and packet telemetry.
                </p>
              </div>
              <button
                onClick={handleOpenAddModal}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer mt-2"
              >
                <Plus size={16} />
                <span>Add Your First Server</span>
              </button>
            </div>
          ) : (() => {
            const renderCard = (srv: ServerTarget, idx: number) => {
              const effectiveLinkMode = perLinkMode[srv.id] || probeMode;
              const state: ServerState = liveStates[srv.id] || {
                currentMs: 'warming...',
                status: 'good',
                history: [],
                minMs: 0,
                maxMs: 0,
                avgMs: 0,
                mdevMs: 0,
                jitter: 0,
                packetLoss: 0,
                packetsSent: 0,
                packetsReceived: 0,
                packetsLost: 0,
                packets: [],
                linkMode: effectiveLinkMode,
                lastUpdated: Date.now(),
                yMax: 40
              };

              return (
                <ServerCard
                  key={srv.id}
                  srv={srv}
                  state={state}
                  copiedHost={copiedHost}
                  idx={idx}
                  isSessionActive={isSessionActive}
                  isExpanded={Boolean(expandedServerIds[srv.id])}
                  isProbing={Boolean(probingServerIds[srv.id])}
                  linkMode={effectiveLinkMode}
                  windowEndMs={windowEndMs}
                  onToggleExpand={toggleServerExpand}
                  onToggleLinkMode={handleToggleLinkMode}
                  onRestart={handleRestartSession}
                  onCopyHost={handleCopyHost}
                  onPing={pingServerReal}
                  onEdit={handleOpenEditModal}
                  onDelete={setServerToDelete}
                />
              );
            };

            return (
              <>
                {filteredServers.slice(0, 2).map((srv, idx) => renderCard(srv, idx))}
                {filteredServers.length > 2 && (
                  <LazySection
                    mode="visible"
                    className="flex flex-col gap-3"
                    fallback={
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: Math.min(3, filteredServers.length - 2) }).map((_, i) => (
                          <SkServerCardRow key={i} />
                        ))}
                      </div>
                    }
                  >
                    {filteredServers.slice(2).map((srv, idx) => renderCard(srv, idx + 2))}
                  </LazySection>
                )}
              </>
            );
          })()}
        </section>
      </main>

      {/* Add / Edit Server Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 z-[10010] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              {...dialogMotion}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 transform-gpu will-change-transform"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Server size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {editingServer ? 'Edit Monitored Server' : 'Add New Target Server'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <DeferredBody
                fallback={
                  <div className="space-y-4 min-h-[290px]">
                    <div>
                      <SkBar w="w-36" h="h-3 mb-2" />
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <SkBar key={i} w="w-20" h="h-7" rounded="rounded-lg" />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3 pt-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-1">
                          <SkBar w="w-24" h="h-2.5" />
                          <SkBar w="w-full" h="h-10" rounded="rounded-xl" />
                        </div>
                      ))}
                    </div>
                  </div>
                }
              >
              {/* Quick Add Chips */}
              {!editingServer && (
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-2">
                    Quick Add Popular Sites
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ADD_SITES.map(item => (
                      <button
                        key={item.host}
                        type="button"
                        onClick={() => handleSelectQuickSite(item)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                          normalizeHost(formHost) === normalizeHost(item.host)
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10"
                        )}
                      >
                        <img
                          src={getRealLogoUrl(item.host)}
                          alt=""
                          width={14}
                          height={14}
                          className="w-3.5 h-3.5 rounded object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveServer} className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                    Target Domain, Ping Command, or IP
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ping facebook.com, google.com, or 1.1.1.1"
                    value={formHost}
                    onChange={e => handleHostInputChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {normalizeHost(formHost)
                      ? `Normalized target: ${normalizeHost(formHost)}`
                      : 'Accepts ping commands (ping facebook.com), URLs, domains, or public IPs.'}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Google Primary, TikTok CDN"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingServer ? 'Save Changes' : 'Add Target Server'}</span>
                    )}
                  </button>
                </div>
              </form>
              </DeferredBody>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {serverToDelete && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 z-[10020] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              {...dialogMotion}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 transform-gpu will-change-transform"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Remove Server?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Are you sure you want to remove <strong>{serverToDelete.name}</strong> from monitoring?
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setServerToDelete(null)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
