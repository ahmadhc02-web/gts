import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, RotateCcw, Send, Loader2, Phone } from 'lucide-react';

export interface ReminderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientUsername: string;
  mobileNumber: string;
  defaultMessage: string;
  onResetToDefault?: () => string;
  onSend: (editedMessage: string) => Promise<void>;
  isSending?: boolean;
}

export default function ReminderPreviewModal({
  isOpen,
  onClose,
  clientName,
  clientUsername,
  mobileNumber,
  defaultMessage,
  onResetToDefault,
  onSend,
  isSending = false
}: ReminderPreviewModalProps) {
  const [text, setText] = useState(defaultMessage);

  // Sync / discard edits whenever the modal opens or defaultMessage changes
  useEffect(() => {
    if (isOpen) {
      setText(defaultMessage);
    }
  }, [isOpen, defaultMessage]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSending]);

  if (typeof document === 'undefined') return null;

  const handleReset = () => {
    if (onResetToDefault) {
      setText(onResetToDefault());
    } else {
      setText(defaultMessage);
    }
  };

  const handleSendClick = async () => {
    if (!text.trim() || isSending) return;
    await onSend(text);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            key="reminder-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={isSending ? undefined : onClose}
            className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs"
          />

          {/* Modal Card / Bottom Sheet on mobile */}
          <motion.div
            key="reminder-preview-card"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="relative w-full sm:max-w-lg bg-[var(--neu-surface,#ffffff)] dark:bg-[#2b2d33] border border-slate-200/90 dark:border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] z-10"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-slate-150 dark:border-white/10 bg-white dark:bg-[#2b2d33]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-xs">
                  <MessageCircle size={20} className="fill-emerald-500/20" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate font-display">
                      {clientName || 'Client Reminder'}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 shrink-0">
                      Preview
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex-wrap">
                    {clientUsername && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                        @{clientUsername}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                      <Phone size={11} className="text-emerald-500 shrink-0" />
                      {mobileNumber || 'No phone'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                aria-label="Close"
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message Bubble-style Preview Area */}
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-[#222428]/80 border-b border-slate-200/80 dark:border-white/5 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Message Content (Editable)
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {text.length} characters
                </span>
              </div>

              {/* Message Bubble */}
              <div className="relative rounded-2xl rounded-tl-sm p-4 bg-[#e7fedb]/70 dark:bg-[#005c4b]/20 border border-[#c6f6b1] dark:border-[#005c4b]/40 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/40 transition-all">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  disabled={isSending}
                  placeholder="Type reminder message..."
                  className="w-full bg-transparent resize-y text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed outline-hidden border-0 p-0 font-sans focus:ring-0 placeholder:text-slate-400 selection:bg-emerald-500/30"
                />
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-emerald-900/10 dark:border-white/5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="italic text-emerald-800 dark:text-emerald-300">Preview as recipient will see</span>
                  <span className="font-mono tabular-nums">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Reset to Default Button & Helper */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSending || text === defaultMessage}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Reset to default template"
                >
                  <RotateCcw size={12} />
                  <span>Reset to default</span>
                </button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Local edit only
                </span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-5 flex items-center justify-end gap-2.5 bg-white dark:bg-[#2b2d33]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendClick}
                disabled={isSending || !text.trim()}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Send message</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
