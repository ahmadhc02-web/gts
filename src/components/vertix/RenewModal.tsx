import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon,
  Shield,
  Calendar,
  Briefcase,
  Clock,
  Coins,
  DollarSign,
  X,
  CalendarCheck2,
  Check,
} from 'lucide-react';
import { RadiusUser, useRadiusStore } from './radiusStore';
import { formatRadiusError } from './radiusApi';

export interface RenewModalProps {
  user: RadiusUser;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  onSuccess?: (newExpiry: string, selectedPackage: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Format a Date object or ISO string to: "DD Mon YYYY HH:MM:SS"
 * Example: "08 Nov 2026 13:29:57"
 */
function formatDateTime(dateInput: Date | string, defaultTimeStr: string = '12:00:00'): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '08 Nov 2026 12:00:00';

  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let timeStr = defaultTimeStr;
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    timeStr = `${hours}:${mins}:${secs}`;
  } else if (dateInput instanceof Date) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    timeStr = `${hours}:${mins}:${secs}`;
  }

  return `${day} ${month} ${year} ${timeStr}`;
}

export default function RenewModal({
  user,
  isOpen,
  onClose,
  isDarkMode = false,
  onSuccess,
  addToast,
}: RenewModalProps) {
  const store = useRadiusStore();

  // Selected package (defaults to current user package)
  const [selectedPackage, setSelectedPackage] = useState<string>(user.package);

  // Extra Fee toggle & amount
  const [addExtraFee, setAddExtraFee] = useState<boolean>(false);
  const [extraFeeAmount, setExtraFeeAmount] = useState<number>(100);

  // Expiry Type: "Default" or "Custom Date"
  const [expiryType, setExpiryType] = useState<'Default' | 'Custom Date'>('Default');

  // Custom Expiry Date (YYYY-MM-DD)
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');

  // Duration in months (default 1)
  const [durationMonths, setDurationMonths] = useState<number>(1);

  // Submitting animation state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Present date (midnight)
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [isOpen]);

  // Total days in current month (e.g. 31 for Jan, Mar, May, Jul, Aug, Oct, Dec; 30 for Apr, Jun, Sep, Nov; 28/29 for Feb)
  const daysInCurrentMonth = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }, [today]);

  // Sync state when modal opens or user changes
  useEffect(() => {
    setSelectedPackage(user.package);
    setAddExtraFee(false);
    setExtraFeeAmount(100);
    setExpiryType('Default');
    // Default custom date to today + 5 days
    const d5 = new Date();
    d5.setDate(d5.getDate() + 5);
    setCustomExpiryDate(d5.toISOString().split('T')[0]);
    setDurationMonths(1);
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

  // Find selected package details
  const currentPkgObj = useMemo(() => {
    return (
      store.packages.find(
        p => p.name.toLowerCase() === selectedPackage.toLowerCase() || p.id === selectedPackage
      ) ||
      store.packages.find(p => p.name === user.package) || {
        id: 'pkg-default',
        name: selectedPackage,
        pricePerMonth: 0,
        speed: '',
        status: 'Active' as const,
      }
    );
  }, [store.packages, selectedPackage, user.package]);

  // Owner reseller/manager if assigned to user
  const ownerManager = useMemo(() => {
    if (!user.owner) return null;
    return store.managers.find(
      m => user.owner?.toLowerCase().includes(m.name.toLowerCase()) ||
           user.owner?.toLowerCase().includes(m.username.toLowerCase()) ||
           m.name.toLowerCase().includes(user.owner?.toLowerCase() || '')
    );
  }, [store.managers, user.owner]);

  // Available Current Panel / Account Balance
  const availableCurrentBalance = useMemo(() => {
    if (user.balance && user.balance > 0) return user.balance;
    if (ownerManager && typeof ownerManager.balance === 'number' && ownerManager.balance > 0) {
      return ownerManager.balance;
    }
    return store.totalBalancePKR || 0;
  }, [user.balance, ownerManager, store.totalBalancePKR]);

  // Package monthly base price
  const monthlyPrice = currentPkgObj.pricePerMonth || 0;

  // Custom Days calculation: difference between selected custom expiry date and present date (today)
  const customDays = useMemo(() => {
    if (!customExpiryDate) return 5;
    const target = new Date(customExpiryDate);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [customExpiryDate, today]);

  // Per-Day Rate: monthly price divided by current month's days (e.g. 1000 / 31 = 32.26)
  const perDayRate = useMemo(() => {
    return Number((monthlyPrice / daysInCurrentMonth).toFixed(2));
  }, [monthlyPrice, daysInCurrentMonth]);

  // Custom Package Price: per-day rate multiplied by selected custom days (e.g. 32.26 * 5 = 161.30)
  const customPackagePrice = useMemo(() => {
    return Number((perDayRate * customDays).toFixed(2));
  }, [perDayRate, customDays]);

  // Package Price depending on Expiry Type
  const packagePrice = useMemo(() => {
    if (expiryType === 'Custom Date') {
      return customPackagePrice;
    }
    return monthlyPrice * durationMonths;
  }, [expiryType, customPackagePrice, monthlyPrice, durationMonths]);

  // Net Total Price = Package Price + Extra Fee
  const netTotalPrice = useMemo(() => {
    return Number((packagePrice + (addExtraFee ? Number(extraFeeAmount || 0) : 0)).toFixed(2));
  }, [packagePrice, addExtraFee, extraFeeAmount]);

  // Current Expiration calculations & checking if adding remaining days
  const isAddingRemainingDays = useMemo(() => {
    if (!user.expiry) return false;
    const expDate = new Date(user.expiry);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return !isNaN(expDate.getTime()) && expDate >= t;
  }, [user.expiry]);

  // Current Expiration display formatted string
  const currentExpirationStr = useMemo(() => {
    if (user.status === 'Pre-Active' || user.expiry === 'Not Activated') {
      return 'Not Activated (Pre-Active)';
    }
    if (!user.expiry) return formatDateTime(new Date());
    return formatDateTime(user.expiry, '13:29:57');
  }, [user.expiry, user.status]);

  // New Expiration Date calculation
  const newExpirationDateObj = useMemo(() => {
    if (expiryType === 'Custom Date') {
      if (customExpiryDate) {
        const parsed = new Date(customExpiryDate);
        if (!isNaN(parsed.getTime())) {
          parsed.setHours(12, 0, 0, 0);
          return parsed;
        }
      }
      const fallback = new Date(today.getTime() + customDays * 86400000);
      fallback.setHours(12, 0, 0, 0);
      return fallback;
    }

    const t = new Date();
    t.setHours(12, 0, 0, 0);

    const currentExp = new Date(user.expiry);
    const baseDate =
      !isNaN(currentExp.getTime()) && currentExp >= t ? currentExp : t;

    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + durationMonths * 30);
    nextDate.setHours(12, 0, 0, 0);
    return nextDate;
  }, [expiryType, customExpiryDate, today, customDays, user.expiry, durationMonths]);

  const newExpirationStr = useMemo(() => {
    return formatDateTime(newExpirationDateObj, '12:00:00');
  }, [newExpirationDateObj]);

  // Handle preset quick days for custom date
  const setQuickCustomDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setCustomExpiryDate(target.toISOString().split('T')[0]);
  };

  // Handle Submit renewal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const day = String(newExpirationDateObj.getDate()).padStart(2, '0');
      const month = String(newExpirationDateObj.getMonth() + 1).padStart(2, '0');
      const year = newExpirationDateObj.getFullYear();
      const newExpiryStr = `${year}-${month}-${day}`;

      await store.renewSubscriber({
        userId: user.id,
        packageName: selectedPackage,
        packageId: currentPkgObj.id !== 'pkg-default' ? currentPkgObj.id : undefined,
        newExpiry: newExpiryStr,
        amount: netTotalPrice,
        extraFee: addExtraFee ? Number(extraFeeAmount || 0) : 0,
        paymentMethod: 'Cash',
        durationMonths,
        customDays,
        expiryType,
      });

      addToast?.(
        user.status === 'Pre-Active'
          ? `User ${user.username} activated & recharged successfully to ${selectedPackage}! Rs. ${netTotalPrice.toLocaleString()} deducted from balance. New Expiry: ${newExpiryStr}`
          : `User ${user.username} renewed successfully to ${selectedPackage}. Rs. ${netTotalPrice.toLocaleString()} deducted from balance. New Expiry: ${newExpiryStr}`,
        'success'
      );
      onSuccess?.(newExpiryStr, selectedPackage);
      onClose();
    } catch (err: any) {
      addToast?.(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const durationOptions = [
    { months: 1, label: '1 Month', desc: '30 Days' },
    { months: 2, label: '2 Months', desc: '60 Days' },
    { months: 3, label: '3 Months', desc: '90 Days' },
    { months: 6, label: '6 Months', desc: '180 Days' },
    { months: 12, label: '1 Year', desc: '360 Days' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto vertix-dashboard-scroll">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75"
          />

          {/* Business Modal Container */}
          <motion.div
            data-font-lexend="true"
            style={{ fontFamily: "'Lexend', sans-serif", WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto my-auto rounded-2xl border shadow-2xl font-lexend transition-colors ${
              isDarkMode
                ? 'bg-[#161b24] border-[#2d3648] text-white shadow-black/70'
                : 'bg-white border-slate-300 text-slate-950 shadow-slate-900/10'
            }`}
          >
            {/* BUSINESS HEADER: Clean, No Green Line, No Icon, Just "Renew Details" */}
            <div
              className={`px-6 py-4.5 border-b flex items-center justify-between gap-4 ${
                isDarkMode ? 'border-[#2d3648] bg-[#10141b]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                {user.status === 'Pre-Active' ? 'Activate Subscriber (Recharge Details)' : 'Renew Details'}
              </h2>

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
            <form onSubmit={handleSubmit}>
              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                {/* LEFT COLUMN: Controls & Configurations (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Row 1: Username & Selected Package */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    {/* Username * */}
                    <div>
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1.5">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={user.username}
                        className={`w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border outline-none cursor-not-allowed ${
                          isDarkMode
                            ? 'bg-[#10141b] border-[#333d52] text-white'
                            : 'bg-slate-100 border-slate-300 text-slate-950'
                        }`}
                      />
                    </div>

                    {/* Package * */}
                    <div>
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1.5">
                        Package <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedPackage}
                        onChange={e => setSelectedPackage(e.target.value)}
                        className={`w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border outline-none cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-[#10141b] border-[#333d52] text-white hover:border-slate-400 focus:border-emerald-400'
                            : 'bg-white border-slate-300 text-slate-950 hover:border-slate-500 focus:border-emerald-600 shadow-xs'
                        }`}
                      >
                        {!store.packages.some(
                          p => p.name.toLowerCase() === user.package.toLowerCase()
                        ) && (
                          <option value={user.package}>{user.package} (*)</option>
                        )}
                        {store.packages.map(p => {
                          const isPresent =
                            p.name.toLowerCase() === user.package.toLowerCase();
                          return (
                            <option key={p.id} value={p.name}>
                              {p.name} {isPresent ? '(*)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Duration Selector: Clean Business Tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Package Duration <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {expiryType === 'Custom Date'
                          ? `${customDays} Days (Custom Date Active)`
                          : `${durationMonths * 30} Days`}
                      </span>
                    </div>

                    <div
                      className={`grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 rounded-xl border ${
                        expiryType === 'Custom Date'
                          ? 'opacity-50 pointer-events-none'
                          : ''
                      } ${
                        isDarkMode
                          ? 'bg-[#10141b] border-[#2d3648]'
                          : 'bg-slate-100 border-slate-300'
                      }`}
                    >
                      {durationOptions.map(opt => {
                        const active = durationMonths === opt.months;
                        return (
                          <button
                            key={opt.months}
                            type="button"
                            disabled={expiryType === 'Custom Date'}
                            onClick={() => setDurationMonths(opt.months)}
                            className={`py-2 px-1 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                              active
                                ? 'bg-[#cbeee2] text-[#036841] shadow-xs border border-[#038252]/30'
                                : isDarkMode
                                ? 'text-slate-100 hover:text-white hover:bg-[#1e2636]'
                                : 'text-slate-800 hover:text-slate-950 hover:bg-white'
                            }`}
                          >
                            <span className="block leading-tight">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expiry Mode Configuration */}
                  <div
                    className={`p-3.5 rounded-xl border ${
                      isDarkMode
                        ? 'bg-[#10141b] border-[#2d3648]'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Expiry Type <span className="text-red-500">*</span>
                      </label>

                      {/* Segmented Expiry Type */}
                      <div
                        className={`inline-flex items-center p-0.5 rounded-lg border ${
                          isDarkMode
                            ? 'bg-[#161b24] border-[#333d52]'
                            : 'bg-white border-slate-300 shadow-xs'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpiryType('Default')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            expiryType === 'Default'
                              ? 'bg-[#c1eedd] text-[#036841]'
                              : isDarkMode
                              ? 'text-slate-100 hover:text-white'
                              : 'text-slate-800 hover:text-slate-950'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpiryType('Custom Date');
                            if (!customExpiryDate) {
                              const d = new Date();
                              d.setDate(d.getDate() + 5);
                              setCustomExpiryDate(d.toISOString().split('T')[0]);
                            }
                          }}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            expiryType === 'Custom Date'
                              ? 'bg-[#c1eedd] text-[#036841]'
                              : isDarkMode
                              ? 'text-slate-100 hover:text-white'
                              : 'text-slate-800 hover:text-slate-950'
                          }`}
                        >
                          Custom Date
                        </button>
                      </div>
                    </div>

                    {/* Custom Date Input and Calculation Preview */}
                    <AnimatePresence>
                      {expiryType === 'Custom Date' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="pt-2 space-y-2.5"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                Select Custom Expiry Date
                              </label>
                              <span className="text-[11px] font-lexend text-emerald-700 dark:text-emerald-300 font-bold">
                                {customDays} Days from Today
                              </span>
                            </div>
                            <input
                              type="date"
                              value={customExpiryDate}
                              onChange={e => setCustomExpiryDate(e.target.value)}
                              min={new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
                              className={`w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border outline-none font-lexend ${
                                isDarkMode
                                  ? 'bg-[#161b24] border-[#333d52] text-white focus:border-emerald-400'
                                  : 'bg-white border-slate-300 text-slate-950 focus:border-emerald-600'
                              }`}
                            />
                          </div>

                          {/* Quick Days Selector Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-slate-700 dark:text-slate-200 font-semibold mr-1">Quick:</span>
                            {[1, 2, 3, 5, 7, 10, 15, 20, 30].map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setQuickCustomDays(d)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer font-lexend ${
                                  customDays === d
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : isDarkMode
                                    ? 'border-[#333d52] bg-[#161b24] text-slate-100 hover:text-white hover:bg-[#1e2636]'
                                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                {d}d
                              </button>
                            ))}
                          </div>

                          {/* Live Calculation Breakdown Box */}
                          <div
                            className={`p-2.5 rounded-lg border text-xs font-lexend ${
                              isDarkMode
                                ? 'bg-[#161b24] border-[#2d3648] text-slate-100'
                                : 'bg-white border-slate-300 text-slate-900 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                Month Days ({new Date().toLocaleString('en-US', { month: 'short' })}):
                              </span>
                              <span className="font-lexend font-bold text-slate-950 dark:text-white">
                                {daysInCurrentMonth} Days
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] mt-1">
                              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                Per-Day Rate:
                              </span>
                              <span className="font-lexend font-bold text-slate-950 dark:text-white">
                                Rs. {perDayRate.toFixed(2)} / day
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold mt-1.5 pt-1.5 border-t border-slate-200 dark:border-[#2d3648]">
                              <span className="text-slate-950 dark:text-white">
                                Custom Price:
                              </span>
                              <span className="font-lexend font-bold text-emerald-700 dark:text-emerald-300">
                                Rs. {customPackagePrice.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Add Extra Fee Toggle & Amount Input */}
                  <div
                    className={`p-3.5 rounded-xl border ${
                      isDarkMode
                        ? 'bg-[#10141b] border-[#2d3648]'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Add Extra Fee
                        </p>
                        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          Optional service surcharge
                        </p>
                      </div>

                      {/* Clean Business Switch */}
                      <button
                        type="button"
                        onClick={() => setAddExtraFee(!addExtraFee)}
                        className={`relative w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                          addExtraFee
                            ? 'bg-emerald-600'
                            : isDarkMode
                            ? 'bg-slate-600'
                            : 'bg-slate-300'
                        }`}
                      >
                        <motion.div
                          animate={{ x: addExtraFee ? 20 : 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                          className="w-5 h-5 rounded-full bg-white shadow-xs"
                        />
                      </button>
                    </div>

                    {/* Animated Extra Fee Input */}
                    <AnimatePresence>
                      {addExtraFee && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="pt-3 border-t border-slate-200 dark:border-[#2d3648] mt-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={extraFeeAmount}
                              onChange={e =>
                                setExtraFeeAmount(Math.max(0, Number(e.target.value)))
                              }
                              placeholder="100"
                              className={`w-32 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg border outline-none ${
                                isDarkMode
                                  ? 'bg-[#161b24] border-[#333d52] text-white focus:border-emerald-400'
                                  : 'bg-white border-slate-300 text-slate-950 focus:border-emerald-600'
                              }`}
                            />
                            <div className="flex items-center gap-1.5 ml-auto">
                              {[50, 100, 200].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setExtraFeeAmount(amt)}
                                  className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                                    extraFeeAmount === amt
                                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-700 dark:border-emerald-500'
                                      : isDarkMode
                                      ? 'border-[#333d52] text-slate-100 hover:text-white hover:bg-[#1e2636]'
                                      : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                                  }`}
                                >
                                  +{amt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* RIGHT COLUMN: Business Summary Table (5 Cols) */}
                <div className="lg:col-span-5">
                  <div
                    className={`rounded-xl border p-4 sm:p-4.5 transition-colors ${
                      isDarkMode
                        ? 'bg-[#10141b] border-[#2d3648]'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648] font-lexend">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white font-lexend">
                        Renew Summary
                      </h3>
                      <span className="text-[11px] font-bold font-lexend text-slate-700 dark:text-slate-200">
                        {new Date().toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Breakdown Rows */}
                    <div className="py-2 divide-y divide-slate-200 dark:divide-[#2d3648] text-xs font-lexend">
                      {/* 1. Username */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Username
                        </span>
                        <span className="font-bold text-slate-950 dark:text-white font-lexend">
                          {user.username}
                        </span>
                      </div>

                      {/* 2. User Status */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          User Status
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 font-lexend">
                          {user.status}
                        </span>
                      </div>

                      {/* 3. Current Expiration */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Current Expiration
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 font-lexend text-[11px]">
                          {currentExpirationStr}
                        </span>
                      </div>

                      {/* 4. New Expiration */}
                      <div className="py-2 flex items-center justify-between gap-2 bg-emerald-500/15 -mx-2 px-2 rounded-md">
                        <span className="text-emerald-900 dark:text-emerald-200 font-bold font-lexend">
                          New Expiration
                        </span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-200 font-lexend text-[11px]">
                          {newExpirationStr}
                        </span>
                      </div>

                      {/* 5. Package */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Package
                        </span>
                        <span className="font-bold text-slate-950 dark:text-white font-lexend">
                          {selectedPackage}
                        </span>
                      </div>

                      {/* 6. Package Duration */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Package Duration
                        </span>
                        <span className="font-bold text-slate-950 dark:text-white font-lexend">
                          {expiryType === 'Custom Date'
                            ? `${customDays} Days`
                            : `${durationMonths} Months`}
                        </span>
                      </div>

                      {/* 7. Adding Remaining Days */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Adding Remaining Days
                        </span>
                        <span
                          className={`font-bold font-lexend ${
                            isAddingRemainingDays
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {isAddingRemainingDays ? 'Yes' : 'No'}
                        </span>
                      </div>

                      {/* 8. Package Price (Monthly Base Price) */}
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold">
                          Package Price
                        </span>
                        <span className="font-bold text-slate-950 dark:text-white font-lexend">
                          Rs. {monthlyPrice.toFixed(2)}
                        </span>
                      </div>

                      {/* 9. Custom Package Price (Added line for Custom Date mode) */}
                      {expiryType === 'Custom Date' && (
                        <div className="py-2 flex items-center justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-200 font-semibold">
                            Custom Package Price
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 font-lexend">
                            Rs. {customPackagePrice.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Extra Fee Row */}
                      {addExtraFee && (
                        <div className="py-2 flex items-center justify-between gap-2 text-amber-700 dark:text-amber-300">
                          <span className="font-semibold font-lexend">Extra Fee</span>
                          <span className="font-bold font-lexend">
                            + Rs. {Number(extraFeeAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      )}


                    </div>

                    {/* Net Total Price Banner */}
                    <div
                      className={`mt-3 p-3.5 rounded-xl border flex items-center justify-between font-lexend ${
                        isDarkMode
                          ? 'bg-[#161b24] border-[#333d52] text-white'
                          : 'bg-white border-slate-300 text-slate-950 shadow-xs'
                      }`}
                    >
                      <div>
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 block font-lexend">
                          Net Total Price
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 font-lexend">
                          {expiryType === 'Custom Date'
                            ? `${customDays} Days`
                            : 'Payment: Cash'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black font-lexend tracking-tight text-emerald-700 dark:text-emerald-300 tabular-nums">
                          Rs. {netTotalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div
                className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
                  isDarkMode
                    ? 'border-[#2d3648] bg-[#10141b]'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'border-[#333d52] bg-[#161b24] text-slate-100 hover:text-white hover:bg-[#1e2636]'
                      : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100 shadow-xs'
                  }`}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#beebda] hover:bg-[#aee6d2] text-[#036841] shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Processing...' : (user.status === 'Pre-Active' ? 'Active Account' : 'Submit')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
