import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { overlayMotion, dialogMotion } from '../../lib/motionPresets';
import { DeferredBody } from '../ui/DeferredBody';
import { SkBar, SkFrame } from '../skeleton/Skeleton';

export interface FolderSettingsModalProps {
  editFolderName: string;
  setEditFolderName: (v: string) => void;
  editConnectedMonthId: string;
  setEditConnectedMonthId: (v: string) => void;
  monthsList: any[];
  onClose: () => void;
  onSave: () => void;
}

const FolderSettingsModal: React.FC<FolderSettingsModalProps> = React.memo(({
  editFolderName,
  setEditFolderName,
  editConnectedMonthId,
  setEditConnectedMonthId,
  monthsList,
  onClose,
  onSave,
}) => {
  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 sm:backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        {...dialogMotion}
        onClick={(e) => e.stopPropagation()}
        className="transform-gpu will-change-transform bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-white/10"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Folder Settings
            </h3>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Manage Recovery Connection
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <DeferredBody
          fallback={
            <SkFrame className="min-h-[250px] p-4 space-y-4">
              <div className="space-y-2">
                <SkBar w="w-24" h="h-2.5" />
                <SkBar w="w-full" h="h-10" rounded="rounded-xl" />
              </div>
              <div className="space-y-2">
                <SkBar w="w-44" h="h-2.5" />
                <SkBar w="w-full" h="h-10" rounded="rounded-xl" />
                <SkBar w="w-full" h="h-10" />
              </div>
              <SkBar w="w-full" h="h-10" rounded="rounded-xl" />
            </SkFrame>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Enter folder name..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500 mb-2"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">
                Connected Recovery Sheet (Billing Month)
              </label>
              <select
                value={editConnectedMonthId}
                onChange={(e) => setEditConnectedMonthId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Not Connected --</option>
                {monthsList.map((m, mIdx) => {
                  const totalTarget =
                    (m as any).rows?.reduce(
                      (acc: number, r: any) => acc + (parseFloat(r.totalAmount) || 0),
                      0
                    ) || 0;
                  return (
                    <option key={`m-${m.id}-${mIdx}`} value={m.id}>
                      {m.id}
                      {totalTarget > 0 ? ` (Target: ${totalTarget.toLocaleString()})` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase mt-2 leading-relaxed">
                When connected, any entry activity inside this folder will automatically update the selected Recovery Sheet. If not connected, updates will remain local.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200/60 dark:border-white/10">
              <button
                onClick={onSave}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-md"
              >
                Save & Close
              </button>
            </div>
          </div>
        </DeferredBody>
      </motion.div>
    </motion.div>
  );
});
FolderSettingsModal.displayName = 'FolderSettingsModal';

export default FolderSettingsModal;
