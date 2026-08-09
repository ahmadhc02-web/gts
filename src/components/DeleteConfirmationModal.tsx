import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, ShieldAlert, RotateCcw, X, Flame } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  onTrash: () => void | Promise<void>;
  onPermanentDelete: () => void | Promise<void>;
  isProcessing?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  title,
  itemName,
  itemType = 'Record',
  onTrash,
  onPermanentDelete,
  isProcessing = false,
}) => {
  const [loadingType, setLoadingType] = React.useState<'trash' | 'permanent' | null>(null);

  if (!isOpen) return null;

  const handleTrashClick = async () => {
    try {
      setLoadingType('trash');
      await onTrash();
      onClose();
    } catch (error) {
      console.error("Trash action error:", error);
    } finally {
      setLoadingType(null);
    }
  };

  const handlePermanentClick = async () => {
    try {
      setLoadingType('permanent');
      await onPermanentDelete();
      onClose();
    } catch (error) {
      console.error("Permanent delete action error:", error);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={loadingType ? undefined : onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden z-10"
        >
          {/* Top Decorative Header Accent */}
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600" />

          {/* Close Icon Button */}
          <button
            onClick={onClose}
            disabled={!!loadingType || isProcessing}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            <X size={18} />
          </button>

          <div className="p-6 sm:p-8 text-center space-y-6">
            {/* Warning Icon Badge */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-500 border border-rose-500/20">
              <ShieldAlert size={36} className="animate-pulse" />
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-md">
                <Trash2 size={12} />
              </div>
            </div>

            {/* Title & Info */}
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                {title || `Delete ${itemType}`}
              </h3>
              {itemName && (
                <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 max-w-full truncate">
                  "{itemName}"
                </div>
              )}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                How would you like to process this deletion request? Choose an option below:
              </p>
            </div>

            {/* Options Description Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {/* Trash option description */}
              <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                  <RotateCcw size={13} />
                  <span>Move to Trash</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal">
                  Saves to Recycle Bin. Can be easily restored anytime later.
                </p>
              </div>

              {/* Permanent option description */}
              <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
                  <Flame size={13} />
                  <span>Permanent</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal">
                  Completely purges from system. Cannot be recovered.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              {/* Move to Trash Button */}
              <button
                onClick={handleTrashClick}
                disabled={!!loadingType || isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loadingType === 'trash' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                <span>Move to Trash (Recycle Bin)</span>
              </button>

              {/* Permanent Delete Button */}
              <button
                onClick={handlePermanentClick}
                disabled={!!loadingType || isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loadingType === 'permanent' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Flame size={16} />
                )}
                <span>Permanent Delete</span>
              </button>

              {/* Cancel Button */}
              <button
                onClick={onClose}
                disabled={!!loadingType || isProcessing}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
