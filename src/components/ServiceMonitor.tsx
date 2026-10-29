import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Activity,
  Plus,
  Server,
  Globe,
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
  Clock
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Bar,
  ResponsiveContainer,
  YAxis,
  Tooltip,
  XAxis,
  CartesianGrid
} from 'recharts';
import { cn } from '../lib/utils';
import { UserProfile, MonitorTarget } from '../types';
import { supabaseService } from '../lib/supabaseService';
import { toast } from 'sonner';

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
  ms: number | null;
  failed: boolean;
  failTick?: number;
  isLastPoint?: boolean;
}

export interface ServerState {
  currentMs: number | 'Error' | 'warming...';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  history: LatencyPoint[];
  minMs: number;
  maxMs: number;
  avgMs: number;
  jitter?: number;
  packetLoss: number;
  lastUpdated: number;
  method?: string;
  vpsPingMs?: number | null;
  yMax: number;
}

interface ServiceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

const STORAGE_KEY = 'gts_server_monitor_user_targets_v5';
const ENDPOINT_CACHE_KEY = 'gts_ping_endpoint_cache_v2';
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

// Normalize any user-pasted input to clean hostname (strip protocol, path, query, port)
export function normalizeHost(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/^[a-zA-Z]+:\/\//i, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  s = s.split(':')[0];
  s = s.trim().toLowerCase();
  s = s.replace(/\.+$/, '');
  return s;
}

// Check if target is app's own host or local/VPS origin
export function isSelfHost(host: string): boolean {
  const clean = normalizeHost(host);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  return (
    clean === '167.233.41.7' ||
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    Boolean(currentHost && (clean === currentHost || currentHost.includes(clean) || clean.includes(currentHost)))
  );
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
        onError={() => setHasError(true)}
        className="w-full h-full object-contain rounded-lg drop-shadow-sm"
        loading="lazy"
      />
    </div>
  );
};

// Custom Tooltip component
const CustomHeartbeatTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const pt = payload[0]?.payload as LatencyPoint;
    if (!pt) return null;
    const isFailed = pt.failed || pt.ms === null;
    const mins = Math.floor(pt.elapsedSec / 60);
    const secs = pt.elapsedSec % 60;
    const elapsedLabel = `${mins}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 px-2.5 py-1.5 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none text-xs font-mono">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
          {elapsedLabel} ({pt.time})
        </span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        {isFailed ? (
          <span className="text-rose-500 font-black">Failed</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-black">{pt.ms} ms</span>
        )}
      </div>
    );
  }
  return null;
};

// Cached endpoint helpers
function getCachedEndpoint(host: string): string | null {
  try {
    const raw = localStorage.getItem(ENDPOINT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed[host] === 'string') {
        return parsed[host];
      }
    }
  } catch {}
  return null;
}

function setCachedEndpoint(host: string, endpoint: string): void {
  try {
    const raw = localStorage.getItem(ENDPOINT_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[host] = endpoint;
    localStorage.setItem(ENDPOINT_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

function clearCachedEndpoint(host: string): void {
  try {
    const raw = localStorage.getItem(ENDPOINT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed[host];
      localStorage.setItem(ENDPOINT_CACHE_KEY, JSON.stringify(parsed));
    }
  } catch {}
}

// Discover candidate endpoint for host
async function discoverEndpoint(cleanHost: string, forceRefresh = false): Promise<string> {
  if (isSelfHost(cleanHost)) {
    return `${window.location.origin}/api/ping-echo`;
  }

  if (!forceRefresh) {
    const cached = getCachedEndpoint(cleanHost);
    if (cached) return cached;
  }

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) || cleanHost.includes(':');
  const candidateHosts: string[] = [];

  if (isIp) {
    candidateHosts.push(cleanHost);
  } else {
    if (cleanHost.startsWith('www.')) {
      candidateHosts.push(cleanHost);
      candidateHosts.push(cleanHost.replace(/^www\./, ''));
    } else {
      candidateHosts.push(`www.${cleanHost}`);
      candidateHosts.push(cleanHost);
    }
  }

  const candidatePaths = ['/generate_204', '/favicon.ico', '/robots.txt', '/'];
  const candidates: string[] = [];

  for (const path of candidatePaths) {
    for (const h of candidateHosts) {
      const u = `https://${h}${path}`;
      if (!candidates.includes(u)) candidates.push(u);
    }
  }

  for (const candUrl of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(candUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'omit',
        signal: controller.signal
      });
      clearTimeout(timer);
      setCachedEndpoint(cleanHost, candUrl);
      return candUrl;
    } catch {
      clearTimeout(timer);
    }
  }

  const fallback = `https://${candidateHosts[0]}/favicon.ico`;
  setCachedEndpoint(cleanHost, fallback);
  return fallback;
}

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

