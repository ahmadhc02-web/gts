import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, Trash2, CheckCircle2, Info } from 'lucide-react';

interface VertixModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string; // e.g. "text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
  maxWidth?: string; // e.g. "max-w-md", "max-w-lg"
  children: ReactNode;
  isDarkMode?: boolean;
}

export function VertixModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950',
  maxWidth = 'max-w-md',
  children,
  isDarkMode = false,
}: VertixModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
            className={`w-full ${maxWidth} max-h-[90dvh] overflow-y-auto my-auto rounded-3xl p-4 sm:p-5 shadow-2xl border ${
              isDarkMode
                ? 'bg-[#161b24] border-[#2d3648] text-white'
                : 'bg-white border-slate-300 text-slate-950'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
              <div className="flex items-center gap-2.5">
                {Icon && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="font-black text-sm sm:text-base leading-tight text-slate-950 dark:text-white">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1e2636] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface VertixLandscapeCardProps {
  title: string;
  value: string | number;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgGradient: string;
  onClick?: () => void;
  isDarkMode?: boolean;
}

export function VertixLandscapeCard({
  title,
  value,
  badge,
  badgeColor = 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-700',
  icon: Icon,
  iconBgGradient,
  onClick,
  isDarkMode = false,
}: VertixLandscapeCardProps) {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={`h-[86px] sm:h-[90px] px-3.5 py-2.5 rounded-[22px] border shadow-xs flex items-center justify-between gap-3 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isDarkMode
          ? 'bg-[#161b24] border-[#2d3648] hover:border-emerald-500/60 hover:bg-[#1c2330]'
          : 'bg-white border-slate-300 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-11 h-11 rounded-2xl ${iconBgGradient} text-white flex items-center justify-center shrink-0 shadow-sm`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 leading-tight truncate">
            {title}
          </p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-none mt-1 truncate tabular-nums">
            {value}
          </h3>
        </div>
      </div>
      {badge && (
        <div className="shrink-0 text-right">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${badgeColor}`}>
            {badge}
          </span>
        </div>
      )}
    </motion.div>
  );
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  subMessage?: string;
  isDarkMode?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  subMessage,
  isDarkMode = false,
}: ConfirmDeleteModalProps) {
  return (
    <VertixModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={Trash2}
      iconColor="text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950"
      maxWidth="max-w-sm"
      isDarkMode={isDarkMode}
    >
      <div className="space-y-2 text-xs">
        <p className="text-slate-900 dark:text-slate-100 font-semibold">{message}</p>
        {subMessage && <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{subMessage}</p>}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
        >
          Yes, Delete
        </button>
      </div>
    </VertixModal>
  );
}
