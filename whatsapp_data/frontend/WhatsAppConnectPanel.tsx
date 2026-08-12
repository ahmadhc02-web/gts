import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, LogOut, CheckCircle2, Loader2, X } from 'lucide-react';
import { getStatus, getQr, disconnectWhatsApp } from './whatsappApi';
import WhatsAppMessageTemplateBox from './WhatsAppMessageTemplateBox';
import { motion, AnimatePresence } from 'motion/react';

export default function WhatsAppConnectPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<{ connected: boolean; phoneNumber: string | null } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      if (!data.connected) {
        const qrData = await getQr();
        if (qrData.qr) {
          setQrCode(qrData.qr);
        }
      }
    } catch (error) {
      console.error('Failed to fetch WhatsApp status', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await disconnectWhatsApp();
      await fetchStatus();
    } catch (err) {
      console.error('Disconnect failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors z-10">
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Smartphone size={20} className="fill-emerald-500/20" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">WhatsApp Integration</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Automated Billing Reminders</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
          {isLoading && !status ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-widest">Connecting...</p>
            </div>
          ) : status?.connected ? (
            <div className="flex flex-col items-center gap-4 text-center w-full">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Connected</h3>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  Active as <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">+{status.phoneNumber}</span>
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
              >
                <LogOut size={14} /> Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 p-4 rounded-2xl w-full max-w-[240px] aspect-square flex items-center justify-center relative overflow-hidden">
                {qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain rounded-xl mix-blend-multiply dark:mix-blend-normal dark:invert" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <QrCode size={32} className="mb-2 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">Generating QR...</p>
                  </div>
                )}
              </div>
              <div className="text-center mt-2 px-2">
                <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400">
                  Open WhatsApp on your phone<br/>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Linked Devices</span> &rarr; <span className="font-bold text-slate-800 dark:text-slate-200">Link a Device</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <WhatsAppMessageTemplateBox />
      </motion.div>
    </div>
  );
}
