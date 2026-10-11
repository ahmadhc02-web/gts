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
  ArrowRight,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';
import { getStatus, getQr, disconnectWhatsApp, resetWhatsAppSession } from './whatsappApi';
import { toast } from 'sonner';
import { UserProfile } from '../types';

export interface WhatsAppConnectPanelProps {
  onClose?: () => void;
  currentUser?: UserProfile;
  initialSessionKey?: string;
  users?: UserProfile[];
}

export default function WhatsAppConnectPanel({
  onClose,
  currentUser,
  initialSessionKey,
  users = []
}: WhatsAppConnectPanelProps) {
  // Determine if logged-in user is a Sub-Dealer
  const isSubDealerUser = (currentUser?.role === 'dealer' || Boolean(currentUser?.dealerId && currentUser?.dealerId !== 'main') || Boolean(currentUser?.lineCode)) && currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin';
  const defaultSubDealerKey = currentUser?.lineCode || currentUser?.dealerId || currentUser?.uid || 'main';

  // Session Key state
  const [sessionKey, setSessionKey] = useState<string>(() => {
    if (initialSessionKey) return initialSessionKey;
    if (isSubDealerUser) return defaultSubDealerKey;
    return 'main';
  });

  const [status, setStatus] = useState<{
    connected: boolean;
    phoneNumber: string | null;
    session?: string;
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

  const sessionKeyRef = useRef(sessionKey);
  useEffect(() => { sessionKeyRef.current = sessionKey; }, [sessionKey]);

  // Sync state if initialSessionKey changes from outside
  useEffect(() => {
    if (initialSessionKey && initialSessionKey !== sessionKey) {
      setSessionKey(initialSessionKey);
    }
  }, [initialSessionKey]);

  // List of dealer channels for admin picker
  const availableChannels = React.useMemo(() => {
    const list = [{ key: 'main', label: '🌐 MASTER / MAIN GATEWAY (Default)', vlan: null, company: 'Main Admin' }];
    const dealerUsers = (users || []).filter(u => u.lineCode || u.role === 'dealer');
    dealerUsers.forEach(u => {
      const key = u.lineCode || u.uid;
      if (!list.some(item => item.key === key)) {
        list.push({
          key,
          label: `⚡ VLAN ${u.lineCode || 'DEALER'} • ${u.fullName || u.companyName || u.username}`,
          vlan: u.lineCode || null,
          company: u.companyName || u.fullName || u.username
        });
      }
    });
    return list;
  }, [users]);

  // Status fetching
  const fetchStatusOnly = async (targetSession = sessionKeyRef.current) => {
    try {
      const data = await getStatus(targetSession);
      if (data) {
        setStatus(data);
        if ((data as any)._error) {
          setError(`Status check: ${(data as any)._error}`);
        } else {
          setError(null);
        }
        return data;
      }
      setStatus({ connected: false, phoneNumber: null, session: targetSession });
      return { connected: false, phoneNumber: null };
    } catch (err: any) {
      setStatus({ connected: false, phoneNumber: null, session: targetSession });
      return { connected: false, phoneNumber: null };
    } finally {
      setIsLoading(false);
    }
  };

  // QR fetching
  const fetchQrOnly = async (targetSession = sessionKeyRef.current) => {
    try {
      const qrData = await getQr(targetSession);
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

  // When sessionKey changes, load its status and QR
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setQrCode(null);
    setStatus(null);

    async function init() {
      const s = await fetchStatusOnly(sessionKey);
      if (active && s && !s.connected) {
        await fetchQrOnly(sessionKey);
      }
    }
    init();

    return () => {
      active = false;
    };
  }, [sessionKey]);

  // Poll status every 3 seconds while disconnected
  useEffect(() => {
    const statusInterval = setInterval(() => {
      if (!statusRef.current || !statusRef.current.connected) {
        fetchStatusOnly(sessionKeyRef.current);
      }
    }, 3000);
    return () => clearInterval(statusInterval);
  }, []);

  // Poll QR code every 4 seconds while disconnected
  useEffect(() => {
    const qrInterval = setInterval(() => {
      if (statusRef.current && !statusRef.current.connected) {
        fetchQrOnly(sessionKeyRef.current);
      }
    }, 4000);
    return () => clearInterval(qrInterval);
  }, []);

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect WhatsApp for channel "${sessionKey}"?`)) return;
    setIsLoading(true);
    try {
      await disconnectWhatsApp(sessionKey);
      toast.info(`WhatsApp session for ${sessionKey} terminated`);
      await fetchStatusOnly(sessionKey);
      await fetchQrOnly(sessionKey);
    } catch (err) {
      console.error('Disconnect failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const s = await fetchStatusOnly(sessionKey);
      if (!s?.connected) {
        await fetchQrOnly(sessionKey);
      }
      toast.success('Status & QR refreshed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm(`This will wipe the session keys for "${sessionKey}" and generate a fresh QR code. Proceed?`)) return;
    setIsResetting(true);
    setError(null);
    try {
      const res = await resetWhatsAppSession(sessionKey);
      if (res?.qr) {
        setQrCode(res.qr);
      } else {
        await fetchQrOnly(sessionKey);
      }
      await fetchStatusOnly(sessionKey);
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

  // Active channel details
  const activeChannelMeta = availableChannels.find(c => c.key === sessionKey);

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
              Multi-Tenant VLAN & Sub-Dealer Dedicated Gateway
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

      {/* SUB-DEALER & VLAN GATEWAY SELECTOR BAR */}
      <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Layers size={14} />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Gateway Channel:
          </span>
          {isSubDealerUser ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
              <Shield size={12} />
              <span>VLAN: {currentUser?.lineCode || 'SUB-DEALER'} ({currentUser?.companyName || currentUser?.fullName || currentUser?.username})</span>
            </span>
          ) : (
            <div className="relative inline-block">
              <select
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs appearance-none uppercase"
              >
                {availableChannels.map((c) => (
                  <option key={`chan-${c.key}`} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span>Active Session:</span>
          <code className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-800">
            {sessionKey}
          </code>
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
          <span>Starting WhatsApp background engine on the server for {sessionKey}... QR code will appear automatically.</span>
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
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Verifying session for {sessionKey}...</p>
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
                    Channel: <span className="font-bold text-slate-700 dark:text-slate-200">{sessionKey.toUpperCase()}</span>
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

                <div className="w-full pt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Disconnect Device</span>
                  </button>
                  <button
                    onClick={handleResetSession}
                    disabled={isResetting}
                    className="w-full py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:underline flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={12} className={isResetting ? "animate-spin" : ""} />
                    <span>Reset Gateway Session</span>
                  </button>
                </div>
              </div>
            ) : (
              /* DISCONNECTED / SCAN QR STATE */
              <div className="flex flex-col items-center justify-center w-full space-y-4 py-2">
                <div className="relative p-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
                  {qrCode ? (
                    <img 
                      src={qrCode} 
                      alt={`WhatsApp QR Code (${sessionKey})`} 
                      className="w-52 h-52 object-contain rounded-lg animate-in fade-in duration-300"
                    />
                  ) : (
                    <div className="w-52 h-52 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50 dark:bg-slate-950/50 rounded-lg">
                      <Loader2 size={32} className="animate-spin text-indigo-500" />
                      <p className="text-[10px] font-bold uppercase tracking-wider">Generating fresh QR...</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Scan With WhatsApp
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    For channel: <span className="font-bold text-blue-600 dark:text-blue-400">{sessionKey.toUpperCase()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                    <span>Reload QR</span>
                  </button>
                  <button
                    onClick={handleResetSession}
                    disabled={isResetting}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} className={isResetting ? "animate-spin" : ""} />
                    <span>Reset Key</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT LANDSCAPE COLUMN: Instructions & Multi-Tenant Specs (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5 p-2">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-3">
                <ShieldCheck size={13} />
                <span>Sub-Dealer WhatsApp Isolation</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Dedicated WhatsApp Pairing Instructions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Connect your sub-dealer WhatsApp account to send reminders exclusively from your own number to your tagged subscribers on VLAN <strong className="text-slate-700 dark:text-slate-200">{sessionKey}</strong>.
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div className="w-6 h-6 rounded-lg bg-blue-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Open WhatsApp on your mobile device</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
                    Go to <strong>Settings</strong> (iOS) or tap <strong>⋮ More options</strong> (Android).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div className="w-6 h-6 rounded-lg bg-blue-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Select "Linked Devices"</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
                    Tap <strong>"Link a Device"</strong> and scan the QR code displayed on the left.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Dedicated Campaign Dispatch</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
                    Once paired, all automated reminder campaigns for VLAN <strong className="text-emerald-600 dark:text-emerald-400">{sessionKey}</strong> will dispatch from your personal/business WhatsApp number!
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Badges */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                ⚡ Multi-Session Baileys
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                🔒 Isolated Auth Directories
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                📡 24/7 Socket Reconnect
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
