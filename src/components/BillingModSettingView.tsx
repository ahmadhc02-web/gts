import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Save, 
  Check, 
  Table, 
  ArrowRight,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  BILLING_COLUMNS_LIST, 
  BILLING_STATUSES_LIST,
  BillingColumnVisibilityMap, 
  BillingStatusVisibilityMap,
  getBillingColumnVisibility, 
  saveBillingColumnVisibility, 
  resetBillingColumnVisibility,
  getBillingStatusVisibility,
  saveBillingStatusVisibility,
  resetBillingStatusVisibility
} from '../utils/billingColumnsConfig';
import { cn } from '../lib/utils';

interface BillingModSettingViewProps {
  onNavigateToBilling?: () => void;
}

export default function BillingModSettingView({ onNavigateToBilling }: BillingModSettingViewProps) {
  const navigate = useNavigate();
  const [columnVisibility, setColumnVisibility] = useState<BillingColumnVisibilityMap>(getBillingColumnVisibility);
  const [statusVisibility, setStatusVisibility] = useState<BillingStatusVisibilityMap>(getBillingStatusVisibility);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'core' | 'financial' | 'advance' | 'statuses'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setColumnVisibility(getBillingColumnVisibility());
    setStatusVisibility(getBillingStatusVisibility());
  }, []);

  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
  const totalCount = BILLING_COLUMNS_LIST.length;

  const visibleStatusCount = Object.values(statusVisibility).filter(Boolean).length;
  const totalStatusCount = BILLING_STATUSES_LIST.length;

  const handleToggleColumn = (id: string) => {
    setColumnVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      // Auto-save immediately so instant feedback happens
      saveBillingColumnVisibility(next);
      return next;
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleToggleStatus = (id: keyof BillingStatusVisibilityMap) => {
    setStatusVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      saveBillingStatusVisibility(next);
      return next;
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTurnAll = (status: boolean) => {
    if (activeCategoryFilter === 'statuses') {
      const updated: BillingStatusVisibilityMap = {
        paid: status,
        unpaid: status,
        partial: status,
        tdc: status,
        dc: status,
        extra: status
      };
      // Keep at least unpaid on if turning all off
      if (!status) {
        updated.unpaid = true;
      }
      setStatusVisibility(updated);
      saveBillingStatusVisibility(updated);
      toast.success(status ? 'All payment status rows enabled' : 'Optional status rows hidden (Unpaid kept active)');
      return;
    }

    const updated: BillingColumnVisibilityMap = {};
    BILLING_COLUMNS_LIST.forEach(col => {
      // Keep at least name or username visible if turning all off
      if (!status && (col.id === 'name' || col.id === 'username')) {
        updated[col.id] = true;
      } else {
        updated[col.id] = status;
      }
    });
    setColumnVisibility(updated);
    saveBillingColumnVisibility(updated);
    toast.success(status ? 'All recovery columns turned ON' : 'All optional columns hidden (Name & User ID kept visible)');
  };

  const handleResetDefaults = () => {
    if (activeCategoryFilter === 'statuses') {
      const defaults = resetBillingStatusVisibility();
      setStatusVisibility(defaults);
      toast.info('Status row filters reset to default');
      return;
    }

    const defaults = resetBillingColumnVisibility();
    setColumnVisibility(defaults);
    toast.info('Columns reset to default configuration');
  };

  const handleApply = () => {
    saveBillingColumnVisibility(columnVisibility);
    saveBillingStatusVisibility(statusVisibility);
    toast.success('Billing Mode settings applied successfully!');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const filteredColumns = BILLING_COLUMNS_LIST.filter(col => {
    const matchesCategory = activeCategoryFilter === 'all' || col.category === activeCategoryFilter;
    const matchesSearch = 
      col.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (col.subLabel && col.subLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
      col.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredStatuses = BILLING_STATUSES_LIST.filter(stat => {
    return (
      stat.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stat.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stat.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Control Bar: Categories, Search & Bulk Actions */}
      <div className="bg-[var(--neu-surface)] border border-[var(--neu-border)] rounded-2xl p-4 shadow-[var(--neu-shadow-btn)] flex flex-wrap items-center justify-between gap-4">
        {/* Category Filter Pills & Count */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Columns' },
              { id: 'core', label: 'Core / Client Info' },
              { id: 'financial', label: 'Financial / Recovery' },
              { id: 'advance', label: 'Advance / Actions' },
              { id: 'statuses', label: 'Status Rows Filter' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryFilter(cat.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-1.5",
                  activeCategoryFilter === cat.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-md"
                    : "bg-transparent text-slate-600 dark:text-slate-300 border-[var(--neu-border)] hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {cat.id === 'statuses' && <Filter size={12} />}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
            {activeCategoryFilter === 'statuses' 
              ? `${visibleStatusCount} / ${totalStatusCount} Statuses Active`
              : `${visibleCount} / ${totalCount} Visible`
            }
          </span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleTurnAll(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title={activeCategoryFilter === 'statuses' ? "Enable all status rows" : "Turn all columns ON"}
          >
            <Eye size={14} />
            <span>Show All</span>
          </button>

          <button
            onClick={() => handleTurnAll(false)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title={activeCategoryFilter === 'statuses' ? "Hide non-essential statuses" : "Keep only essential columns"}
          >
            <EyeOff size={14} />
            <span>Hide Optional</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 hover:bg-slate-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Reset to factory defaults"
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Grid Content: Status Rows Filter vs Columns Grid */}
      {activeCategoryFilter === 'statuses' ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Filter size={16} className="text-blue-500 shrink-0" />
            <span>
              Toggle which payment status rows should be displayed in the Billing table (e.g. Paid, Unpaid, Partial, TDC, DC). Disabling a status hides its rows from the main recovery list.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStatuses.map((stat, index) => {
              const isVisible = statusVisibility[stat.id] ?? true;

              return (
                <motion.div
                  key={stat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleToggleStatus(stat.id)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-4 text-left relative overflow-hidden",
                    isVisible
                      ? "bg-[var(--neu-surface)] border-blue-500/40 shadow-[var(--neu-shadow-btn)] hover:border-blue-500"
                      : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
                  )}
                >
                  {/* Left Status Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase border", stat.colorClass)}>
                        {stat.label}
                      </span>
                      <span className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                        {stat.badge}
                      </span>
                      {isVisible ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          ON • VISIBLE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-300/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          OFF • HIDDEN
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {stat.description}
                    </p>
                  </div>

                  {/* Right Toggle Switch */}
                  <div className="shrink-0 flex items-center gap-2">
                    <div 
                      className={cn(
                        "w-14 h-8 rounded-full transition-colors p-1 flex items-center cursor-pointer shadow-inner",
                        isVisible ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                      )}
                    >
                      <motion.div 
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                          "w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-[10px] font-black",
                          isVisible ? "text-blue-600" : "text-slate-400"
                        )}
                      >
                        {isVisible ? 'ON' : 'OFF'}
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Columns Grid / List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredColumns.map((col, index) => {
            const isVisible = columnVisibility[col.id] ?? true;

            return (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleToggleColumn(col.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-4 text-left relative overflow-hidden",
                  isVisible
                    ? "bg-[var(--neu-surface)] border-blue-500/40 shadow-[var(--neu-shadow-btn)] hover:border-blue-500"
                    : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
                )}
              >
                {/* Left Column Details */}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Col #{index + 1}
                    </span>
                    <span className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                      {col.label}
                    </span>
                    {isVisible ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        ON • VISIBLE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-300/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        OFF • HIDDEN
                      </span>
                    )}
                  </div>

                  {col.subLabel && (
                    <p className="text-xs font-semibold text-blue-600/90 dark:text-blue-400/90 truncate">
                      {col.subLabel}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {col.description}
                  </p>
                </div>

                {/* Right Toggle Switch */}
                <div className="shrink-0 flex items-center gap-2">
                  <div 
                    className={cn(
                      "w-14 h-8 rounded-full transition-colors p-1 flex items-center cursor-pointer shadow-inner",
                      isVisible ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                    )}
                  >
                    <motion.div 
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={cn(
                        "w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-[10px] font-black",
                        isVisible ? "text-blue-600" : "text-slate-400"
                      )}
                    >
                      {isVisible ? 'ON' : 'OFF'}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer Sticky Bar with Save & Jump to Billing */}
      <div className="sticky bottom-4 z-20 bg-[var(--neu-surface)]/95 backdrop-blur-md border border-[var(--neu-border)] rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>All settings are automatically saved (Auto-Saved)</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleApply}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {savedSuccess ? <Check size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Settings Applied!' : 'Apply Settings'}</span>
          </button>

          <button
            onClick={() => {
              if (onNavigateToBilling) {
                onNavigateToBilling();
              } else {
                navigate('/billing');
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[var(--neu-surface)] text-slate-800 dark:text-slate-200 border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] hover:text-blue-500 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Table size={16} />
            <span>Open Billing Table</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
