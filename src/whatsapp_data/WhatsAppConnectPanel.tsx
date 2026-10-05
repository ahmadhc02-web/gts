import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Smartphone, 
  LogOut, 
  CheckCircle2, 
  Loader2, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  RotateCcw,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Radio,
  Activity,
  ArrowRight
} from 'lucide-react';
import { getStatus, getQr, disconnectWhatsApp, resetWhatsAppSession } from './whatsappApi';
import { toast } from 'sonner';

export default function WhatsAppConnectPanel({ onClose }: { onClose?: () => void }) {
  const [status, setStatus] = useState<{
    connected: boolean;
    phoneNumber: string | null;
    rateLimitReached?: boolean;
    queuedCount?: number;
    serviceStarting?: boolean;
    backendError?: string | null;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Status fetching
  const fetchStatusOnly = async () => {
    try {
      const data = await getStatus();
      if (data) {
        setStatus(data);
        if ((data as any)._error) {
          setError(`Status check: ${(data as any)._error}`);
        } else {
          setError(null);
        }
        return data;
      }
      setStatus({ connected: false, phoneNumber: null });
      return { connected: false, phoneNumber: null };
    } catch (err: any) {
      setStatus({ connected: false, phoneNumber: null });
      return { connected: false, phoneNumber: null };
    } finally {
      setIsLoading(false);
    }
  };

  // QR fetching
  const fetchQrOnly = async () => {
    try {
      const qrData = await getQr();
      if (qrData?.qr) {
        setQrCode(qrData.qr);
      } else {
        setQrCode(null);
      }
      if ((qrData as any)?._error) {
        setError(`QR fetch: ${(qrData as any)._error}`);
      } else if (qrData?.qr) {
        setError(null);
      }
    } catch (err) {
      setQrCode(null);
    }
  };

  // Initial fetch
  useEffect(() => {
    let active = true;
    async function init() {
      const s = await fetchStatusOnly();
      if (active && s && !s.connected) {
        await fetchQrOnly();
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // Poll status every 3 seconds while disconnected
  useEffect(() => {
    const statusInterval = setInterval(() => {
      if (!statusRef.current || !statusRef.current.connected) {
        fetchStatusOnly();
      }
    }, 3000);
    return () => clearInterval(statusInterval);
  }, []);

  // Poll QR code every 4 seconds while disconnected
  useEffect(() => {
    const qrInterval = setInterval(() => {
      if (statusRef.current && !statusRef.current.connected) {
        fetchQrOnly();
      }
    }, 4000);
    return () => clearInterval(qrInterval);
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp account?')) return;
    setIsLoading(true);
    try {
      await disconnectWhatsApp();
      toast.info('WhatsApp session terminated');
      await fetchStatusOnly();
      await fetchQrOnly();
    } catch (err) {
      console.error('Disconnect failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const s = await fetchStatusOnly();
      if (!s?.connected) {
        await fetchQrOnly();
      }
      toast.success('Status & QR refreshed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm('This will wipe the current session keys and generate a fresh QR code. Proceed?')) return;
    setIsResetting(true);
    setError(null);
    try {
      const res = await resetWhatsAppSession();
      if (res?.qr) {
        setQrCode(res.qr);
      } else {
        await fetchQrOnly();
      }
      await fetchStatusOnly();
      toast.success('Session reset! Scan the newly generated QR code.');
    } catch (err: any) {
      setError(`Reset error: ${err.message || 'Unable to reset session'}`);
      toast.error('Could not reset session automatically.');
    } finally {
      setIsResetting(false);
    }
  };

  const copyPhoneNumber = () => {
    if (!status?.phoneNumber) return;
    navigator.clipboard.writeText(status.phoneNumber);
    setCopiedPhone(true);
    toast.success('Phone number copied to clipboard');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const isConnected = Boolean(status?.connected);

  return (
    <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col transition-all duration-300">
      
      {/* Top Header Bar */}
      <div className="px-6 py-4.5 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${
            isConnected 
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
          }`}>
            <Smartphone size={20} className={isConnected ? "text-emerald-500" : "text-indigo-500"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase font-mono">
                WhatsApp Device Authentication
              </h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Standby
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              High-Speed Multi-Device Baileys Protocol Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isResetting}
            title="Reload Status & QR"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-emerald-500" : ""} />
          </button>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Error & Warning Banners */}
      {error && (
        <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle size={16} className="shrink-0 text-rose-500" />
            <p className="truncate">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-[10px] uppercase font-bold text-rose-500 hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {status?.serviceStarting && !isConnected && (
        <div className="mx-6 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-3">
          <Loader2 size={16} className="animate-spin shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Starting WhatsApp background engine on the server... QR code will appear automatically.</span>
        </div>
      )}

      {/* Main Landscape Layout Frame */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT LANDSCAPE COLUMN: QR Code / Connected Badge Card (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-950/60 dark:to-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 relative overflow-hidden text-center min-h-[300px]">
            
            {isLoading && !status ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
                <Loader2 size={36} className="animate-spin text-emerald-500" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Verifying session...</p>
              </div>
            ) : isConnected ? (
              /* CONNECTED STATE */
              <div className="flex flex-col items-center justify-center w-full space-y-4 py-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative">
                  <div className="w-20 h-20 bg-emerald-500/15 dark:bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 size={42} className="text-emerald-500 animate-in zoom-in duration-300" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                    <Radio size={10} className="text-white animate-ping" />
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    WhatsApp Connected
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                    Direct Socket Link Active
                  </p>
                </div>

                {status?.phoneNumber && (
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 px-4 py-2 rounded-xl text-emerald-700 dark:text-emerald-300 font-mono font-black text-sm tracking-wide shadow-xs">
                    <span>+{status.phoneNumber}</span>
                    <button
                      onClick={copyPhoneNumber}
                      className="p-1 hover:bg-emerald-500/20 rounded-md transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
                      title="Copy Number"
                    >
                      {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleDisconnect}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <LogOut size={13} /> Terminate Session
                </button>
              </div>
            ) : (
              /* QR SCAN CODE STATE */
              <div className="flex flex-col items-center w-full space-y-4">
                
                {/* Visual QR Frame */}
                <div className="relative p-3 bg-white dark:bg-slate-950 rounded-2xl border-2 border-slate-300 dark:border-slate-800 shadow-md max-w-[210px] w-full aspect-square flex items-center justify-center group transition-all">
                  
                  {/* Decorative Corner Reticles */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-500 rounded-tl-sm pointer-events-none" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-500 rounded-tr-sm pointer-events-none" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-500 rounded-bl-sm pointer-events-none" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-500 rounded-br-sm pointer-events-none" />

                  {qrCode ? (
                    <img 
                      src={qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-full h-full object-contain rounded-lg mix-blend-multiply dark:mix-blend-normal dark:invert transition-transform duration-300 group-hover:scale-102" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-slate-400">
                      <QrCode size={38} className="mb-2 opacity-40 text-slate-400 animate-pulse" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {isResetting ? "Generating QR..." : "Waiting for QR..."}
                      </p>
                    </div>
                  )}
                </div>

                {/* QR Quick Actions Toolbar */}
                <div className="flex items-center gap-2 flex-wrap justify-center w-full pt-1">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isResetting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw size={12} className={isRefreshing ? "animate-spin text-emerald-500" : ""} />
                    <span>{isRefreshing ? "Checking..." : "Reload QR"}</span>
                  </button>
                  <button
                    onClick={handleResetSession}
                    disabled={isResetting || isRefreshing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="Force clean session directory and re-initialize QR"
                  >
                    <RotateCcw size={12} className={isResetting ? "animate-spin text-emerald-500" : ""} />
                    <span>{isResetting ? "Resetting..." : "Reset Session"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT LANDSCAPE COLUMN: Live Diagnostics, Instructions & Stats (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">Gateway Protocol</span>
                  <Zap size={14} className="text-amber-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">Baileys v6 WS</div>
                  <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Multi-Device Ready</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">Outbound Queue</span>
                  <Activity size={14} className="text-indigo-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                    {status?.queuedCount && status.queuedCount > 0 ? `${status.queuedCount} Pending` : '0 Pending'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Instant Dispatch</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">Anti-Ban Buffer</span>
                  <ShieldCheck size={14} className="text-emerald-500" />
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">Protected</div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">3-7s Adaptive Jitter</div>
                </div>
              </div>

            </div>

            {/* Step-by-Step Instructions Landscape Card */}
            <div className="p-4.5 bg-slate-50/70 dark:bg-slate-950/30 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 space-y-3">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>📱</span> Quick Smartphone Pairing Guide
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[10px]">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[9px]">1</span>
                    <span>Open App</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                    Open WhatsApp on your mobile device.
                  </p>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/15 flex items-center justify-center text-[9px]">2</span>
                    <span>Linked Devices</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                    Tap <span className="font-bold">Settings</span> &rarr; <span className="font-bold">Linked Devices</span>.
                  </p>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-black text-[10px]">
                    <span className="w-4 h-4 rounded-full bg-purple-500/15 flex items-center justify-center text-[9px]">3</span>
                    <span>Scan QR Code</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                    Point camera at this screen to pair.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Status Help Footer */}
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1 px-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>{isConnected ? `Linked to active number (+${status?.phoneNumber || ''})` : 'Awaiting mobile device connection'}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Port 3001 Ready</span>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
