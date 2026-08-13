import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, LogOut, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { getStatus, getQr, disconnectWhatsApp } from './whatsappApi';
import { motion } from 'motion/react';

export default function WhatsAppConnectPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<{
    connected: boolean;
    phoneNumber: string | null;
    rateLimitReached?: boolean;
    queuedCount?: number;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status fetching
  const fetchStatusOnly = async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to fetch WhatsApp status', err);
      setError("Cannot reach WhatsApp service — check that the backend is running and VITE_WHATSAPP_SERVICE_URL is configured");
      setStatus(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // QR fetching
  const fetchQrOnly = async () => {
    try {
      const qrData = await getQr();
      if (qrData.qr) {
        setQrCode(qrData.qr);
        setError(null);
      } else {
        setQrCode(null);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp QR', err);
      setError("Cannot reach WhatsApp service — check that the backend is running and VITE_WHATSAPP_SERVICE_URL is configured");
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
      if (!status || !status.connected) {
        fetchStatusOnly();
      }
    }, 3000);
    return () => clearInterval(statusInterval);
  }, [status]);

  // Poll QR code every 4 seconds while a QR is expected but not yet connected
  useEffect(() => {
    let qrInterval: NodeJS.Timeout | null = null;
    if (status && !status.connected) {
      qrInterval = setInterval(() => {
        fetchQrOnly();
      }, 4000);
    }
    return () => {
      if (qrInterval) clearInterval(qrInterval);
    };
  }, [status]);

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectWhatsApp();
      await fetchStatusOnly();
    } catch (err) {
      console.error('Disconnect failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-hidden flex flex-col text-left">
      {/* Top close button to return back to desktop */}
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors z-10 cursor-pointer"
        title="Close Application"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
          <Smartphone size={20} className="fill-emerald-500/20" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase">Device Authentication Status</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setup link to active smartphone terminal</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-3 shadow-xs">
          <AlertTriangle size={18} className="shrink-0 text-rose-500 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-4 min-h-[220px] bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900">
        {isLoading && !status ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Checking session...</p>
          </div>
        ) : status?.connected ? (
          <div className="flex flex-col items-center gap-4 text-center w-full px-4">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-1">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-wide uppercase">WhatsApp Connected</h3>
              <p className="text-xs font-semibold text-slate-500 mt-2 mb-3">
                Active as <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md">+{status.phoneNumber}</span>
              </p>
              
              {/* Active Queue Statistics and Safety Capping Indicator */}
              <div className="flex flex-col items-center gap-2 mt-3">
                {status.rateLimitReached && (
                  <div className="text-rose-600 dark:text-rose-400 font-black text-[9px] uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-100 dark:border-rose-500/20 flex items-center gap-1.5 animate-pulse">
                    <span className="shrink-0">⚠️</span> Hourly Cap Hit (50 Max)
                  </div>
                )}
                {status.queuedCount && status.queuedCount > 0 ? (
                  <div className="text-indigo-600 dark:text-indigo-400 font-black text-[9px] uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-1.5">
                    <span className="shrink-0">⏳</span> {status.queuedCount} Messages Queued
                  </div>
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 font-bold text-[9px] uppercase tracking-widest bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> Ready for dispatch
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              <LogOut size={12} /> Terminate Session
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full px-4 text-center">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl w-full max-w-[200px] aspect-square flex items-center justify-center relative overflow-hidden shadow-xs">
              {qrCode ? (
                <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain rounded-xl mix-blend-multiply dark:mix-blend-normal dark:invert" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <QrCode size={28} className="mb-2 opacity-50 text-slate-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 text-slate-500">Generating QR...</p>
                </div>
              )}
            </div>
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
                Open WhatsApp on your phone &rarr; Tap <span className="font-bold text-slate-800 dark:text-slate-200">Linked Devices</span> &rarr; <span className="font-bold text-slate-800 dark:text-slate-200">Link a Device</span> and scan the code.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
