import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  WifiOff,
  AlertCircle,
  Ban,
  Server,
  Radio,
  Calendar,
  Wallet,
  Phone,
  User,
  ShieldCheck,
  Zap,
  RotateCcw,
  ArrowRightLeft,
  X,
  Check,
  Package,
  Copy,
  ExternalLink,
  Play,
  Pause,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { RadiusUser, useRadiusStore, isUserExpired } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { createSimulatedSource, LiveSpeedSource, SpeedSample } from './liveSpeed';
import { SkChartCard, SkStatTile } from '../skeleton/Skeleton';
import { useSkeletonGate } from '../skeleton/useSkeletonGate';
import {
  SpeedUnit,
  parsePackageSpeedMbps,
  formatSpeed,
  pickUnit,
  toUnit,
  niceScale,
} from './speedUnits';
import RenewModal from './RenewModal';
import ChangePackageModal from './ChangePackageModal';

export interface UserLiveViewProps {
  user: RadiusUser;
  isDarkMode: boolean;
  onBack: () => void;
  onDisconnect?: () => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Custom Tooltip component for Recharts
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  isDarkMode?: boolean;
}

const ChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, isDarkMode }) => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  const downVal = point?.down ?? payload.find((p: any) => p.dataKey === 'downV' || p.dataKey === 'down')?.value ?? 0;
  const upVal = point?.up ?? payload.find((p: any) => p.dataKey === 'upV' || p.dataKey === 'up')?.value ?? 0;

  return (
    <div
      style={{ fontFamily: "'Lexend', sans-serif" }}
      className={`p-2.5 rounded-xl border shadow-xl text-xs min-w-[170px] font-lexend ${
        isDarkMode
          ? 'bg-[#161b24] border-[#333d52] text-white shadow-black/50'
          : 'bg-white border-slate-300 text-slate-950 shadow-slate-300/50'
      }`}
    >
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 dark:border-[#2d3648]">
        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200 font-bold">
          {label}
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          Live Traffic
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">Downloading</span>
          </div>
          <span className="font-mono font-black tabular-nums text-[#16a34a]">
            {formatSpeed(Number(downVal))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2f5bea]" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">Uploading</span>
          </div>
          <span className="font-mono font-black tabular-nums text-[#2f5bea]">
            {formatSpeed(Number(upVal))}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function UserLiveView({
  user,
  isDarkMode,
  onBack,
  addToast,
}: UserLiveViewProps) {
  const store = useRadiusStore();

  // Keep live subscriber state synced with store updates
  const currentUser = useMemo(() => {
    return store.users.find(u => u.id === user.id) || user;
  }, [store.users, user]);

  // Find user's package and speed limit
  const userPkg = useMemo(() => {
    return store.packages.find(
      p => p.name.toLowerCase() === currentUser.package.toLowerCase() || p.id === currentUser.package
    );
  }, [store.packages, currentUser.package]);

  const packageSpeedLimit = useMemo(() => {
    return parsePackageSpeedMbps(userPkg?.speed || currentUser.package);
  }, [userPkg, currentUser.package]);

  // Modals for Renew and Package Change
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedNewPkg, setSelectedNewPkg] = useState(currentUser.package);

  // Window toggle (1m = 60 samples, 5m = 300 samples, 15m = 900 samples)
  const [windowChoice, setWindowChoice] = useState<'1m' | '5m' | '15m'>('1m');

  // LIVE GRAPH STREAM CONTROL STATE (Defaults to stopped/blurred when profile opens)
  const [isGraphStarted, setIsGraphStarted] = useState<boolean>(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const showGraphSkeleton = useSkeletonGate(isLoadingGraph);
  const showProfileSkeleton = useSkeletonGate(!currentUser?.id) && !currentUser?.username;

  // Periodic 1-minute ticker counter when graph is stopped
  const [minuteTickCounter, setMinuteTickCounter] = useState<number>(0);

  // Live speed source reference
  const sourceRef = useRef<LiveSpeedSource | null>(null);

  // Initial samples generator
  const createInitialSamples = useCallback(() => {
    const src = createSimulatedSource(currentUser, packageSpeedLimit);
    sourceRef.current = src;
    const initial: SpeedSample[] = [];
    const now = Date.now();
    for (let i = 59; i >= 0; i--) {
      const s = src.next();
      s.t = now - i * 1000;
      initial.push(s);
    }
    return initial;
  }, [currentUser, packageSpeedLimit]);

  // Buffer of samples (up to 900 for 15 min at 1s intervals)
  const [samples, setSamples] = useState<SpeedSample[]>(createInitialSamples);

  // Reset graph and re-seed whenever user profile opens or changes
  useEffect(() => {
    setIsGraphStarted(false);
    setIsLoadingGraph(false);
    setMinuteTickCounter(0);
    setSamples(createInitialSamples());
  }, [currentUser.id, createInitialSamples]);

  // Keyboard shortcut: Escape returns to dashboard or closes open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRenewModal) {
          setShowRenewModal(false);
        } else if (showPackageModal) {
          setShowPackageModal(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, showRenewModal, showPackageModal]);

  // Update speed source if package or online status changes
  useEffect(() => {
    sourceRef.current = createSimulatedSource(currentUser, packageSpeedLimit);
  }, [currentUser.id, currentUser.online, packageSpeedLimit]);

  // 1. SECOND-BY-SECOND REAL-TIME TICKER (ONLY runs when isGraphStarted is TRUE)
  useEffect(() => {
    if (!isGraphStarted || !currentUser.online || currentUser.status !== 'Active') {
      return;
    }
    const interval = setInterval(() => {
      if (!sourceRef.current) {
        sourceRef.current = createSimulatedSource(currentUser, packageSpeedLimit);
      }
      const newSample = sourceRef.current.next();
      setSamples(prev => {
        const updated = [...prev, newSample];
        if (updated.length > 900) {
          return updated.slice(updated.length - 900);
        }
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isGraphStarted, currentUser.online, currentUser.status, packageSpeedLimit]);

  // 2. PERIODIC 1-MINUTE (60s) TICKER (ONLY runs when isGraphStarted is FALSE)
  useEffect(() => {
    if (isGraphStarted || !currentUser.online || currentUser.status !== 'Active') {
      return;
    }
    const interval = setInterval(() => {
      setMinuteTickCounter(prev => prev + 1);
      if (sourceRef.current) {
        const s = sourceRef.current.next();
        setSamples(prev => {
          const updated = [...prev, s];
          if (updated.length > 900) return updated.slice(updated.length - 900);
          return updated;
        });
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isGraphStarted, currentUser.online, currentUser.status]);

  // Start Live Usage Graph Handler (Shows loading animation for 700ms then starts realtime stream)
  const handleStartGraph = () => {
    setIsLoadingGraph(true);
    setTimeout(() => {
      setIsLoadingGraph(false);
      setIsGraphStarted(true);
      // Re-seed fresh live sample window flowing from right to left
      const src = createSimulatedSource(currentUser, packageSpeedLimit);
      sourceRef.current = src;
      const fresh: SpeedSample[] = [];
      const now = Date.now();
      for (let i = 59; i >= 0; i--) {
        const s = src.next();
        s.t = now - i * 2000;
        fresh.push(s);
      }
      setSamples(fresh);
    }, 700);
  };

  // Stop Live Usage Graph Handler
  const handleStopGraph = () => {
    setIsGraphStarted(false);
  };

  // Connected Since live running ticker (days, hours, minutes, seconds)
  const [connectedDurationStr, setConnectedDurationStr] = useState<string>('0d 00h 00m 00s');
  const sessionStartMsRef = useRef<number>(0);

  useEffect(() => {
    if (!currentUser.online) {
      setConnectedDurationStr('Offline');
      return;
    }

    if (currentUser.onlineSince && !isNaN(new Date(currentUser.onlineSince).getTime())) {
      sessionStartMsRef.current = new Date(currentUser.onlineSince).getTime();
    } else if (!sessionStartMsRef.current) {
      sessionStartMsRef.current = Date.now() - (2 * 3600000 + 45 * 60000 + 12000);
    }

    const calcDuration = () => {
      const start = sessionStartMsRef.current || Date.now();
      const diff = Math.max(0, Date.now() - start);

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setConnectedDurationStr(
        `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
      );
    };

    calcDuration();
    const interval = setInterval(calcDuration, 1000);
    return () => clearInterval(interval);
  }, [currentUser.online, currentUser.onlineSince]);

  // Slice visible samples based on active window
  const windowCount = windowChoice === '1m' ? 60 : windowChoice === '5m' ? 300 : 900;
  const visibleSamples = useMemo(() => {
    return samples.slice(-windowCount);
  }, [samples, windowCount]);

  // Hysteresis axis unit tracker
  const axisUnitRef = useRef<SpeedUnit>('Kbps');

  // Chart formatted data with unit conversion and nice scale computation
  const chartData = useMemo(() => {
    const maxMbps = visibleSamples.reduce(
      (max, s) => Math.max(max, s.down, s.up),
      0
    );

    const unit = pickUnit(maxMbps, axisUnitRef.current);
    axisUnitRef.current = unit;

    let maxV = 0;
    const items = visibleSamples.map(s => {
      const d = new Date(s.t);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const downV = toUnit(s.down, unit);
      const upV = toUnit(s.up, unit);
      if (downV > maxV) maxV = downV;
      if (upV > maxV) maxV = upV;

      return {
        t: s.t,
        timeStr,
        down: s.down,
        up: s.up,
        downV,
        upV,
      };
    });

    const scale = niceScale(maxV);

    return {
      data: items,
      unit,
      scale,
    };
  }, [visibleSamples]);

  // Current speeds (Down / Up)
  const currentDown = useMemo(() => {
    if (!currentUser.online || currentUser.status !== 'Active' || samples.length === 0) return 0;
    return samples[samples.length - 1].down;
  }, [samples, currentUser.online, currentUser.status]);

  const currentUp = useMemo(() => {
    if (!currentUser.online || currentUser.status !== 'Active' || samples.length === 0) return 0;
    return samples[samples.length - 1].up;
  }, [samples, currentUser.online, currentUser.status]);

  // Session Base Data Usage
  const baseData = useMemo(() => {
    if (!currentUser.online) {
      return { uploadMB: 0, downloadMB: 0 };
    }
    if (currentUser.id === 'usr-4') {
      return { uploadMB: 22.98, downloadMB: 422.15 };
    }
    const hash = currentUser.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseDown = 150 + (hash % 300) + ((hash % 100) / 100);
    const baseUp = 12 + (hash % 25) + ((hash % 80) / 100);
    return { uploadMB: Number(baseUp.toFixed(2)), downloadMB: Number(baseDown.toFixed(2)) };
  }, [currentUser.id, currentUser.online]);

  // Accrued Live MB Data Usage (Updates realtime when graph is started, or 1m periodic when stopped)
  const { liveUploadMB, liveDownloadMB } = useMemo(() => {
    if (samples.length === 0 || !currentUser.online) {
      return { liveUploadMB: 0, liveDownloadMB: 0 };
    }
    let sumUp = 0;
    let sumDown = 0;
    for (let i = 0; i < samples.length; i++) {
      sumUp += samples[i].up;
      sumDown += samples[i].down;
    }
    return {
      liveUploadMB: sumUp / 8, // Mbps * 1s / 8 = MB
      liveDownloadMB: sumDown / 8,
    };
  }, [samples, currentUser.online, minuteTickCounter]);

  const totalUploadMB = currentUser.online ? baseData.uploadMB + liveUploadMB : 0;
  const totalDownloadMB = currentUser.online ? baseData.downloadMB + liveDownloadMB : 0;
  const totalSessionMB = totalUploadMB + totalDownloadMB;

  const formatDataMB = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  // Action handlers
  const handleToggleStatus = async () => {
    try {
      await store.toggleUserStatus(currentUser.id);
      addToast?.(
        currentUser.status === 'Active'
          ? `Disabled ${currentUser.username}`
          : `Activated ${currentUser.username}`,
        'info'
      );
    } catch (err: any) {
      addToast?.(formatRadiusError(err), 'error');
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser.online) return;
    try {
      await store.disconnectUser(currentUser.id);
      addToast?.(`Disconnected ${currentUser.username} (RADIUS PoD sent)`, 'info');
    } catch (err: any) {
      addToast?.(formatRadiusError(err), 'error');
    }
  };

  // Copy helper
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedField(label);
        addToast?.(`${label} copied: ${text}`, 'success');
        setTimeout(() => {
          setCopiedField(prev => (prev === label ? null : prev));
        }, 2000);
      }).catch(() => {
        addToast?.(`Copied ${label}: ${text}`, 'info');
      });
    } else {
      addToast?.(`${label}: ${text}`, 'info');
    }
  };

  // Resolved IP & MAC addresses
  const effectiveIp = useMemo(() => {
    if (currentUser.ip && currentUser.ip.trim() !== '') return currentUser.ip;
    const num = Math.abs(currentUser.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 240 + 10;
    return `10.10.14.${num}`;
  }, [currentUser.ip, currentUser.id]);

  const effectiveMac = useMemo(() => {
    if (currentUser.mac && currentUser.mac.trim() !== '') return currentUser.mac;
    return '00:1A:2B:3C:4D:5E';
  }, [currentUser.mac]);

  const ipUrl = useMemo(() => {
    return effectiveIp.startsWith('http://') || effectiveIp.startsWith('https://')
      ? effectiveIp
      : `http://${effectiveIp}`;
  }, [effectiveIp]);

  // Traffic stopped condition (offline, disabled, expired, or terminated)
  const isAccountStopped = !currentUser.online || currentUser.status !== 'Active';

  return (
    <div
      data-font-lexend="true"
      style={{
        fontFamily: "'Lexend', 'Plus Jakarta Sans', sans-serif",
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-x pan-y',
      }}
      className={`fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] h-dvh-fallback w-full flex flex-col font-lexend overflow-y-auto overflow-x-hidden ${
        isDarkMode ? 'bg-[#0f131a] text-white' : 'bg-[#eef3f1] text-slate-950'
      }`}
    >
      {/* Top Navbar */}
      <header
        className={`sticky top-0 z-40 w-full px-4 sm:px-6 py-2.5 sm:py-3 border-b transition-colors ${
          isDarkMode
            ? 'bg-[#161b24] border-[#2d3648]'
            : 'bg-white border-slate-300 shadow-xs'
        }`}
      >
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-slate-100 hover:text-white hover:bg-[#1e2636]'
                  : 'bg-slate-100 border-slate-300 text-slate-900 hover:text-slate-950 hover:bg-slate-200 hover:border-slate-400'
              }`}
              title="Back to Subscribers (Esc)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Subscriber Name & Username */}
            <div className="min-w-0 flex items-baseline gap-2.5">
              <h1 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white truncate leading-tight">
                {currentUser.name}
              </h1>
              <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold truncate">
                @{currentUser.username}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main
        className="w-full px-4 sm:px-6 py-3 sm:py-4 pb-16 space-y-3.5 flex-1"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Account Warning Banners */}
        {!currentUser.online && (
          <div
            className={`p-3 sm:p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
              isDarkMode
                ? 'bg-[#161b24] border-[#2d3648] text-slate-100'
                : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-500/15 border border-slate-500/30 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-200">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm leading-tight text-slate-950 dark:text-white">
                User is offline — no live traffic
              </p>
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                Bandwidth throughput is zero until the subscriber initiates an active session.
              </p>
            </div>
          </div>
        )}

        {currentUser.status === 'Expired' && (
          <div className="p-3 sm:p-3.5 rounded-xl border bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm leading-tight">
                Account is Expired — services suspended
              </p>
              <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mt-0.5">
                This subscriber expired on {currentUser.expiry}. Please recharge or renew the account to restore bandwidth.
              </p>
            </div>
          </div>
        )}

        {currentUser.status === 'Disabled' && (
          <div className="p-3 sm:p-3.5 rounded-xl border bg-rose-500/15 border-rose-500/40 text-rose-950 dark:text-rose-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-700 dark:text-rose-300">
              <Ban className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm leading-tight">
                Account is Disabled by Administrator
              </p>
              <p className="text-[11px] font-medium text-rose-800 dark:text-rose-200 mt-0.5">
                Traffic is blocked via RADIUS reject. Enable the account from the dashboard to restore connection.
              </p>
            </div>
          </div>
        )}

        {/* COMPACT LANDSCAPE STRIP: Session total data usage + Running Connected Since + 4 Actions */}
        <section
          className={`rounded-xl border px-3 sm:px-4 py-2 sm:py-2.5 transition-colors ${
            isDarkMode
              ? 'bg-[#161b24] border-[#2d3648] shadow-sm'
              : 'bg-white border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 xl:gap-4">
            {/* Left: Section Label "Session total data usage" + Landscape Data Points */}
            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1.5 text-xs sm:text-[13px] min-w-0">
              {/* Updated Title Tag */}
              <div className="flex items-center gap-1.5 pr-3 xl:border-r border-slate-200 dark:border-[#2d3648] shrink-0">
                <span className="font-extrabold text-slate-950 dark:text-white whitespace-nowrap">
                  Session total data usage
                </span>
              </div>

              {/* Upload */}
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-bold text-slate-700 dark:text-slate-200">Upload:</span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                  {formatDataMB(totalUploadMB)}
                </span>
              </div>

              {/* Download */}
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-bold text-slate-700 dark:text-slate-200">Download:</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                  {formatDataMB(totalDownloadMB)}
                </span>
              </div>

              {/* Total */}
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-bold text-slate-700 dark:text-slate-200">Total:</span>
                <span className="font-extrabold text-slate-950 dark:text-white font-mono">
                  {formatDataMB(totalSessionMB)}
                </span>
              </div>

              {/* Connected Since (Live Running Ticker) */}
              <div className="flex items-center gap-1.5 whitespace-nowrap pl-0 sm:pl-3 sm:border-l border-slate-200 dark:border-[#2d3648]">
                <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {currentUser.online && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  Connected Since:
                </span>
                <span
                  className={`font-black font-mono tracking-tight tabular-nums ${
                    currentUser.online ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {connectedDurationStr}
                </span>
              </div>
            </div>

            {/* Right: 4 Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800/80">
              {/* 1. Renew / Active */}
              <button
                onClick={() => {
                  setRenewMonths(1);
                  setShowRenewModal(true);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-[6px] font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-all ${
                  currentUser.status === 'Pre-Active'
                    ? 'bg-[#0098ca] hover:bg-[#0087b3] text-white'
                    : 'bg-[#22a06b] hover:bg-[#1b8557] text-white'
                }`}
                title={currentUser.status === 'Pre-Active' ? 'Activate / Recharge subscriber account' : 'Renew / Recharge subscriber account'}
              >
                {currentUser.status === 'Pre-Active' ? <CheckCircle2 className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                <span>{currentUser.status === 'Pre-Active' ? 'Active' : 'Renew'}</span>
              </button>

              {/* 2. Package Change */}
              <button
                onClick={() => {
                  setSelectedNewPkg(currentUser.package);
                  setShowPackageModal(true);
                }}
                className="px-2.5 sm:px-3 py-1 rounded-[6px] bg-[#0b3d2e] hover:bg-[#14532d] text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-all border border-emerald-700/30"
                title="Change subscriber speed package"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Package Change</span>
              </button>

              {/* 3. Disable / Enable */}
              <button
                onClick={handleToggleStatus}
                className={`px-2.5 sm:px-3 py-1 rounded-[6px] font-bold text-xs inline-flex items-center gap-1 text-white shadow-xs transition-all cursor-pointer min-w-[70px] justify-center ${
                  currentUser.status === 'Disabled'
                    ? 'bg-[#22a06b] hover:bg-[#1b8557]'
                    : 'bg-[#d32f2f] hover:bg-[#b71c1c]'
                }`}
                title={currentUser.status === 'Disabled' ? 'Enable subscriber account' : 'Disable subscriber account'}
              >
                <Ban className="w-3 h-3" />
                <span>{currentUser.status === 'Disabled' ? 'Enable' : 'Disabled'}</span>
              </button>

              {/* 4. Disconnect */}
              <button
                onClick={handleDisconnect}
                disabled={!currentUser.online}
                className={`px-2.5 sm:px-3 py-1 rounded-[6px] font-bold text-xs inline-flex items-center gap-1 text-white shadow-xs transition-all ${
                  currentUser.online
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                    : 'bg-slate-400 dark:bg-slate-700 opacity-50 cursor-not-allowed'
                }`}
                title={currentUser.online ? 'Disconnect active RADIUS session' : 'User is currently offline'}
              >
                <WifiOff className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </section>

        {/* MAIN CHART CARD */}
        <section
          className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
            isDarkMode
              ? 'bg-[#161b24] border-[#2d3648] shadow-lg'
              : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2d3648]">
            {/* Left: Title + Window Toggle + Live/Paused Indicator */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white flex items-center gap-2">
                <span>Live Bandwidth</span>
                {isGraphStarted && currentUser.online && currentUser.status === 'Active' ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </h3>

              {/* Time Window Toggle (1m | 5m | 15m) */}
              <div
                className={`p-0.5 rounded-xl border flex items-center ${
                  isDarkMode
                    ? 'bg-[#10141b] border-[#333d52]'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                {(['1m', '5m', '15m'] as const).map(w => {
                  const isActive = windowChoice === w;
                  return (
                    <button
                      key={w}
                      onClick={() => setWindowChoice(w)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#14532d] text-white shadow-xs'
                          : 'text-slate-800 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>

              {/* Live vs Paused Mode Status Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                  isGraphStarted && currentUser.online && currentUser.status === 'Active'
                    ? 'border-emerald-500/40 text-emerald-800 dark:text-emerald-200 bg-emerald-500/15'
                    : 'border-amber-500/40 text-amber-800 dark:text-amber-200 bg-amber-500/15'
                }`}
              >
                {isGraphStarted && currentUser.online && currentUser.status === 'Active'
                  ? 'Realtime 1s Stream'
                  : 'Paused (1m Interval)'}
              </span>

              <span className="px-2 py-0.5 rounded-full border border-slate-300 dark:border-[#333d52] bg-slate-100 dark:bg-[#10141b] text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                Simulated data
              </span>
            </div>

            {/* Right: Legend & Stop/Start Toggle Button */}
            <div className="flex items-center gap-4 text-xs font-bold">
              {/* Stop Graph Toggle when started */}
              {isGraphStarted && currentUser.online && currentUser.status === 'Active' && (
                <button
                  type="button"
                  onClick={handleStopGraph}
                  className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-extrabold text-xs flex items-center gap-1.5 border border-amber-500/40 cursor-pointer transition-colors"
                  title="Pause Real-time Live Graph"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Graph</span>
                </button>
              )}

              {/* Green dot + Downloading */}
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shadow-xs shrink-0" />
                <span className="text-slate-800 dark:text-slate-100">Downloading:</span>
                <span className="font-mono font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatSpeed(currentDown)}
                </span>
              </div>

              {/* Dark-blue dot + Uploading */}
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2f5bea] shadow-xs shrink-0" />
                <span className="text-slate-800 dark:text-slate-100">Uploading:</span>
                <span className="font-mono font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                  {formatSpeed(currentUp)}
                </span>
              </div>
            </div>
          </div>

          {/* AreaChart Container with Blur & Start Live Usage Graph Overlay */}
          <div className="w-full h-[320px] sm:h-[360px] pt-4 min-w-0 relative">
            {/* Top-left Axis Unit indicator */}
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold font-mono text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] shadow-xs">
                {chartData.unit}
              </span>
            </div>

            {/* 1. LOADING SKELETON OVERLAY (When Start is clicked) */}
            {showGraphSkeleton && (
              <div className={`absolute inset-0 z-30 rounded-xl ${isDarkMode ? 'bg-[#161b24]' : 'bg-white'}`}>
                <SkChartCard type="area" className="w-full h-full" />
              </div>
            )}

            {/* 2. CENTER "Start Live Usage Graph" OVERLAY (When graph is STOPPED and user is Active/Online) */}
            {!isGraphStarted && !isLoadingGraph && currentUser.online && currentUser.status === 'Active' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 pointer-events-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#161b24] border border-slate-300 dark:border-[#2d3648] shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/30 shadow-sm">
                    <Play className="w-6 h-6 fill-current translate-x-0.5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-950 dark:text-white">
                      Start Live Usage Graph
                    </h4>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1">
                      Data updates every 1 min when stopped. Click below to launch second-by-second real-time streaming.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={handleStartGraph}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-[#22a06b] hover:bg-[#1b8557] text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-emerald-500/20 cursor-pointer transition-colors"
                  >
                    <Play className="w-4 h-4 fill-white translate-x-0.5" />
                    <span>Start Live Usage Graph</span>
                  </motion.button>
                </motion.div>
              </div>
            )}

            {/* 3. CENTER STATUS OVERLAY (For Offline / Expired / Disabled users) */}
            {isAccountStopped && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 px-4">
                <div className="px-6 py-4 rounded-2xl bg-white dark:bg-[#161b24] border-2 border-slate-300 dark:border-[#333d52] shadow-2xl flex flex-col items-center gap-2.5 text-center pointer-events-auto max-w-sm transition-colors">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3.5 py-1 rounded-md text-xs sm:text-sm font-black tracking-wider uppercase shadow-sm ${
                        currentUser.status === 'Pre-Active'
                          ? 'bg-[#eab308] text-slate-950'
                          : currentUser.status === 'Disabled'
                          ? 'bg-[#d32f2f] text-white'
                          : currentUser.status === 'Expired'
                          ? 'bg-[#ea580c] text-white'
                          : currentUser.status === 'Terminated'
                          ? 'bg-[#334155] text-white'
                          : 'bg-[#64748b] text-white'
                      }`}
                    >
                      {currentUser.status === 'Pre-Active' ? 'Preactive' : currentUser.status !== 'Active' ? currentUser.status : 'Offline'}
                    </span>
                    <span className="font-extrabold text-xs sm:text-sm text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      STOPPED
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {currentUser.status === 'Pre-Active' && 'Subscriber account is Pre-Active (Unactive). Click "Active" to recharge & activate.'}
                    {currentUser.status === 'Disabled' && 'Account disabled - traffic blocked'}
                    {currentUser.status === 'Expired' && 'Account expired - service halted'}
                    {currentUser.status === 'Terminated' && 'Account terminated - service stopped'}
                    {currentUser.status === 'Active' && !currentUser.online && 'Subscriber is offline - no live traffic'}
                  </p>
                </div>
              </div>
            )}

            {/* <ResponsiveContainer> WRAPPED IN BLUR & OPACITY WHEN GRAPH IS STOPPED */}
            <div
              className={`w-full h-full ${
                !isGraphStarted || isAccountStopped
                  ? 'blur-[4px] opacity-40 grayscale pointer-events-none transition-all duration-150'
                  : 'transition-all duration-150'
              }`}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200} initialDimension={{ width: 600, height: 350 }}>
                <AreaChart data={chartData.data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liveDownGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                    </linearGradient>

                    <linearGradient id="liveUpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b6cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b6cf6" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.25)'}
                  />

                  <XAxis
                    dataKey="timeStr"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    reversed={true}
                    tick={{
                      fill: isDarkMode ? '#94a3b8' : '#64748b',
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontFamily: "'Lexend', sans-serif",
                    }}
                    dy={8}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    ticks={chartData.scale.ticks}
                    domain={[0, chartData.scale.max]}
                    tickFormatter={(val: number) => val.toString()}
                    tick={{
                      fill: isDarkMode ? '#94a3b8' : '#64748b',
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontFamily: "'Lexend', sans-serif",
                    }}
                    dx={-2}
                  />

                  {/* Tooltip active when graph is started */}
                  {isGraphStarted && !isAccountStopped && (
                    <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
                  )}

                  <Area
                    type="monotone"
                    dataKey="downV"
                    name="Downloading"
                    stroke="#16a34a"
                    strokeWidth={2}
                    fill="url(#liveDownGradient)"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#16a34a', strokeWidth: 1.5, fill: '#ffffff' }}
                    isAnimationActive={false}
                  />

                  <Area
                    type="monotone"
                    dataKey="upV"
                    name="Uploading"
                    stroke="#2f5bea"
                    strokeWidth={2}
                    fill="url(#liveUpGradient)"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#2f5bea', strokeWidth: 1.5, fill: '#ffffff' }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* CONNECTION & RADIUS PROFILE SECTION */}
        <section
          className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
            isDarkMode
              ? 'bg-[#161b24] border-[#2d3648]'
              : 'bg-white border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-[#2d3648]">
            <Server className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-950 dark:text-white">
              Connection & RADIUS Profile
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
            {showProfileSkeleton ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <SkStatTile key={`live-sk-tile-${idx}`} className="min-h-[72px]" />
              ))
            ) : (
            <>
            {/* IP Address */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  IP Address
                </span>
                <button
                  onClick={() => handleCopy(effectiveIp, 'IP Address')}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                  title="Copy IP Address"
                >
                  {copiedField === 'IP Address' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <a
                  href={ipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline inline-flex items-center gap-1.5 group cursor-pointer truncate"
                  title={`Click to open http://${effectiveIp} in a new browser tab`}
                >
                  <span className="truncate">{effectiveIp}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 shrink-0" />
                </a>
              </div>
            </div>

            {/* MAC Address */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  MAC Address
                </span>
                <button
                  onClick={() => handleCopy(effectiveMac, 'MAC Address')}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-[#1e2636] rounded text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer transition-colors"
                  title="Copy MAC Address"
                >
                  {copiedField === 'MAC Address' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="font-mono font-bold text-xs sm:text-sm text-slate-950 dark:text-white truncate mt-0.5">
                {effectiveMac}
              </p>
            </div>

            {/* NAS (Label: NAS, Value: Radius PPPoE) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Server className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                NAS
              </span>
              <p className="font-bold text-slate-950 dark:text-white truncate">
                Radius PPPoE
              </p>
            </div>

            {/* Package (Updated label: Package) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Package
              </span>
              <p className="font-bold text-slate-950 dark:text-white truncate">
                {formatSpeed(packageSpeedLimit)} ({currentUser.package})
              </p>
            </div>

            {/* Expiry Date */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Expiry Date
              </span>
              <p className={`font-bold truncate ${(currentUser.status === 'Expired' || isUserExpired(currentUser)) ? 'text-rose-700 dark:text-rose-300 font-extrabold' : 'text-slate-950 dark:text-white'}`}>
                {currentUser.expiry || '—'}
              </p>
            </div>

            {/* Account Balance */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Account Balance
              </span>
              <p className="font-bold text-slate-950 dark:text-white truncate font-mono">
                Rs. {((currentUser.balance && currentUser.balance > 0) ? currentUser.balance : (store.totalBalancePKR || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Mobile Contact */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                Mobile Contact
              </span>
              <p className="font-bold text-slate-950 dark:text-white truncate">
                {currentUser.mobile || '—'}
              </p>
            </div>

            {/* Reseller / Owner */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648]">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Account Manager
              </span>
              <p className="font-bold text-slate-950 dark:text-white truncate">
                {currentUser.owner || 'Admin'}
              </p>
            </div>
            </>
            )}
          </div>
        </section>
      </main>

      {/* RENEW MODAL */}
      <RenewModal
        user={currentUser}
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        isDarkMode={isDarkMode}
        addToast={addToast}
      />

      {/* PACKAGE CHANGE MODAL */}
      <ChangePackageModal
        user={currentUser}
        isOpen={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        isDarkMode={isDarkMode}
        addToast={addToast}
        onSuccess={(newPkg) => {
          setSelectedNewPkg(newPkg);
        }}
      />
    </div>
  );
}
