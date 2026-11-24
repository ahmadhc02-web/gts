import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  History,
  X,
  Search,
  Database,
  LogIn,
  FolderPlus,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { googleSheetsService } from '../../services/googleSheetsService';
import { DeferredBody } from '../ui/DeferredBody';
import { SkBar, SkFrame } from '../skeleton/Skeleton';
import { safeRemoveStorageItem } from './storageCache';

export interface HistoryPanelProps {
  onClose: () => void;
  historySearchQuery: string;
  setHistorySearchQuery: (q: string) => void;
  backupTokens: any;
  setBackupTokens: (t: any) => void;
  backupSpreadsheetId: string;
  setBackupSpreadsheetId: (id: string) => void;
  isBackingUp: boolean;
  onConnectBackupAccount: () => void;
  onCreateBackupSheet: () => void;
  onBackupLedgerHistory: () => void;
  onTerminateMonth: () => void;
  ledgerHistory: any[];
  loadedSheetId: string | null;
  onLoadHistorySheet: (sheet: any) => void;
  onDeleteHistorySheet: (sheetId: string, e: React.MouseEvent) => void;
}

const HistoryPanelBodyFallback: React.FC = () => (
  <SkFrame className="flex-1 min-h-[380px] p-3.5 space-y-3">
    <SkBar w="w-40" h="h-3" />
    <SkBar w="w-full" h="h-8" rounded="rounded-lg" />
    <div className="space-y-2 pt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkBar key={i} w="w-full" h="h-16" rounded="rounded-xl" />
      ))}
    </div>
  </SkFrame>
);