// Memoized Server Card Component
const ServerCard = React.memo<{
  srv: ServerTarget;
  state: ServerState;
  copiedHost: string | null;
  idx: number;
  isSessionActive: boolean;
  onRestart: () => void;
  onCopyHost: (host: string) => void;
  onPing: (srv: ServerTarget) => void;
  onEdit: (srv: ServerTarget) => void;
  onDelete: (srv: ServerTarget) => void;
}>(function ServerCard({
  srv,
  state,
  copiedHost,
  idx,
  isSessionActive,
  onRestart,
  onCopyHost,
  onPing,
  onEdit,
  onDelete
}) {
  const statusColors = {
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

  // Chart data: identify the last valid point for drawing single dot
  const chartData = useMemo(() => {
    let lastValidIdx = -1;
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (typeof state.history[i].ms === 'number') {
        lastValidIdx = i;
        break;
      }
    }
    return state.history.map((pt, i) => ({
      ...pt,
      isLastPoint: i === lastValidIdx
    }));
  }, [state.history]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
      className="w-full bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/90 dark:border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition-all duration-300 shadow-xs hover:shadow-md group flex flex-col xl:flex-row items-stretch xl:items-center gap-4 relative overflow-hidden"
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
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider transition-all shadow-xs flex items-center gap-1 cursor-pointer ml-1"
            >
              <RefreshCw size={12} />
              <span>Restart</span>
            </button>
          </div>
        </div>
      )}

      {/* Left Block: Identity & Logo */}
      <div className="flex items-center gap-3.5 min-w-[240px] max-w-[300px] shrink-0">
        <div className="relative shrink-0">
          <ServerLogo host={displayHost} name={displayName} />
          <span className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900", statusColors.dot, "animate-pulse")} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight uppercase" title={displayName}>
              {displayName}
            </h4>
            {/* Separate VPS badge: NOT pushed into history or main ms */}
            {typeof state.vpsPingMs === 'number' && state.vpsPingMs > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0 cursor-help"
                title="measured from the server, not from your device"
              >
                VPS to host: {state.vpsPingMs} ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/5 truncate max-w-[190px]">
              {displayHost}
            </span>
            <button
              onClick={() => onCopyHost(displayHost)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              title="Copy Host"
            >
              {copiedHost === displayHost ? (
                <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Middle Left: Live Real MS Counter */}
      <div className="flex items-center gap-3 min-w-[170px] shrink-0 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/5 rounded-xl px-3.5 py-2">
        <div>
          <div className="flex items-baseline gap-1">
            {isWarming ? (
              <span className="text-xs font-black font-mono tracking-tight text-amber-500 animate-pulse">
                warming...
              </span>
            ) : (
              <>
                <span className={cn("text-2xl font-black font-mono tracking-tight", statusColors.text)}>
                  {state.currentMs}
                </span>
                {typeof state.currentMs === 'number' && (
                  <span className="text-[10px] font-black uppercase text-slate-400">ms</span>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[9px] text-slate-400 font-mono font-bold mt-0.5">
            <span>Min: {state.minMs}</span>
            <span>•</span>
            <span>Avg: {state.avgMs}</span>
            <span>•</span>
            <span>Max: {state.maxMs}</span>
            {typeof state.jitter === 'number' && state.jitter > 0 && (
              <>
                <span>•</span>
                <span>Jitter: {state.jitter}ms</span>
              </>
            )}
            {typeof state.packetLoss === 'number' && (
              <>
                <span>•</span>
                <span className={state.packetLoss > 0 ? "text-rose-500 dark:text-rose-400 font-black" : ""}>
                  Loss: {state.packetLoss}%
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className={cn(
            "ml-auto px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shrink-0",
            statusColors.bg,
            statusColors.text,
            statusColors.border
          )}
        >
          {state.status}
        </span>
      </div>

      {/* Requirement 5: Small Landscape Frame (~72-78px high) Fixed X-Axis 5-min Window */}
      <div className="flex-1 h-[76px] w-full min-w-[260px] bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200/70 dark:border-white/5 rounded-xl p-1 relative overflow-hidden flex flex-col justify-end">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50} initialDimension={{ width: 300, height: 76 }} debounce={100}>
          <ComposedChart
            data={chartData}
            margin={{ top: 6, right: 12, left: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`gradient-${srv.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              vertical={false}
              stroke="rgba(148, 163, 184, 0.12)"
            />
            {/* Stable Y-Axis updated at most every 10s */}
            <YAxis
              hide
              domain={[0, state.yMax || 40]}
            />
            {/* Fixed 5-minute X-Axis: 0 to 300 seconds */}
            <XAxis
              dataKey="elapsedSec"
              type="number"
              domain={[0, 300]}
              ticks={[0, 150, 300]}
              tickFormatter={(sec: number) => {
                if (sec === 0) return '0:00';
                if (sec === 150) return '2:30';
                if (sec === 300) return '5:00';
                return '';
              }}
              tickLine={false}
              axisLine={false}
              height={14}
              tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}
            />
            <Tooltip content={<CustomHeartbeatTooltip />} />
            {/* Smooth line with soft gradient, only last point has dot */}
            <Area
              type="monotone"
              dataKey="ms"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#gradient-${srv.id})`}
              connectNulls={false}
              isAnimationActive={false}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload && payload.isLastPoint && typeof payload.ms === 'number' && cx !== undefined && cy !== undefined) {
                  return (
                    <circle
                      key={`dot-${payload.elapsedSec}`}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="#ffffff"
                      className="drop-shadow-sm"
                    />
                  );
                }
                return null;
              }}
              activeDot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            />
            {/* Failed probes plotted as small red ticks at the bottom */}
            <Bar
              dataKey="failTick"
              fill="#f43f5e"
              barSize={3}
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Right Actions: Test, Edit and Delete Buttons */}
      <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
        <button
          onClick={() => onPing(srv)}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs group/btn"
          title="Test Latency"
        >
          <RefreshCw size={15} className="group-hover/btn:rotate-180 transition-transform text-emerald-600 dark:text-emerald-400" />
        </button>
        <button
          onClick={() => onEdit(srv)}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs group/btn"
          title="Edit Server"
        >
          <Edit2 size={15} className="group-hover/btn:scale-110 transition-transform text-teal-600 dark:text-teal-400" />
        </button>
        <button
          onClick={() => onDelete(srv)}
          className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-all cursor-pointer shadow-xs group/btn"
          title="Delete Server"
        >
          <Trash2 size={15} className="group-hover/btn:scale-110 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.srv === nextProps.srv &&
    prevProps.state === nextProps.state &&
    prevProps.copiedHost === nextProps.copiedHost &&
    prevProps.isSessionActive === nextProps.isSessionActive &&
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

  const [, setIsLoadingFromDb] = useState(true);

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

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHost, setCopiedHost] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerTarget | null>(null);
  const [serverToDelete, setServerToDelete] = useState<ServerTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');

  // Per-server runtime statistics & sample history
  const runtimeMapRef = useRef<Map<string, {
    endpoint: string | null;
    consecutiveFailures: number;
    hasHadFirstSuccess: boolean;
    lastSampleTime: number;
    needsWarmup: boolean;
    sessionSamples: { ms: number; failed: boolean; elapsedSec: number; time: string }[];
    goodSamples: number[];
    lastJitter: number;
    vpsPingMs: number | null;
    currentYMax: number;
    lastYMaxUpdate: number;
  }>>(new Map());

  // Performance batching & throttling refs
  const pendingUpdatesRef = useRef<Map<string, ServerState>>(new Map());
  const lastRenderedRef = useRef<Map<string, { ms: number | string; lastPushed: number }>>(new Map());
  const batchRafRef = useRef<number | null>(null);
  const totalSamplesCounterRef = useRef(0);

  // Global tab visibility warmup handler
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runtimeMapRef.current.forEach(rt => {
          rt.needsWarmup = true;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Batched state updater
  const scheduleStateUpdate = useCallback((srvId: string, newState: ServerState) => {
    const now = Date.now();
    const last = lastRenderedRef.current.get(srvId);

    let shouldUpdate = false;
    if (!last) {
      shouldUpdate = true;
    } else if (typeof newState.currentMs !== typeof last.ms) {
      shouldUpdate = true;
    } else if (typeof newState.currentMs === 'number' && typeof last.ms === 'number') {
      if (Math.abs(newState.currentMs - last.ms) >= 1 || (now - last.lastPushed >= 3000)) {
        shouldUpdate = true;
      }
    } else if (newState.currentMs !== last.ms) {
      shouldUpdate = true;
    } else if (now - last.lastPushed >= 3000) {
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      pendingUpdatesRef.current.set(srvId, newState);
      lastRenderedRef.current.set(srvId, { ms: newState.currentMs, lastPushed: now });

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

  // Ping single server: real latency only (t1 - t0)
  const pingServerReal = useCallback(async (srv: ServerTarget) => {
    const cleanHost = normalizeHost(srv.host);
    if (!cleanHost) return;

    let rt = runtimeMapRef.current.get(srv.id);
    if (!rt) {
      rt = {
        endpoint: null,
        consecutiveFailures: 0,
        hasHadFirstSuccess: false,
        lastSampleTime: 0,
        needsWarmup: false,
        sessionSamples: [],
        goodSamples: [],
        lastJitter: 0,
        vpsPingMs: null,
        currentYMax: 40,
        lastYMaxUpdate: 0
      };
      runtimeMapRef.current.set(srv.id, rt);
    }

    // Requirement 3: If own server entry, probe ${window.location.origin}/api/ping-echo
    const { isAppServer } = getDisplayHostAndName(srv);
    let endpoint: string;
    if (isAppServer || isSelfHost(cleanHost)) {
      endpoint = `${window.location.origin}/api/ping-echo`;
    } else {
      const shouldRediscover = rt.consecutiveFailures >= 3 || !rt.endpoint;
      if (shouldRediscover) {
        clearCachedEndpoint(cleanHost);
      }
      endpoint = await discoverEndpoint(cleanHost, shouldRediscover);
    }
    rt.endpoint = endpoint;

    const now = Date.now();
    const elapsedSec = Math.min(SESSION_DURATION_SEC, Math.max(0, Math.floor((now - sessionStartTimeRef.current) / 1000)));
    const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullUrl = `${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${now}_${Math.random().toString(36).slice(2, 7)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    // Requirement 1: Real latency only: full round trip t1 - t0 around fetch
    const t0 = performance.now();
    let failed = false;

    try {
      await fetch(fullUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'omit',
        signal: controller.signal
      });
    } catch {
      failed = true;
    } finally {
      clearTimeout(timer);
    }

    const t1 = performance.now();
    let sampleMs = Math.round(t1 - t0);
    if (sampleMs < 1) sampleMs = 1;

    // Clear resource timings periodically to prevent memory buildup
    totalSamplesCounterRef.current++;
    if (totalSamplesCounterRef.current % 100 === 0) {
      try {
        performance.clearResourceTimings();
      } catch {}
    }

    // Requirement 5: Y-axis stable domain updated at most every 10 seconds
    if (!rt.currentYMax || (now - rt.lastYMaxUpdate >= 10000)) {
      const p95 = calculateP95(rt.goodSamples);
      rt.currentYMax = Math.max(40, Math.round(p95 * 1.3));
      rt.lastYMaxUpdate = now;
    }

    if (failed) {
      rt.consecutiveFailures++;
      rt.needsWarmup = true;

      // Failed probe added to session history (max 100 points)
      rt.sessionSamples.push({ ms: 0, failed: true, elapsedSec, time: timeStr });
      if (rt.sessionSamples.length > 100) rt.sessionSamples.shift();

      // Requirement 2: Optional VPS ping test after 3 consecutive failures
      // Server-side number is NOT pushed into history, min/avg/max or currentMs
      if (rt.consecutiveFailures >= 3 && !isAppServer) {
        clearCachedEndpoint(cleanHost);
        fetch(`/api/network-ping?host=${encodeURIComponent(cleanHost)}`, {
          signal: AbortSignal.timeout(2500)
        }).then(r => r.json()).then(data => {
          if (data && typeof data.ms === 'number' && !isNaN(data.ms) && data.ms > 0) {
            rt.vpsPingMs = Math.round(data.ms);
          }
        }).catch(() => {});
      }

      const totalAttempts = rt.sessionSamples.length;
      const failedAttempts = rt.sessionSamples.filter(s => s.failed).length;
      const packetLoss = totalAttempts > 0 ? Math.round((failedAttempts / totalAttempts) * 100) : 100;

      // History with failed probes represented by small red ticks at bottom
      const failTickHeight = Math.round(rt.currentYMax * 0.08);
      const history: LatencyPoint[] = rt.sessionSamples.map(s => ({
        time: s.time,
        elapsedSec: s.elapsedSec,
        ms: s.failed ? null : s.ms,
        failed: s.failed,
        failTick: s.failed ? failTickHeight : undefined
      }));

      scheduleStateUpdate(srv.id, {
        currentMs: 'Error',
        status: 'offline',
        history,
        minMs: rt.goodSamples.length > 0 ? Math.min(...rt.goodSamples) : 0,
        maxMs: rt.goodSamples.length > 0 ? Math.max(...rt.goodSamples) : 0,
        avgMs: rt.goodSamples.length > 0 ? Math.round(rt.goodSamples.reduce((a, b) => a + b, 0) / rt.goodSamples.length) : 0,
        jitter: rt.lastJitter,
        packetLoss,
        lastUpdated: now,
        method: 'failed',
        vpsPingMs: rt.vpsPingMs,
        yMax: rt.currentYMax
      });
      return;
    }

    // Success: reset failures
    rt.consecutiveFailures = 0;

    // Requirement 1: Keep warm-up logic
    const idleTooLong = rt.lastSampleTime > 0 && (now - rt.lastSampleTime) > 30000;
    const isWarmup = !rt.hasHadFirstSuccess || rt.needsWarmup || idleTooLong;
    rt.lastSampleTime = now;

    if (isWarmup) {
      rt.hasHadFirstSuccess = true;
      rt.needsWarmup = false;

      const failTickHeight = Math.round(rt.currentYMax * 0.08);
      const history: LatencyPoint[] = rt.sessionSamples.map(s => ({
        time: s.time,
        elapsedSec: s.elapsedSec,
        ms: s.failed ? null : s.ms,
        failed: s.failed,
        failTick: s.failed ? failTickHeight : undefined
      }));

      scheduleStateUpdate(srv.id, {
        currentMs: 'warming...',
        status: 'good',
        history,
        minMs: rt.goodSamples.length > 0 ? Math.min(...rt.goodSamples) : 0,
        maxMs: rt.goodSamples.length > 0 ? Math.max(...rt.goodSamples) : 0,
        avgMs: rt.goodSamples.length > 0 ? Math.round(rt.goodSamples.reduce((a, b) => a + b, 0) / rt.goodSamples.length) : 0,
        jitter: rt.lastJitter,
        packetLoss: rt.sessionSamples.length > 0 ? Math.round((rt.sessionSamples.filter(s => s.failed).length / rt.sessionSamples.length) * 100) : 0,
        lastUpdated: now,
        method: 'performance-now',
        vpsPingMs: rt.vpsPingMs,
        yMax: rt.currentYMax
      });
      return;
    }

    // Push into session samples (max 100 points for 5 minutes)
    rt.sessionSamples.push({ ms: sampleMs, failed: false, elapsedSec, time: timeStr });
    if (rt.sessionSamples.length > 100) rt.sessionSamples.shift();

    rt.goodSamples.push(sampleMs);
    if (rt.goodSamples.length > 100) rt.goodSamples.shift();

    // Median of last 5 samples for responsive, stable display
    const last5 = rt.goodSamples.slice(-5);
    const sorted = [...last5].sort((a, b) => a - b);
    const medianMs = sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);

    const minMs = Math.min(...rt.goodSamples);
    const maxMs = Math.max(...rt.goodSamples);
    const avgMs = Math.round(rt.goodSamples.reduce((a, b) => a + b, 0) / rt.goodSamples.length);

    // Compute Jitter across good samples
    let jitter = 0;
    if (rt.goodSamples.length >= 2) {
      let diffSum = 0;
      for (let i = 1; i < rt.goodSamples.length; i++) {
        diffSum += Math.abs(rt.goodSamples[i] - rt.goodSamples[i - 1]);
      }
      jitter = Math.round(diffSum / (rt.goodSamples.length - 1));
    }
    rt.lastJitter = jitter;

    // Packet Loss over session samples
    const totalAttempts = rt.sessionSamples.length;
    const failedAttempts = rt.sessionSamples.filter(s => s.failed).length;
    const packetLoss = totalAttempts > 0 ? Math.round((failedAttempts / totalAttempts) * 100) : 0;

    // Status thresholds
    let status: ServerState['status'] = 'excellent';
    if (medianMs > 150) status = 'poor';
    else if (medianMs > 80) status = 'fair';
    else if (medianMs > 35) status = 'good';

    const failTickHeight = Math.round(rt.currentYMax * 0.08);
    const history: LatencyPoint[] = rt.sessionSamples.map(s => ({
      time: s.time,
      elapsedSec: s.elapsedSec,
      ms: s.failed ? null : s.ms,
      failed: s.failed,
      failTick: s.failed ? failTickHeight : undefined
    }));

    scheduleStateUpdate(srv.id, {
      currentMs: medianMs,
      status,
      history,
      minMs,
      maxMs,
      avgMs,
      jitter,
      packetLoss,
      lastUpdated: now,
      method: 'performance-now',
      vpsPingMs: rt.vpsPingMs,
      yMax: rt.currentYMax
    });
  }, [scheduleStateUpdate]);

  // Requirement 4: Loop stops completely after 300 seconds (guaranteed no timers left)
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
        // Check session duration limit
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        if (elapsed >= SESSION_DURATION_SEC) {
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

        await pingServerReal(srv);

        if (isCancelled) break;
        const ok = await cancellableDelay(3000);
        if (!ok || isCancelled) break;
      }
    };

    servers.forEach((srv, idx) => {
      runServerLoop(srv, idx * 200);
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
      return { total: 0, avgMs: 0, fastCount: 0, alertCount: 0 };
    }
    const validStates = allStates.filter(s => typeof s.currentMs === 'number');
    const totalMs = validStates.reduce((acc, s) => acc + (s.currentMs as number), 0);
    const avgMs = validStates.length > 0 ? Math.round(totalMs / validStates.length) : 0;
    const fastCount = validStates.filter(s => s.status === 'excellent' || s.status === 'good').length;
    const alertCount = validStates.filter(s => s.status === 'fair' || s.status === 'poor').length;
    return {
      total: servers.length,
      avgMs,
      fastCount,
      alertCount
    };
  }, [servers, liveStates]);

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
    const cleanHost = normalizeHost(formHost);
    if (!cleanHost) {
      toast.error('Please enter a valid Host IP or URL');
      return;
    }

    const finalName = formName.trim() || KNOWN_SITES[cleanHost] || cleanHost;

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

        setServers(prev =>
          prev.map(s =>
            s.id === editingServer.id
              ? {
                  ...s,
                  name: finalName,
                  host: cleanHost
                }
              : s
          )
        );
        toast.success(`Server "${finalName}" updated in database.`);
      } else {
        const creator = user || ({ username: 'Admin', role: 'admin', uid: 'admin-1' } as any);
        const newDbTarget = await supabaseService.createMonitorTarget(
          cleanHost,
          creator,
          metaJson
        );

        const newSrv: ServerTarget = {
          id: newDbTarget.id,
          name: finalName,
          host: cleanHost
        };

        setServers(prev => [newSrv, ...prev]);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([newSrv, ...servers]));
        } catch (err) {}

        toast.success(`Server "${newSrv.name}" saved to database.`);
        pingServerReal(newSrv);
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
      } catch (e) {}
      clearCachedEndpoint(normalizeHost(serverToDelete.host));
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
    <div className="fixed inset-0 z-[10000] w-screen h-screen bg-slate-100/90 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden select-none font-sans">
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
                  Global Latency Matrix & Server Monitor
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Real Browser Latency (t1 - t0)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Live round-trip time measured directly from your device. 5-minute sampling session.
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Actions: Countdown, Restart and Add Server Buttons */}
        <div className="flex items-center gap-3">
          {/* Live 5-minute Session Countdown & Global Restart */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "px-3 py-1.5 rounded-xl border font-mono text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors",
              isSessionActive
                ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
            )}>
              <Clock size={13} className={isSessionActive ? "text-emerald-600 dark:text-emerald-400 animate-pulse" : "text-amber-500"} />
              <span>{isSessionActive ? `Session: ${formatCountdown(remainingSeconds)}` : 'Stopped (5:00)'}</span>
            </div>

            <button
              onClick={handleRestartSession}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Restart 5-minute session and clear in-memory chart history"
            >
              <RefreshCw size={13} className={!isSessionActive ? "animate-spin text-emerald-500" : ""} />
              <span>Restart</span>
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer group"
          >
            <Plus size={16} className="text-white group-hover:rotate-90 transition-transform" />
            <span>Add Server</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-5 md:p-6 flex flex-col gap-5 overflow-y-auto no-scrollbar">
        {/* Top 4 Global Statistics Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {/* Card 1: Total Servers */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Total Monitored Sites</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{globalStats.total} Servers</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Database Synced</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Server size={22} />
            </div>
          </div>

          {/* Card 2: Average Ping */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Real Client Latency</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {globalStats.total > 0 && globalStats.avgMs > 0 ? `${globalStats.avgMs} ms` : '—'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 truncate">
                Median Client Response
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Zap size={22} />
            </div>
          </div>

          {/* Card 3: Optimum Performance Nodes */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Optimal Response Sites</p>
              <h3 className="text-2xl font-black text-teal-600 dark:text-cyan-400 font-mono mt-1">{globalStats.fastCount} Nodes</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">Latency under 80ms</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-cyan-500/10 border border-teal-100 dark:border-cyan-500/20 flex items-center justify-center text-teal-600 dark:text-cyan-400">
              <ShieldCheck size={22} />
            </div>
          </div>

          {/* Card 4: 5-Minute Session Status */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Session Sampling</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                {isSessionActive ? formatCountdown(remainingSeconds) : 'Finished'}
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                {isSessionActive ? '1 sample / 3 sec' : 'Stopped after 5 min'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock size={22} />
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-3 rounded-2xl shadow-xs flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Server Name or IP / URL..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
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
        </section>

        {/* Landscape Rows List of Servers */}
        <section className="flex-1 space-y-3 pb-8">
          {filteredServers.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <Server size={32} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  No Monitored Servers Found
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mt-1">
                  Add any website or IP (e.g. <code>google.com</code>, <code>tiktok.com</code>, <code>1.1.1.1</code>) to measure live HTTP response time from your browser.
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
          ) : (
            filteredServers.map((srv, idx) => {
              const state = liveStates[srv.id] || {
                currentMs: '...',
                status: 'excellent',
                history: [],
                minMs: 0,
                maxMs: 0,
                avgMs: 0,
                packetLoss: 0,
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
                  onRestart={handleRestartSession}
                  onCopyHost={handleCopyHost}
                  onPing={pingServerReal}
                  onEdit={handleOpenEditModal}
                  onDelete={setServerToDelete}
                />
              );
            })
          )}
        </section>
      </main>

      {/* Add / Edit Server Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[10010] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
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
                    Target Domain or IP Address
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. google.com, tiktok.com or 1.1.1.1"
                    value={formHost}
                    onChange={e => handleHostInputChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Normalized format: clean domain without protocol or path.
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {serverToDelete && (
          <div className="fixed inset-0 z-[10020] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4"
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
