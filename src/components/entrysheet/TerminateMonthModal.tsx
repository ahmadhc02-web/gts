import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { overlayMotion, dialogMotion } from '../../lib/motionPresets';
import { DeferredBody } from '../ui/DeferredBody';
import { SkBar, SkFrame } from '../skeleton/Skeleton';

export interface TerminateMonthModalProps {
  sheetCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const TerminateMonthModal: React.FC<TerminateMonthModalProps> = React.memo(({
  sheetCount,
  onConfirm,
  onCancel,
}) => {
  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 bg-slate-950/80 sm:backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
    >
      <motion.div
        {...dialogMotion}
        className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left"
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500 shrink-0">
              <AlertCircle size={20} className="text-amber-500" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-500 font-mono">
                TERMINATE ACTIVE MONTH
              </h4>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Are you absolutely sure?
              </h3>
            </div>
          </div>

          <DeferredBody
            fallback={
              <SkFrame className="min-h-[146px] p-3 space-y-3">
                <SkBar w="w-2/3" h="h-3" />
                <SkBar w="w-full" h="h-10" />
                <SkBar w="w-full" h="h-9" rounded="rounded-xl" />
                <SkBar w="w-full" h="h-8" rounded="rounded-xl" />
              </SkFrame>
            }
          >
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p className="uppercase text-[9px] font-bold text-slate-400">
                This is a critical reset operation:
              </p>
              <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                This will permanently clear and move{' '}
                <span className="text-rose-500 font-black">{sheetCount} sheets</span> of your current month's active records to the recycle bin. Please verify you have exported or backed up first.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onConfirm}
                className="w-full py-2 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-amber-550/15 border-none text-center"
              >
                ☢️ Terminate & Archive Month
              </button>

              <button
                onClick={onCancel}
                className="w-full py-1.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border border-slate-200 dark:border-slate-700 text-center"
              >
                Cancel
              </button>
            </div>
          </DeferredBody>
        </div>
      </motion.div>
    </motion.div>
  );
});
TerminateMonthModal.displayName = 'TerminateMonthModal';

export default TerminateMonthModal;
