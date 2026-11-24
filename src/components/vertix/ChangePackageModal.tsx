import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
  CreditCard,
  Banknote,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
} from 'lucide-react';
import { RadiusUser, useRadiusStore, getRelativeDate } from './radiusStore';
import { formatRadiusError } from './radiusApi';

export interface ChangePackageModalProps {
  user: RadiusUser;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  onSuccess?: (newPkg: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Format a Date object to: "DD-Mon-YYYY" (e.g. "08-Dec-2026")
 */
function formatDateDash(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format a Date object to: "DD-Mon-YYYY 11:59 AM"
 */
function formatDateTimeDash(d: Date): string {
  const datePart = formatDateDash(d);
  return `${datePart} 11:59 AM`;
}

/**
 * Format a Date object to: "YYYY-MM-DD"
 */
function formatDateISO(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

export default function ChangePackageModal({
  user,
  isOpen,
  onClose,
  isDarkMode = false,
  onSuccess,
  addToast,
}: ChangePackageModalProps) {
  const store = useRadiusStore();

  // Selected package state (defaults to current user package or first available)
  const [selectedPkgName, setSelectedPkgName] = useState<string>(user.package);

  // Payment method: "Cash" or "Bank account (online)"
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank account (online)'>('Cash');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or reset selected package when modal opens or user changes
  useEffect(() => {
    setSelectedPkgName(user.package);
    setPaymentMethod('Cash');
    setIsSubmitting(false);
  }, [user.id, user.package, isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Current package object
  const currentPkgObj = useMemo(() => {
    return (
      store.packages.find(
        p => p.name.toLowerCase() === user.package.toLowerCase() || p.id === user.package
      ) || {
        id: 'pkg-curr',
        name: user.package,
        pricePerMonth: 0,
        speed: '',
        status: 'Active' as const,
      }
    );
  }, [store.packages, user.package]);

  // Selected new package object
  const newPkgObj = useMemo(() => {
    return (
      store.packages.find(
        p => p.name.toLowerCase() === selectedPkgName.toLowerCase() || p.id === selectedPkgName
      ) ||
      store.packages[0] || {
        id: 'pkg-new',
        name: selectedPkgName,
        pricePerMonth: 0,
        speed: '',
        status: 'Active' as const,
      }
    );
  }, [store.packages, selectedPkgName]);

  // Current remaining days
  const remainingDays = useMemo(() => {
    if (!user.expiry) return 0;
    const expDate = new Date(user.expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(expDate.getTime())) return 0;
    const diffMs = expDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [user.expiry]);

  // Dates for new package calculation
  const todayObj = useMemo(() => new Date(), [isOpen]);

  const newExpiryDateObj = useMemo(() => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);
    nextDate.setHours(11, 59, 0, 0);
    return nextDate;
  }, [isOpen]);

  const newExpiryStr = useMemo(() => formatDateDash(newExpiryDateObj), [newExpiryDateObj]);
  const newExpiryDateTimeStr = useMemo(
    () => formatDateTimeDash(newExpiryDateObj),
    [newExpiryDateObj]
  );
  const startDateStr = useMemo(() => formatDateISO(todayObj), [todayObj]);

  // Handle Submit Change Package
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const isoExpiry = newExpiryDateObj.toISOString().split('T')[0];

      await store.updateUser(user.id, {
        package: newPkgObj.name,
        packageId: newPkgObj.id !== 'pkg-new' ? newPkgObj.id : undefined,
        expiry: isoExpiry,
        status: 'Active',
      });

      await store.addPayment({
        userId: user.id,
        username: user.username,
        amount: newPkgObj.pricePerMonth,
        type: 'Renewal',
        method: paymentMethod === 'Cash' ? 'Cash' : 'Online',
        date: getRelativeDate(0),
        note: `Package changed from ${user.package} to ${newPkgObj.name} (${paymentMethod})`,
        packageName: newPkgObj.name,
      });

      addToast?.(
        `Package successfully updated to ${newPkgObj.name} for ${user.username}!`,
        'success'
      );
      onSuccess?.(newPkgObj.name);
      onClose();
    } catch (err: any) {
      addToast?.(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto vertix-dashboard-scroll">
          {/* Backdrop with smooth blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75"
          />

          {/* Modal Container */}
          <motion.div
            data-font-lexend="true"
            style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', sans-serif", WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto my-auto rounded-2xl border shadow-2xl font-lexend transition-colors ${
              isDarkMode
                ? 'bg-[#161b24] border-[#2d3648] text-white shadow-black/75'
                : 'bg-white border-slate-300 text-slate-950 shadow-slate-900/15'
            }`}
          >
            {/* BUSINESS HEADER (Top Blue line removed as requested) */}
            <div
              className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between gap-4 ${
                isDarkMode ? 'border-[#2d3648] bg-[#10141b]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/30 shadow-xs">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                      Change Package
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161b24] text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-[#333d52]">
                      @{user.username}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                    Select a new speed tier, review migration dates, and apply updates immediately
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#333d52] bg-[#161b24] text-slate-200 hover:text-white hover:bg-[#1e2636]'
                    : 'border-slate-300 bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-100 shadow-xs'
                }`}
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5 text-xs sm:text-sm">
              {/* SECTION 1: Package Selection & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-start">
                {/* New Package Dropdown / Selector */}
                <div className="sm:col-span-7">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    New Package <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPkgName}
                    onChange={e => setSelectedPkgName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border outline-none cursor-pointer transition-colors ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                        : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs'
                    }`}
                  >
                    {store.packages.map(pkg => {
                      const isCurrent = pkg.name.toLowerCase() === user.package.toLowerCase();
                      return (
                        <option key={pkg.id} value={pkg.name}>
                          {pkg.name} ({pkg.speed}) — Rs. {pkg.pricePerMonth.toLocaleString()}/mo {isCurrent ? '(Current Plan)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Payment Method Segmented Tabs */}
                <div className="sm:col-span-5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Cash')}
                      className={`relative py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'Cash'
                          ? 'bg-[#cbeee2] text-[#038252] shadow-xs border border-[#038252]/20'
                          : isDarkMode
                          ? 'text-slate-400 hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Bank account (online)')}
                      className={`relative py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'Bank account (online)'
                          ? 'bg-[#cbeee2] text-[#038252] shadow-xs border border-[#038252]/20'
                          : isDarkMode
                          ? 'text-slate-400 hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Bank Online</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Package Change Summary & Side-by-Side Comparison */}
              <div
                className={`p-4 rounded-xl border transition-colors ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                {/* Summary Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Package Change Summary</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Review current vs new package migration details
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 block">
                      New calculated expiry
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-[#038252] dark:text-emerald-400 font-mono">
                      {newExpiryDateTimeStr}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison Cards */}
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  {/* Current Package Details (5 Cols) */}
                  <div
                    className={`sm:col-span-5 p-3 rounded-xl border space-y-2 ${
                      isDarkMode
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-white border-slate-200/90 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Current Package Details
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">Active</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Package Name</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                        {user.package}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Price</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        Rs. {Number(currentPkgObj.pricePerMonth || 1).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Expiry Date</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {user.expiry || startDateStr}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Remaining Days</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {remainingDays} Days
                      </span>
                    </div>
                  </div>

                  {/* Transition Arrow Indicator (1 Col) */}
                  <div className="sm:col-span-1 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* New Package Details (5 Cols) - Green Accents */}
                  <div
                    className={`sm:col-span-5 p-3 rounded-xl border space-y-2 ${
                      isDarkMode
                        ? 'bg-emerald-950/20 border-emerald-800/40'
                        : 'bg-emerald-50/70 border-emerald-200/80 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-emerald-100 dark:border-emerald-900/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#038252] dark:text-emerald-400">
                        New Package Details
                      </span>
                      <span className="text-[10px] font-bold text-[#038252] dark:text-emerald-400">
                        Selected
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Package Name</span>
                      <span className="font-bold text-[#038252] dark:text-emerald-300 truncate max-w-[120px]">
                        {newPkgObj.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Price</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        Rs. {newPkgObj.pricePerMonth.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Start Date</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {startDateStr}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Expiry Date</span>
                      <span className="font-bold text-[#038252] dark:text-emerald-400 font-mono text-[11px]">
                        {newExpiryStr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wasted Days Notice Banner */}
                <div
                  className={`mt-3.5 p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                    remainingDays > 0
                      ? isDarkMode
                        ? 'bg-amber-950/25 border-amber-900/40 text-amber-300'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : isDarkMode
                      ? 'bg-emerald-950/25 border-emerald-900/40 text-emerald-300'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <p className="leading-tight">
                    <span className="font-bold">Wasted days: {remainingDays}</span>{' '}
                    <span className="text-[11px] opacity-90">
                      (remaining days on current package will be lost after change)
                    </span>
                  </p>
                </div>
              </div>

              {/* SECTION 3: Highlighted Package & Next Expiry Date (Side by side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Highlighted Package Details */}
                <div
                  className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between ${
                    isDarkMode
                      ? 'bg-slate-900/40 border-slate-800'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {newPkgObj.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Validity: 1 Month
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Speed: {newPkgObj.speed || '10M / 10M'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-bold text-[#038252] dark:text-emerald-400 font-mono block leading-tight">
                      Rs {newPkgObj.pricePerMonth.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block mt-0.5">
                      Package Price
                    </span>
                  </div>
                </div>

                {/* Next Expiry Date */}
                <div
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-center ${
                    isDarkMode
                      ? 'bg-emerald-950/20 border-emerald-900/40'
                      : 'bg-emerald-50/70 border-emerald-200/80 shadow-xs'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                    Next expiry date
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#038252] dark:text-emerald-400 font-mono block mt-0.5">
                    {newExpiryDateTimeStr}
                  </span>
                </div>
              </div>

              {/* SECTION 4: Price Breakdown */}
              <div
                className={`p-3.5 sm:p-4 rounded-xl border ${
                  isDarkMode
                    ? 'bg-slate-900/60 border-slate-800'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Package price</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    Rs. {newPkgObj.pricePerMonth.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Final Total
                  </span>
                  <span className="font-bold text-[#038252] dark:text-emerald-400 font-mono text-base sm:text-lg">
                    Rs. {newPkgObj.pricePerMonth.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div
                className={`pt-3.5 border-t flex items-center justify-end gap-3 ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-xs'
                  }`}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#beebda] hover:bg-[#aee6d2] text-[#038252] border border-[#038252]/20 shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#038252]/30 border-t-[#038252] rounded-full animate-spin" />
                      <span>Changing...</span>
                    </>
                  ) : (
                    <span>Change Package</span>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
