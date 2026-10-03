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
  Cpu,
  Radio,
  Wifi,
  ShieldCheck,
  Search,
  X,
  AlertTriangle,
  Database,
  WifiOff
} from 'lucide-react';
import {
  AreaChart,
  Area,
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

interface LatencyPoint {
  time: string;
  ms: number;
  label?: string;
}

interface ServerState {
  currentMs: number | 'Error';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  history: LatencyPoint[];
  minMs: number;
  maxMs: number;
  avgMs: number;
  packetLoss: number;
  lastUpdated: number;
  method?: string;
}

interface ServiceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

const STORAGE_KEY = 'gts_server_monitor_user_targets_v5';

// Resolve original real favicon / logo URL for any domain or IP
export function getRealLogoUrl(host: string): string {
  const clean = host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim().toLowerCase();

  // Known Public DNS / Cloud IPs mapping
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

// Custom circular dot matching the reference image (mint green border with crisp white center)
const CustomHeartbeatDot = (props: any) => {
  const { cx, cy, stroke } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.8}
      stroke={stroke || '#10b981'}
      strokeWidth={2.2}
      fill="#ffffff"
      className="drop-shadow-sm transition-all duration-300"
    />
  );
};

// Custom Tooltip component matching the reference image ("🟢 Running: XX")
const CustomHeartbeatTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const msValue = data?.value;
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none ring-1 ring-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label || 'Latency'}
        </span>
        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
          Running: {msValue} ms
        </span>
      </div>
    );
  }
  return null;
};

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

  // Form Fields (Clean & Simple: Only Server Name & Host IP/URL)
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');

  // Measure DIRECT REAL-TIME INTERNET LATENCY from the USER'S OWN BROWSING INTERNET CONNECTION
  const pingServerReal = useCallback(async (srv: ServerTarget) => {
    const cleanHost = srv.host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let measuredMs: number | 'Error' = 'Error';
    let status: ServerState['status'] = 'excellent';

    // Step 1: Direct Client Internet RTT Timing via Browser fetch
    const t0 = performance.now();
    try {
      const url = `https://${cleanHost}/favicon.ico?_t=${now}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => {});

      clearTimeout(timeoutId);
      const t1 = performance.now();
      const clientRtt = Math.round(t1 - t0);

      if (clientRtt > 0 && clientRtt < 2000) {
        measuredMs = clientRtt;
      }
    } catch (e) {}

    // Step 2: Native Ping endpoint fallback if CORS/firewall blocks direct HEAD request
    if (measuredMs === 'Error') {
      try {
        const response = await fetch(`/api/network-ping?host=${encodeURIComponent(cleanHost)}`, {
          signal: AbortSignal.timeout(2500)
        });
        const data = await response.json();
        if (data && typeof data.ms === 'number' && !isNaN(data.ms) && data.ms > 0) {
          measuredMs = data.ms;
        }
      } catch (e) {}
    }

    if (typeof measuredMs === 'number') {
      if (measuredMs > 150) status = 'poor';
      else if (measuredMs > 80) status = 'fair';
      else if (measuredMs > 35) status = 'good';
      else status = 'excellent';
    } else {
      status = 'offline';
    }

    setLiveStates(prev => {
      const current = prev[srv.id];
      const oldHistory = current ? current.history : [];

      let newHistory = oldHistory;
      if (typeof measuredMs === 'number') {
        newHistory = [...oldHistory.slice(-14), { time: timeStr, ms: measuredMs, label: timeStr }];
      }

      const validPoints = newHistory.map(h => h.ms);
      const minMs = validPoints.length > 0 ? Math.min(...validPoints) : (typeof measuredMs === 'number' ? measuredMs : 0);
      const maxMs = validPoints.length > 0 ? Math.max(...validPoints) : (typeof measuredMs === 'number' ? measuredMs : 0);
      const avgMs = validPoints.length > 0 ? Math.round(validPoints.reduce((a, b) => a + b, 0) / validPoints.length) : (typeof measuredMs === 'number' ? measuredMs : 0);

      return {
        ...prev,
        [srv.id]: {
          currentMs: measuredMs,
          status,
          history: newHistory,
          minMs,
          maxMs,
          avgMs,
          packetLoss: measuredMs === 'Error' ? 1 : 0,
          lastUpdated: now,
          method: 'client-internet-rtt'
        }
      };
    });
  }, []);

  // Real-time Periodic Polling Engine (Every 1.5 seconds per server)
  useEffect(() => {
    if (!isOpen || servers.length === 0) return;

    // Trigger initial pings immediately
    servers.forEach(srv => {
      pingServerReal(srv);
    });

    const interval = setInterval(() => {
      servers.forEach(srv => {
        pingServerReal(srv);
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen, servers, pingServerReal]);

  // Filtered servers list
  const filteredServers = useMemo(() => {
    return servers.filter(srv => {
      return (
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.host.toLowerCase().includes(searchQuery.toLowerCase())
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
  const handleOpenAddModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormHost('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (srv: ServerTarget) => {
    setEditingServer(srv);
    setFormName(srv.name);
    setFormHost(srv.host);
    setIsAddModalOpen(true);
  };

  // Save Server (Add or Edit) to database
  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter a valid Server Name');
      return;
    }
    if (!formHost.trim()) {
      toast.error('Please enter a Host IP or URL');
      return;
    }

    const cleanHost = formHost.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    setIsSaving(true);
    try {
      const metaJson = JSON.stringify({
        name: formName.trim()
      });

      if (editingServer) {
        // Update in database
        await supabaseService.updateMonitorTarget(editingServer.id, {
          domain: cleanHost,
          label: metaJson
        });

        // Update local state
        setServers(prev =>
          prev.map(s =>
            s.id === editingServer.id
              ? {
                  ...s,
                  name: formName.trim(),
                  host: cleanHost
                }
              : s
          )
        );
        toast.success(`Server "${formName}" updated in database.`);
      } else {
        // Create in database
        const creator = user || { username: 'Admin', role: 'admin', uid: 'admin-1' } as any;
        const newDbTarget = await supabaseService.createMonitorTarget(
          cleanHost,
          creator,
          metaJson
        );

        const newSrv: ServerTarget = {
          id: newDbTarget.id,
          name: formName.trim(),
          host: cleanHost
        };

        setServers(prev => [newSrv, ...prev]);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([newSrv, ...servers]));
        } catch (e) {}

        toast.success(`Server "${newSrv.name}" saved to database.`);
        // Trigger immediate live ping
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
      toast.success(`Server "${serverToDelete.name}" removed from database.`);
    } catch (err: any) {
      toast.error(`Failed to delete server: ${err.message || 'Unknown database error'}`);
    } finally {
      setServerToDelete(null);
    }
  };

  // Copy IP to Clipboard
  const handleCopyHost = (host: string) => {
    navigator.clipboard.writeText(host);
    setCopiedHost(host);
    toast.success(`Copied "${host}" to clipboard`);
    setTimeout(() => setCopiedHost(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] w-screen h-screen bg-slate-100/90 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm group"
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
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Global Latency Matrix & Server Monitor
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Your Live Internet MS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Direct real-time internet latency measured live from your internet connection with synchronized site logos.
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Action: Add Server Button */}
        <div className="flex items-center gap-3">
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
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
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
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Your Internet MS (RTT)</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {globalStats.total > 0 && globalStats.avgMs > 0 ? `${globalStats.avgMs} ms` : '—'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">Actual Connection Latency</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Zap size={22} />
            </div>
          </div>

          {/* Card 3: Optimum Performance Nodes */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Optimal Response Sites</p>
              <h3 className="text-2xl font-black text-teal-600 dark:text-cyan-400 font-mono mt-1">{globalStats.fastCount} Nodes</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">Latency under 70ms</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-cyan-500/10 border border-teal-100 dark:border-cyan-500/20 flex items-center justify-center text-teal-600 dark:text-cyan-400">
              <ShieldCheck size={22} />
            </div>
          </div>

          {/* Card 4: Network Health */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-4.5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400">Ping Measurement</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">Direct Client</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Live End-User Internet Sync</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Activity size={22} />
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section className="bg-white dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 shrink-0">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </section>

        {/* Landscape Rows List of Servers */}
        <section className="flex-1 space-y-3 pb-8">
          {filteredServers.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <Server size={32} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  No Monitored Servers Found
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mt-1">
                  Abhi koi server add nahi hai. Apne internet connection se kisi bhi website (e.g. <code>google.com</code>) ya IP ka original ms latency check karne ke liye <strong>"Add Server"</strong> button dabayein.
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
                lastUpdated: Date.now()
              };

              // Color classes based on status
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

              return (
                <motion.div
                  key={srv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="w-full bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/90 dark:border-white/10 hover:border-emerald-500/40 rounded-2xl p-4.5 transition-all duration-300 shadow-sm hover:shadow-md group flex flex-col xl:flex-row items-stretch xl:items-center gap-4"
                >
                  {/* Left Block: Identity & Original Site Favicon */}
                  <div className="flex items-center gap-3.5 min-w-[260px] max-w-[320px] shrink-0">
                    <div className="relative shrink-0">
                      <ServerLogo host={srv.host} name={srv.name} />
                      <span className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900", statusColors.dot, "animate-pulse")} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight uppercase">
                        {srv.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/5">
                          {srv.host}
                        </span>
                        <button
                          onClick={() => handleCopyHost(srv.host)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                          title="Copy IP"
                        >
                          {copiedHost === srv.host ? (
                            <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Middle Left: Live Fluctuating Real MS Counter */}
                  <div className="flex items-center gap-3 min-w-[140px] shrink-0 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/5 rounded-xl px-3.5 py-2">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-2xl font-black font-mono tracking-tight", statusColors.text)}>
                          {state.currentMs}
                        </span>
                        {typeof state.currentMs === 'number' && (
                          <span className="text-[10px] font-black uppercase text-slate-400">ms</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono font-bold">
                        <span>Min: {state.minMs}</span>
                        <span>•</span>
                        <span>Max: {state.maxMs}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "ml-auto px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                        statusColors.bg,
                        statusColors.text,
                        statusColors.border
                      )}
                    >
                      {state.status}
                    </span>
                  </div>

                  {/* Wide Middle-to-Right: Heartbeat Landscape Sparkline Chart (Matching Uploaded Image with Real Fluctuations) */}
                  <div className="flex-1 h-[78px] w-full min-w-[280px] bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200/70 dark:border-white/5 rounded-xl p-1 relative overflow-hidden flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={state.history}
                        margin={{ top: 8, right: 10, left: 10, bottom: 4 }}
                      >
                        <defs>
                          {/* Soft green gradient fill beneath the line */}
                          <linearGradient id={`gradient-${srv.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          vertical={false}
                          stroke="rgba(0, 0, 0, 0.05)"
                        />
                        <YAxis
                          hide
                          domain={['dataMin - 5', 'dataMax + 10']}
                        />
                        <XAxis dataKey="time" hide />
                        <Tooltip content={<CustomHeartbeatTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="ms"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill={`url(#gradient-${srv.id})`}
                          dot={<CustomHeartbeatDot stroke="#10b981" />}
                          activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right Actions: Edit and Delete Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
                    <button
                      onClick={() => pingServerReal(srv)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-sm group/btn"
                      title="Test Real Client Internet Latency"
                    >
                      <RefreshCw size={15} className="group-hover/btn:rotate-180 transition-transform text-emerald-600 dark:text-emerald-400" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(srv)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-sm group/btn"
                      title="Edit Server"
                    >
                      <Edit2 size={15} className="group-hover/btn:scale-110 transition-transform text-teal-600 dark:text-teal-400" />
                    </button>
                    <button
                      onClick={() => setServerToDelete(srv)}
                      className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-all cursor-pointer shadow-sm group/btn"
                      title="Delete Server"
                    >
                      <Trash2 size={15} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </div>
                </motion.div>
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveServer} className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                    Server Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google Cloud Primary or Cloudflare Edge"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                    Host / IP Address or Website URL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.1.1.1 or 8.8.8.8 or google.com or facebook.com"
                    value={formHost}
                    onChange={e => setFormHost(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Activity size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Direct Internet Latency
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Aapke apne internet connection se direct real-time ms latency calculate hogi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:opacity-95 flex items-center gap-1.5"
                  >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : null}
                    <span>{editingServer ? 'Save Changes' : 'Add Server'}</span>
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
          <div className="fixed inset-0 z-[10010] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">Confirm Server Deletion</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">This will remove the server from database.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                Are you sure you want to remove <strong className="text-slate-900 dark:text-white font-mono">{serverToDelete.name}</strong> ({serverToDelete.host}) from live monitoring matrix database?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setServerToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase shadow-md shadow-rose-600/30"
                >
                  Delete Server
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
