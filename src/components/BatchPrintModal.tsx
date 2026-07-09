import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Check, Info, FileSpreadsheet, Sparkles, FolderSync, CheckSquare, Square, FileText, ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface BatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingMonths: any[];
}

export default function BatchPrintModal({ isOpen, onClose, billingMonths }: BatchPrintModalProps) {
  // Multiselect state for month sheets
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  
  // Choose columns to print
  const [enabledColumns, setEnabledColumns] = useState({
    username: true,
    area: true,
    baseAmount: true,
    cr: true,
    totalAmount: true,
    paymentReceived: true,
    paymentStatus: true,
    billingDay: false
  });

  // Filter states
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterStartDay, setFilterStartDay] = useState<string>('');
  const [filterEndDay, setFilterEndDay] = useState<string>('');

  // Automatically select the latest month on load if present
  useEffect(() => {
    if (billingMonths && billingMonths.length > 0 && selectedMonthIds.length === 0) {
      // Sort months to select the latest by default
      const sorted = [...billingMonths].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (sorted[0]) {
        setSelectedMonthIds([sorted[0].id]);
      }
    }
  }, [billingMonths]);

  if (!isOpen) return null;

  const toggleMonthSelection = (id: string) => {
    if (selectedMonthIds.includes(id)) {
      setSelectedMonthIds(prev => prev.filter(mId => mId !== id));
    } else {
      setSelectedMonthIds(prev => [...prev, id]);
    }
  };

  const toggleAllMonths = () => {
    if (selectedMonthIds.length === billingMonths.length) {
      setSelectedMonthIds([]);
    } else {
      setSelectedMonthIds(billingMonths.map(m => m.id));
    }
  };

  const handlePrint = () => {
    if (selectedMonthIds.length === 0) {
      toast.error("Please select at least one monthly sheet to print.");
      return;
    }
    window.print();
  };

  // Get active selected sheets data
  const selectedSheets = billingMonths.filter(m => selectedMonthIds.includes(m.id));

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="print-batch-overlay fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[250] flex items-stretch justify-end overflow-hidden print:p-0 print:bg-transparent print:backdrop-blur-none print:static">
        
        {/* Dynamic Left Control Side Drawer (Hidden in Print Mode) */}
        <div className="w-full md:w-[380px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-[300] print:hidden shadow-2xl relative">
          
          {/* Header Title */}
          <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-accent to-blue-500 flex items-center justify-center text-white shadow-md shadow-brand-accent/20">
                <Printer size={18} />
              </div>
              <div>
                <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-900 dark:text-white font-display">Batch Print Console</h4>
                <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest mt-0.5">Multi-Month Sheet Dispatch</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
            {/* Steps Help Banner */}
            <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="font-bold text-brand-accent uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Info size={12} /> Dynamic Batch Dispatch Guide
              </span>
              <p className="leading-relaxed font-sans font-medium">
                Mark multiple monthly ledger sheets to print simultaneously. The engine will layout each sheet meticulously, introducing page-breaks seamlessly so they load on active A4 sheets in one print command.
              </p>
            </div>

            {/* Sheets list selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 select-none">
                <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-550">
                  Select Billing Months ({selectedMonthIds.length}/{billingMonths.length})
                </span>
                <button
                  onClick={toggleAllMonths}
                  className="text-[9px] font-black uppercase tracking-widest text-brand-accent hover:underline cursor-pointer"
                >
                  {selectedMonthIds.length === billingMonths.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {billingMonths.length === 0 ? (
                <p className="text-[11px] text-slate-400 uppercase tracking-wide py-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No monthly sheets found in database.
                </p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {billingMonths.map((month) => {
                    const isChecked = selectedMonthIds.includes(month.id);
                    const rowsCount = month.rows?.length || 0;
                    return (
                      <button
                        key={month.id}
                        onClick={() => toggleMonthSelection(month.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                          isChecked
                            ? "bg-brand-accent/5 border-brand-accent/30 text-brand-accent dark:bg-brand-accent/10"
                            : "bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isChecked ? (
                            <CheckSquare size={16} className="text-brand-accent shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-400 shrink-0" />
                          )}
                          <div>
                            <span className="text-[12px] font-black uppercase tracking-wide">{month.id}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 font-mono">
                              <span>{rowsCount} subscribers</span>
                              <span>•</span>
                              <span>{new Date(month.createdAt || Date.now()).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="opacity-40" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom columns choices toggle */}
            <div className="space-y-3">
              <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-550 select-none">
                Customize Table Columns
              </span>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-150 dark:border-slate-850">
                {Object.entries(enabledColumns).map(([key, isEnabled]) => {
                  const labelMap: Record<string, string> = {
                    username: "User ID",
                    area: "Area / Zone",
                    baseAmount: "Base Rent",
                    cr: "Arrears",
                    totalAmount: "Total Expect",
                    paymentReceived: "Recovered",
                    paymentStatus: "Status",
                    billingDay: "Billing Day"
                  };
                  return (
                    <label 
                      key={key} 
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer select-none py-1 hover:text-slate-950 dark:hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => setEnabledColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-accent focus:ring-brand-accent w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{labelMap[key] || key}</span>
                    </label>
                  );
                })}
              </div>

              {/* Status and Date Filters */}
              <div className="space-y-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <span className="font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-550 select-none block mb-2">
                  Advanced Filters
                </span>
                
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Payment Status</label>
                    <select
                      value={filterPaymentStatus}
                      onChange={(e) => setFilterPaymentStatus(e.target.value as any)}
                      className="w-full text-[11px] font-mono p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"
                    >
                      <option value="all">Show All Rows</option>
                      <option value="unpaid">Only Unpaid (unpaid, tdc)</option>
                      <option value="paid">Only Paid (paid, partial)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Start Date (BD)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="e.g. 1"
                        value={filterStartDay}
                        onChange={(e) => setFilterStartDay(e.target.value)}
                        className="w-full text-[11px] font-mono p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">End Date (BD)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="e.g. 15"
                        value={filterEndDay}
                        onChange={(e) => setFilterEndDay(e.target.value)}
                        className="w-full text-[11px] font-mono p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sticky Actions Trigger Footer */}
          <div className="p-5 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
            <button
              onClick={handlePrint}
              disabled={selectedMonthIds.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-accent hover:opacity-90 disabled:opacity-30 disabled:hover:opacity-30 text-white font-black uppercase tracking-widest text-[11px] cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-brand-accent/20"
            >
              <Printer size={14} />
              Spool Print ({selectedMonthIds.length} Sheets)
            </button>
            <p className="text-[8px] text-center text-slate-400 uppercase tracking-widest font-mono font-bold">
              Pressing Spool loads A4 print preview dialog
            </p>
          </div>

        </div>

        {/* Live Scrollable Preview Canvas of printed pages (Print Mode overlay is handled separately below) */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-8 overflow-y-auto print:p-0 print:bg-white custom-scrollbar flex flex-col items-center gap-10">
          
          <div className="w-[210mm] text-center border-b border-dashed border-slate-200 dark:border-slate-850 pb-2 flex items-center justify-between print:hidden">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Printers Live Simulation Grid (A4 Portrait)
            </span>
            <span className="text-[11px] font-black text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {selectedMonthIds.length === 0 ? "Select Sheets to preview" : `${selectedMonthIds.length} Page(s) Spooled`}
            </span>
          </div>

          {/* Target Container for Print Spooling */}
          <div className="batch-print-container flex flex-col gap-8 print:gap-0 w-full max-w-[210mm] items-center">
            
            {selectedSheets.length === 0 ? (
              <div className="w-[210mm] min-h-[297mm] bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center text-center space-y-4 print:hidden dark:bg-slate-900 dark:border-slate-800">
                <FileText size={48} className="text-slate-300 dark:text-slate-700 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">No Sheets Spooled</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Choose at least one checkmark monthly ledger recovery sheet from the left side drawer.
                  </p>
                </div>
              </div>
            ) : (
              selectedSheets.map((monthDoc) => {
                let rows = monthDoc.rows || [];

                // Apply advanced filters
                if (filterPaymentStatus === 'paid') {
                  rows = rows.filter((r: any) => r.paymentStatus === 'paid' || r.paymentStatus === 'partial');
                } else if (filterPaymentStatus === 'unpaid') {
                  rows = rows.filter((r: any) => r.paymentStatus === 'unpaid' || r.paymentStatus === 'tdc' || !r.paymentStatus);
                }

                if (filterStartDay !== '') {
                  rows = rows.filter((r: any) => {
                    const day = parseInt(r.billingDay || '5', 10);
                    return day >= parseInt(filterStartDay, 10);
                  });
                }

                if (filterEndDay !== '') {
                  rows = rows.filter((r: any) => {
                    const day = parseInt(r.billingDay || '5', 10);
                    return day <= parseInt(filterEndDay, 10);
                  });
                }

                const expectedValue = rows.reduce((sum: number, r: any) => sum + (parseFloat(r.totalAmount) || 0), 0);
                const baseValue = rows.reduce((sum: number, r: any) => sum + (parseFloat(r.baseAmount) || 0), 0);
                const recoveredValue = rows.reduce((sum: number, r: any) => sum + (parseFloat(r.paymentReceived) || 0), 0);
                const outstandingValue = expectedValue - recoveredValue;
                const recoveryRate = expectedValue > 0 ? (recoveredValue / expectedValue) * 100 : 0;

                return (
                  <div 
                    key={monthDoc.id}
                    className="batch-print-page w-[210mm] min-h-[297mm] bg-white border border-slate-300 shadow-xl p-10 flex flex-col text-slate-900 justify-start break-after-page page-break-after-always"
                  >
                    {/* Official Corporate Letterhead Info */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-4">
                      <div>
                        <h2 className="text-md font-sans tracking-tight leading-none text-black font-black uppercase flex items-center gap-1.5">
                          <FileSpreadsheet className="w-5 h-5 text-black inline shrink-0" />
                          GTS INTERNET SERVICES LMT
                        </h2>
                        <p className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase mt-1">
                          Enterprise Outstanding & Recoveries Dispatch Ledger
                        </p>
                      </div>
                      <div className="text-right select-all">
                        <span className="inline-block bg-slate-900 text-white font-mono font-black text-[9px] px-2.5 py-1 tracking-wider uppercase rounded">
                          CYCLE SHEET: {monthDoc.id}
                        </span>
                        <p className="text-[8px] font-mono font-bold text-slate-400 mt-1 uppercase">
                          Generated: {new Date(monthDoc.createdAt || Date.now()).toLocaleDateString([], { month: 'long', year: 'numeric', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Statistical highlights row */}
                    <div className="grid grid-cols-4 gap-3 my-4 py-3.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-mono select-none">
                      <div className="space-y-0.5 border-r border-slate-200">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">TOTAL EXPECTED</p>
                        <p className="text-[12px] font-black text-black">PKR {expectedValue.toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">RECOVERED AMOUNT</p>
                        <p className="text-[12px] font-black text-emerald-600">PKR {recoveredValue.toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-200">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">OUTSTANDING DUE</p>
                        <p className="text-[12px] font-black text-rose-600">PKR {outstandingValue.toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">RECOVERY TAX RATE</p>
                        <p className="text-[12px] font-black text-blue-600">{recoveryRate.toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Compact Spooled subscribers data grid */}
                    <div className="flex-1 mt-1">
                      {rows.length === 0 ? (
                        <div className="py-10 border border-dashed border-slate-300 rounded-xl text-center text-[10px] text-slate-400 uppercase font-mono tracking-widest font-bold">
                          Blank Registry Month. No rows loaded.
                        </div>
                      ) : (
                        <table className="w-full border border-black border-collapse text-[10px] select-all">
                          <thead>
                            <tr className="border-b border-black font-extrabold text-center text-black uppercase font-mono select-none bg-slate-100">
                              <th className="py-1 px-1 border-r border-black w-[35px]">SR</th>
                              <th className="py-1 px-2 border-r border-black text-left">SUBSCRIBER NAME</th>
                              {enabledColumns.username && <th className="py-1 px-2 border-r border-black w-[80px]">USER ID</th>}
                              {enabledColumns.billingDay && <th className="py-1 px-2 border-r border-black w-[40px] text-center">BD</th>}
                              {enabledColumns.area && <th className="py-1 px-2 border-r border-black w-[80px]">ZONAL AREA</th>}
                              {enabledColumns.baseAmount && <th className="py-1 px-2 border-r border-black w-[65px] text-right">RENT</th>}
                              {enabledColumns.cr && <th className="py-1 px-2 border-r border-black w-[65px] text-right">ARREARS</th>}
                              {enabledColumns.totalAmount && <th className="py-1 px-2 border-r border-black w-[75px] text-right">TOTAL</th>}
                              {enabledColumns.paymentReceived && <th className="py-1 px-2 border-r border-black w-[70px] text-right">RECOVERY</th>}
                              {enabledColumns.paymentStatus && <th className="py-1 px-1 w-[55px] text-center">STATUS</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row: any, rIdx: number) => {
                              const outstanding = parseFloat(row.totalAmount || 0) - parseFloat(row.paymentReceived || 0);
                              return (
                                <tr key={rIdx} className="border-b border-slate-300 font-mono text-[9px] hover:bg-slate-50/50">
                                  <td className="py-1 px-1 border-r border-black text-center font-sans font-bold text-slate-600 select-none bg-slate-50/50">
                                    {rIdx + 1}
                                  </td>
                                  <td className="py-1 px-2 border-r border-black font-sans font-black tracking-tight uppercase">
                                    {row.name || 'Anonymous User'}
                                  </td>
                                  {enabledColumns.username && (
                                    <td className="py-1 px-2 border-r border-black text-slate-500 truncate max-w-[80px]">
                                      {row.username || 'N/A'}
                                    </td>
                                  )}
                                  {enabledColumns.billingDay && (
                                    <td className="py-1 px-2 border-r border-black text-center font-bold text-slate-700">
                                      {row.billingDay || '-'}
                                    </td>
                                  )}
                                  {enabledColumns.area && (
                                    <td className="py-1 px-2 border-r border-black text-center truncate max-w-[80px] uppercase font-sans font-semibold">
                                      {row.area || 'MAIN'}
                                    </td>
                                  )}
                                  {enabledColumns.baseAmount && (
                                    <td className="py-1 px-2 border-r border-black text-right">
                                      {parseFloat(row.baseAmount || 0).toLocaleString()}
                                    </td>
                                  )}
                                  {enabledColumns.cr && (
                                    <td className={cn(
                                      "py-1 px-2 border-r border-black text-right",
                                      parseFloat(row.cr) > 0 && "text-rose-600 font-black"
                                    )}>
                                      {parseFloat(row.cr || 0) > 0 ? parseFloat(row.cr).toLocaleString() : '-'}
                                    </td>
                                  )}
                                  {enabledColumns.totalAmount && (
                                    <td className="py-1 px-2 border-r border-black text-right font-black bg-slate-50/40">
                                      {parseFloat(row.totalAmount || 0).toLocaleString()}
                                    </td>
                                  )}
                                  {enabledColumns.paymentReceived && (
                                    <td className={cn(
                                      "py-1 px-2 border-r border-black text-right font-semibold",
                                      parseFloat(row.paymentReceived || 0) > 0 && "text-emerald-700 font-bold"
                                    )}>
                                      {parseFloat(row.paymentReceived || 0) > 0 ? parseFloat(row.paymentReceived).toLocaleString() : '0'}
                                    </td>
                                  )}
                                  {enabledColumns.paymentStatus && (
                                    <td className="py-1 px-1 text-center font-sans font-black uppercase text-[8px] select-none">
                                      <span className={cn(
                                        "px-1 py-0.5 rounded-md",
                                        row.paymentStatus === 'paid' && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                        row.paymentStatus === 'partial' && "bg-amber-50 text-amber-700 border border-amber-200",
                                        row.paymentStatus === 'unpaid' && "bg-slate-50 text-slate-500 border border-slate-200",
                                        row.paymentStatus === 'tdc' && "bg-rose-50 text-rose-700 border border-rose-200"
                                      )}>
                                        {row.paymentStatus || 'UNPAID'}
                                      </span>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Official Dispatch signature section */}
                    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-[10px] font-sans tracking-wide mt-6">
                      <div className="flex flex-col gap-1 select-none">
                        <span className="font-mono font-black text-slate-400 uppercase text-[8px]">Compiled Registry Officer</span>
                        <div className="border-b border-slate-300 border-dashed py-1 text-[11px] font-black uppercase">
                          AHMAD IQBAL / SYSTEM
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 select-none text-center">
                        <span className="font-mono font-black text-slate-400 uppercase text-[8px]">Recovery Audit Signature</span>
                        <div className="border-b border-slate-300 border-dashed py-1 text-[11px] text-slate-300 italic">
                          - Verified -
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 select-none text-right">
                        <span className="font-mono font-black text-slate-400 uppercase text-[8px]">Final Approving Authority</span>
                        <div className="border-b border-slate-300 border-dashed py-1 text-[11px] font-black text-slate-900 italic">
                          Authorized Sign
                        </div>
                      </div>
                    </div>

                    {/* Micro footnote */}
                    <div className="mt-5 flex items-center justify-between text-[8px] text-slate-400 uppercase select-none tracking-widest font-mono border-t border-slate-100 pt-1.5">
                      <span>Enterprise Financial Ledger Suite</span>
                      <span>Month Cycle Ref: {monthDoc.id}</span>
                    </div>

                  </div>
                );
              })
            )}

          </div>

        </div>

      </div>

      {/* Advanced Global CSS overrides target only when printing batch container */}
      <style dangerouslySetInnerHTML={{ __html: `
        .batch-print-page,
        .batch-print-page * {
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          #root {
            display: none !important;
          }
          .print-batch-overlay {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
          }
          .batch-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .batch-print-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 12mm 15mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
          }
          .batch-print-page table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.5px solid #000000 !important;
            margin: 0 !important;
          }
          .batch-print-page tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .batch-print-page th {
            padding: 2px 4px !important;
            font-size: 8.5px !important;
            font-weight: bold !important;
            border: 1px solid #000000 !important;
            border-bottom: 2px solid #000000 !important;
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .batch-print-page td {
            padding: 1px 4px !important;
            font-size: 8px !important;
            border: 1px solid #000000 !important;
            line-height: normal !important;
          }
        }
      `}} />
    </>,
    document.body
  );
}
