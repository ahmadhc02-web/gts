
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { WhatsAppNotification, generateWhatsAppMessage, sendWhatsAppNotification } from '../lib/whatsapp';
import { cn } from '../lib/utils';

interface WhatsAppNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WhatsAppNotification | null;
}

export default function WhatsAppNotificationModal({ isOpen, onClose, data }: WhatsAppNotificationModalProps) {
  if (!data) return null;

  const message = generateWhatsAppMessage(data);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col relative"
          >
            {/* Header / Accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
            
            <div className="p-8 sm:p-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                    <MessageSquare size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      WhatsApp Dispatch
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                      Operational Notify Protocol
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 relative group">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Transmission Preview</span>
                </div>
                
                <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed font-sans mt-2">
                  {message}
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">End-to-End Encryption</span>
                   </div>
                   <span className="text-[10px] font-black text-emerald-500/80 uppercase tabular-nums">DISPATCH_READY</span>
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-8 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    sendWhatsAppNotification(data);
                    onClose();
                  }}
                  className="flex-1 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
                >
                  <Send size={18} />
                  Dispatch Link
                </button>
              </div>

              <div className="mt-6 text-center">
                 <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <Zap size={8} />
                    Auto-routing via operational gateway
                    <Zap size={8} />
                 </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
