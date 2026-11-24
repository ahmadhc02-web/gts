import React from 'react';
import {
  ChevronLeft,
  Folder,
  Shield,
  Check,
  SlidersHorizontal,
  Printer,
  History,
  RefreshCw,
  Save,
  Loader2,
} from 'lucide-react';

export interface EditorToolbarProps {
  onClose: () => void;
  onNavigateFolders: () => void;
  isLocked: boolean;
  rowsFilledCount: number;
  totalAmount1: number;
  totalAmount2: number;
  zoomOption: 'fit' | '100%' | '85%' | '75%';
  onSelectZoom: (opt: 'fit' | '100%' | '85%' | '75%') => void;
  showSizingPanel: boolean;
  onToggleSizing: () => void;
  onPrint: () => void;
  showHistoryPanel: boolean;
  onToggleHistory: () => void;
  isDataFresh: boolean;
  staleOk: boolean;
  isSyncSlow: boolean;
  onTriggerResync: () => void;
  isSavingSheet: boolean;
  onSaveSheet: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = React.memo(({
  onClose,
  onNavigateFolders,
  isLocked,
  rowsFilledCount,
  totalAmount1,
  totalAmount2,
  zoomOption,
  onSelectZoom,
  showSizingPanel,
  onToggleSizing,
  onPrint,
  showHistoryPanel,
  onToggleHistory,
  isDataFresh,
  staleOk,
  isSyncSlow,
  onTriggerResync,
  isSavingSheet,
  onSaveSheet,
}) => {
  return (
    <div className="w-full bg-[#fcfcfc] dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 shadow-sm px-3 sm:px-6 py-1.5 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 z-[310] print:hidden shrink-0 select-none">
      {/* Left Block */}
      <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <ChevronLeft size={14} className="text-blue-500" />
          Portal
        </button>
        <button
          onClick={onNavigateFolders}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-455 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 border border-blue-200 dark:border-blue-900/50 cursor-pointer"
        >
          <Folder size={12} className="stroke-[2.5]" />
          Folders Dashboard
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden sm:block" />
        <div>
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            Ledger Workspace
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:block">
              A4 PRINT-READY INTEGRATION CONSOLE
            </p>
            <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[7.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Shield size={8} />
                Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[7.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <Check size={8} />
                Unlocked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Block: Live statistics feedback */}
      <div className="flex items-center gap-4 text-[10px] bg-slate-50/50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hidden lg:flex">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">
            ROWS FILLED
          </span>
          <span className="font-extrabold text-[#0f172a] dark:text-slate-100">
            {rowsFilledCount} / 22
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">
            COLLECTED TOTAL
          </span>
          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
            Rs. {totalAmount1.toLocaleString()}
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">
            AUXILIARY AMNT
          </span>
          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
            Rs. {totalAmount2.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Right Block: Main controller actions */}
      <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto scrollbar-none pb-1 sm:pb-0 shrink-0">
        {/* Viewport Scale Control */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-0.5 border border-slate-250 dark:border-white/10 text-[9px] font-black uppercase shrink-0">
          <span className="text-slate-400 dark:text-slate-500 px-1.5 font-black text-[8px]">ZOOM</span>
          {(['fit', '100%', '85%', '75%'] as const).map((zOpt) => (
            <button
              key={zOpt}
              onClick={() => onSelectZoom(zOpt)}
              className={`px-2 py-1 rounded-lg font-extrabold cursor-pointer transition-all border-none ${
                zoomOption === zOpt
                  ? 'bg-brand-accent text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white bg-transparent'
              }`}
            >
              {zOpt === 'fit' ? 'Auto' : zOpt}
            </button>
          ))}
        </div>

        {/* Sizing Toggle */}
        <button
          onClick={onToggleSizing}
          className={`p-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1 ${
            showSizingPanel
              ? 'bg-brand-accent border-brand-accent text-white shadow-md shadow-brand-accent/20'
              : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-705 border-slate-200 dark:border-slate-705 text-slate-700 dark:text-slate-300'
          }`}
          title="Toggle Sizing and Column Width Sliders"
        >
          <SlidersHorizontal size={12} />
          <span className="hidden md:inline">Sizing</span>
        </button>

        {/* Print */}
        <button
          onClick={onPrint}
          className="p-2 rounded-xl bg-brand-accent hover:opacity-90 text-white text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md shadow-brand-accent/15 flex items-center gap-1 border-none"
          title="Print to Paper or save PDF"
        >
          <Printer size={12} />
          <span>Print</span>
        </button>

        {/* Registry History */}
        <button
          onClick={onToggleHistory}
          className={`p-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1 ${
            showHistoryPanel
              ? 'bg-brand-accent border-brand-accent text-white shadow-md shadow-brand-accent/20'
              : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-705 border-slate-200 dark:border-slate-705 text-slate-700 dark:text-slate-300'
          }`}
          title="Toggle Historical Month Registry Logs"
        >
          <History size={12} />
          <span>History</span>
        </button>

        {/* Non-blocking sync status chip if not fresh */}
        {!isDataFresh && (
          <span
            className={`h-6 px-2 rounded-full text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
              staleOk
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                : isSyncSlow
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
            title={
              staleOk
                ? 'Using cached data while background sync finishes; saves are checked for conflicts'
                : isSyncSlow
                ? 'Sync is taking longer than expected'
                : 'Syncing fresh data from cloud database...'
            }
          >
            {!staleOk && <RefreshCw size={10} className="animate-spin shrink-0" />}
            <span>
              {staleOk ? 'Using saved data' : isSyncSlow ? 'Sync is slow - Retry' : 'Syncing latest data...'}
            </span>
            {isSyncSlow && !staleOk && (
              <button
                type="button"
                onClick={onTriggerResync}
                className="ml-0.5 px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                Retry
              </button>
            )}
          </span>
        )}

        {/* Save active sheet */}
        <button
          onClick={onSaveSheet}
          disabled={isSavingSheet || (!isDataFresh && !staleOk)}
          className={`p-2 rounded-xl text-white text-[9px] font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1 border-none ${
            isSavingSheet || (!isDataFresh && !staleOk)
              ? 'bg-emerald-600/50 cursor-not-allowed opacity-60'
              : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95'
          }`}
          title="Commit active sheet to historical database logs"
        >
          {isSavingSheet ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          <span>{isSavingSheet ? 'Saving...' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
});
EditorToolbar.displayName = 'EditorToolbar';
