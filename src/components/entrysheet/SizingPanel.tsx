import React from 'react';
import { motion } from 'motion/react';
import { Settings2, RotateCcw } from 'lucide-react';

export interface SizingPanelProps {
  rowPadding: number;
  setRowPadding: (v: number) => void;
  tableFontSize: number;
  setTableFontSize: (v: number) => void;
  headerFontSize: number;
  setHeaderFontSize: (v: number) => void;
  paperPaddingY: number;
  setPaperPaddingY: (v: number) => void;
  paperPaddingX: number;
  setPaperPaddingX: (v: number) => void;
  t1WidthSr: number;
  setT1WidthSr: (v: number) => void;
  t1WidthId: number;
  setT1WidthId: (v: number) => void;
  t1WidthName: number;
  setT1WidthName: (v: number) => void;
  t1WidthComments: number;
  setT1WidthComments: (v: number) => void;
  t1WidthAmount: number;
  setT1WidthAmount: (v: number) => void;
  t2WidthName: number;
  setT2WidthName: (v: number) => void;
  t2WidthAmount: number;
  setT2WidthAmount: (v: number) => void;
  onShowSaveWidthsBar: () => void;
  onResetSizingToDefault: () => void;
}

const SizingPanel: React.FC<SizingPanelProps> = React.memo(({
  rowPadding,
  setRowPadding,
  tableFontSize,
  setTableFontSize,
  headerFontSize,
  setHeaderFontSize,
  paperPaddingY,
  setPaperPaddingY,
  paperPaddingX,
  setPaperPaddingX,
  t1WidthSr,
  setT1WidthSr,
  t1WidthId,
  setT1WidthId,
  t1WidthName,
  setT1WidthName,
  t1WidthComments,
  setT1WidthComments,
  t1WidthAmount,
  setT1WidthAmount,
  t2WidthName,
  setT2WidthName,
  t2WidthAmount,
  setT2WidthAmount,
  onShowSaveWidthsBar,
  onResetSizingToDefault,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="transform-gpu will-change-transform bg-[#fdfdfd] dark:bg-slate-900 border-r border-slate-205 dark:border-white/10 p-4 overflow-y-auto shrink-0 print:hidden h-full text-slate-850 dark:text-slate-100 select-none text-left scrollbar-thin flex flex-col gap-3 font-mono z-[400] max-lg:absolute max-lg:top-0 max-lg:bottom-0 max-lg:left-0 max-lg:shadow-2xl max-lg:w-[calc(100vw-32px)] max-w-full lg:relative lg:w-[280px]"
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-150 dark:border-white/10 mb-3">
        <div className="flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-brand-accent animate-spin-slow" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc]">
            Sizing Designer
          </span>
        </div>
        <button
          onClick={onResetSizingToDefault}
          className="flex items-center gap-0.5 text-[8px] font-black text-slate-400 hover:text-brand-accent transition-colors cursor-pointer border-none bg-transparent"
          title="Reset to default sizes"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          RESET
        </button>
      </div>

      {/* Spacing & Scaling Slider Section */}
      <div className="space-y-2.5">
        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Row padding</span>
            <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">
              {rowPadding}px
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="14"
            step="0.5"
            value={rowPadding}
            onChange={(e) => setRowPadding(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
          />
          <span className="text-[7.5px] text-slate-450 leading-none block mt-1">
            Squeeze padding to fit lines on one page.
          </span>
        </div>

        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Table Font Size</span>
            <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">
              {tableFontSize}px
            </span>
          </div>
          <input
            type="range"
            min="8"
            max="15"
            step="0.5"
            value={tableFontSize}
            onChange={(e) => setTableFontSize(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
          />
        </div>

        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Header Font Size</span>
            <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">
              {headerFontSize}px
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            step="0.5"
            value={headerFontSize}
            onChange={(e) => setHeaderFontSize(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
          />
          <span className="text-[7.5px] text-slate-450 leading-none block mt-1">
            Scale top header fields (OFFICER, AREA, DATE).
          </span>
        </div>

        {/* Page Margins Controllers */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-white/10 shadow-sm">
            <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              Top Margin
            </span>
            <span className="text-[8px] font-mono text-brand-accent block mb-1">{paperPaddingY}mm</span>
            <input
              type="range"
              min="2"
              max="22"
              value={paperPaddingY}
              onChange={(e) => setPaperPaddingY(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
            />
          </div>
          <div className="p-2 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-white/10 shadow-sm">
            <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              Side Margin
            </span>
            <span className="text-[8px] font-mono text-brand-accent block mb-1">{paperPaddingX}mm</span>
            <input
              type="range"
              min="2"
              max="22"
              value={paperPaddingX}
              onChange={(e) => setPaperPaddingX(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
            />
          </div>
        </div>

        {/* Table 1 Grid lines */}
        <div className="border-t border-slate-150 dark:border-white/10 pt-2.5 mt-1">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9] block mb-2">
            Table 1 Grid Lines (Col Width)
          </span>

          <div className="space-y-1.5 text-[8.5px] font-bold text-slate-500">
            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Sr column</span>
                <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthSr}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                value={t1WidthSr}
                onChange={(e) => {
                  setT1WidthSr(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Customer ID col</span>
                <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthId}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="150"
                value={t1WidthId}
                onChange={(e) => {
                  setT1WidthId(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Name col</span>
                <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthName}px</span>
              </div>
              <input
                type="range"
                min="100"
                max="380"
                value={t1WidthName}
                onChange={(e) => {
                  setT1WidthName(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Comments/Phone col</span>
                <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthComments}px</span>
              </div>
              <input
                type="range"
                min="100"
                max="350"
                value={t1WidthComments}
                onChange={(e) => {
                  setT1WidthComments(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Amount col</span>
                <span className="font-mono text-slate-655 dark:text-slate-400">{t1WidthAmount}px</span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                value={t1WidthAmount}
                onChange={(e) => {
                  setT1WidthAmount(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Table 2 Grid lines */}
        <div className="border-t border-slate-150 dark:border-white/10 pt-2.5">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9] block mb-2">
            Table 2 Grid Lines (Col Width)
          </span>

          <div className="space-y-1.5 text-[8.5px] font-bold text-slate-500">
            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Account Title col</span>
                <span className="font-mono text-slate-650 dark:text-slate-400">{t2WidthName}px</span>
              </div>
              <input
                type="range"
                min="150"
                max="550"
                value={t2WidthName}
                onChange={(e) => {
                  setT2WidthName(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/10">
              <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                <span>Amount col</span>
                <span className="font-mono text-slate-655 dark:text-slate-400">{t2WidthAmount}px</span>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                value={t2WidthAmount}
                onChange={(e) => {
                  setT2WidthAmount(parseInt(e.target.value));
                  onShowSaveWidthsBar();
                }}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 p-2 bg-brand-accent/10 dark:bg-brand-accent/20 rounded-lg border border-brand-accent/20 dark:border-brand-accent/10 text-[8.5px] text-brand-accent leading-normal">
        💡 <span className="font-extrabold uppercase">Grid Position:</span> Drag sliders to align columns perfectly.
      </div>
    </motion.div>
  );
});
SizingPanel.displayName = 'SizingPanel';

export default SizingPanel;