const HistoryPanel: React.FC<HistoryPanelProps> = React.memo(({
  onClose,
  historySearchQuery,
  setHistorySearchQuery,
  backupTokens,
  setBackupTokens,
  backupSpreadsheetId,
  setBackupSpreadsheetId,
  isBackingUp,
  onConnectBackupAccount,
  onCreateBackupSheet,
  onBackupLedgerHistory,
  onTerminateMonth,
  ledgerHistory,
  loadedSheetId,
  onLoadHistorySheet,
  onDeleteHistorySheet,
}) => {
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return ledgerHistory;
    const q = historySearchQuery.toLowerCase();
    return ledgerHistory.filter((sheet) => {
      if (sheet.recOfficer?.toLowerCase().includes(q)) return true;
      if (sheet.area?.toLowerCase().includes(q)) return true;
      if (sheet.sheetDate?.toLowerCase().includes(q)) return true;

      if (sheet.table1Rows && Array.isArray(sheet.table1Rows)) {
        const itemMatch = sheet.table1Rows.some(
          (r: any) =>
            (r.cId && String(r.cId).toLowerCase().includes(q)) ||
            (r.name && String(r.name).toLowerCase().includes(q)) ||
            (r.comments && String(r.comments).toLowerCase().includes(q))
        );
        if (itemMatch) return true;
      }
      return false;
    });
  }, [ledgerHistory, historySearchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="transform-gpu will-change-transform w-[380px] shrink-0 bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4 font-sans text-slate-900 dark:text-slate-100 print:hidden text-left h-full overflow-y-auto scrollbar-thin z-[400] max-w-full max-lg:absolute max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:shadow-2xl lg:relative"
    >
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <History className="text-brand-accent h-5 w-5" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-mono">
              Ledger Registry
            </h3>
            <p className="text-[10px] text-slate-400">Monthly recovery historical cards</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer border-none bg-transparent"
        >
          <X size={14} />
        </button>
      </div>

      {/* Advanced Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
          <Search size={14} />
        </span>
        <input
          type="text"
          placeholder="Advanced Search Client ID or Name..."
          value={historySearchQuery}
          onChange={(e) => setHistorySearchQuery(e.target.value)}
          className="w-full bg-slate-950/80 border border-slate-800 focus:border-brand-accent rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
        />
        {historySearchQuery && (
          <button
            onClick={() => setHistorySearchQuery('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 text-[10px] bg-transparent border-none"
          >
            Clear
          </button>
        )}
      </div>

      <DeferredBody fallback={<HistoryPanelBodyFallback />}>
        {/* Financial Backup & Terminate Control Center */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1">
              <Database size={10} className="text-brand-accent" />
              Backup & Monthly Resets
            </span>
            {backupTokens ? (
              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase border border-emerald-500/10">
                🟢 Ready
              </span>
            ) : (
              <span className="text-[9px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-black uppercase border border-rose-500/10">
                ⚠️ Off-line
              </span>
            )}
          </div>

          {!backupTokens ? (
            <button
              onClick={onConnectBackupAccount}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand-accent hover:opacity-95 text-white text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer shadow-md border-none"
            >
              <LogIn size={11} />
              Authorize Backup Google Account
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Paste Backup Spreadsheet ID"
                  value={backupSpreadsheetId}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setBackupSpreadsheetId(val);
                    googleSheetsService.saveBackupSpreadsheetId(val);
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-300 outline-none"
                />
                <button
                  onClick={onCreateBackupSheet}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-black uppercase shrink-0 border border-slate-700 cursor-pointer"
                  title="Create a fresh workbook in target secondary drive"
                >
                  <FolderPlus size={11} />
                </button>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={onBackupLedgerHistory}
                  disabled={isBackingUp}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white text-[10px] font-black tracking-wider uppercase rounded-lg shadow-md transition-all cursor-pointer border-none"
                  title="Google spreadsheet ledger backup with date sections integration"
                >
                  <FileSpreadsheet size={11} />
                  {isBackingUp ? 'Backing up...' : 'Backup Grid'}
                </button>

                <button
                  onClick={onTerminateMonth}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 hover:text-white text-white text-[10px] font-black tracking-wider uppercase rounded-lg shadow-md transition-all cursor-pointer border-none"
                  title="Trigger month-end reset, archiving and purging cards"
                >
                  <Trash2 size={11} />
                  Terminate
                </button>
              </div>

              <button
                onClick={() => {
                  safeRemoveStorageItem('gts_ledger_backup_google_tokens');
                  setBackupTokens(null);
                  toast.success('Disconnected secondary backup google account!');
                }}
                className="text-right text-[8.5px] text-slate-500 hover:text-slate-400 hover:underline mt-1 bg-transparent border-none cursor-pointer"
              >
                Disconnect Backup Account
              </button>
            </div>
          )}
        </div>

        {/* Cards List Scroller */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[440px] scrollbar-thin scrollbar-thumb-slate-800 pr-1">
          <div className="text-[9.5px] uppercase font-black font-mono tracking-wider text-slate-500 px-1">
            Registered Sheets ({filteredHistory.length})
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1 border border-dashed border-slate-800 rounded-xl">
              <AlertCircle size={16} className="text-slate-600" />
              <span>No historical cards match.</span>
            </div>
          ) : (
            filteredHistory.map((sheet, idx) => {
              const isLoaded = loadedSheetId === sheet.id;
              const t1Valid = (Array.isArray(sheet.table1Rows) ? sheet.table1Rows : []).filter(
                (r: any) => r.cId || r.name || r.amount > 0
              );
              const sumT1 = t1Valid.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

              return (
                <div
                  key={`sheet-hist-${sheet.id}-${idx}`}
                  onClick={() => onLoadHistorySheet(sheet)}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' }}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isLoaded
                      ? 'bg-brand-accent/10 border-brand-accent/60 shadow-md shadow-brand-accent/10'
                      : 'bg-slate-950/45 hover:bg-slate-900/60 border-slate-850 hover:border-slate-700'
                  }`}
                >
                  {/* Delete button card */}
                  <button
                    onClick={(e) => onDeleteHistorySheet(sheet.id, e)}
                    className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer border-none bg-transparent"
                    title="Delete this ledger card"
                  >
                    <Trash2 size={11} />
                  </button>

                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-brand-accent/20 border border-brand-accent/35 flex items-center justify-center text-xs font-black text-brand-accent font-mono">
                      {sheet.recOfficer?.substring(0, 2).toUpperCase() || 'RO'}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase text-slate-200 line-clamp-1 pr-4">
                        {sheet.recOfficer || 'Unnamed Roll'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{sheet.sheetDate}</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] border-t border-slate-800/60 pt-2 font-mono">
                    <span className="text-slate-400">
                      Area: <span className="text-slate-200 font-bold uppercase">{sheet.area || 'MAIN'}</span>
                    </span>
                    <span className="text-slate-400">
                      Sum: <span className="text-emerald-400 font-bold">Rs. {sumT1}</span>
                    </span>
                  </div>

                  {isLoaded && (
                    <div className="absolute bottom-1 right-2 text-[8px] uppercase tracking-widest font-black text-brand-accent">
                      Active Panel
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="bg-slate-950/20 rounded-lg p-2.5 text-[9px] text-slate-500 leading-normal border border-slate-900">
          ⚡ <span className="font-extrabold uppercase">Interactive Hub:</span> Select historic cards to restore state into live printable sheet paper. Re-run advanced queries directly above.
        </div>
      </DeferredBody>
    </motion.div>
  );
});
HistoryPanel.displayName = 'HistoryPanel';

export default HistoryPanel;
