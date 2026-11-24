import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Check,
  X,
  Search,
  UserCheck,
  Sparkles,
  Zap,
  ShieldCheck,
  AlertCircle,
  Calendar,
  CreditCard,
  Filter,
  Users,
  RefreshCw,
  UserMinus,
  CheckSquare,
  Square
} from 'lucide-react';
import { useRadiusStore, RadiusUser, getRelativeDate, isUserExpired } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { useNavigate } from 'react-router-dom';
import { overlayMotion, dialogMotion } from '../../lib/motionPresets';
import { DeferredBody } from '../ui/DeferredBody';
import { SkBar } from '../skeleton/Skeleton';
import { usePopupTiming } from '../../lib/usePopupTiming';

interface BulkRenewViewProps {
  initialSelectedUserIds?: string[];
  isDarkMode?: boolean;
  onBack?: () => void;
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function BulkRenewView({
  initialSelectedUserIds = [],
  isDarkMode = true,
  onBack,
  addToast
}: BulkRenewViewProps) {
  const store = useRadiusStore();
  const navigate = useNavigate();

  // Selected Users state - default to initialSelectedUserIds or all expired users if none selected
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => {
    if (initialSelectedUserIds && initialSelectedUserIds.length > 0) {
      return initialSelectedUserIds;
    }
    // Default to selecting expired/expiring users for convenience
    return store.users
      .filter(u => u.status === 'Expired' || u.expiry === getRelativeDate(0))
      .map(u => u.id);
  });

  const [renewMonths, setRenewMonths] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Default filter to 'selected' so ONLY selected users are shown in table by default
  const [filterType, setFilterType] = useState<'selected' | 'all' | 'expired'>('selected');

  // Real-time sequential activation state
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activatingIndex, setActivatingIndex] = useState<number>(-1);
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);
  const [completedUserIds, setCompletedUserIds] = useState<string[]>([]);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState<boolean>(false);
  usePopupTiming('BulkRenewCompletion', showCompletionOverlay);
  const [totalRechargedAmount, setTotalRechargedAmount] = useState<number>(0);

  // Filtered subscribers list
  const displayUsers = useMemo(() => {
    return store.users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.mobile.includes(searchQuery) ||
        u.package.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'selected') {
        return selectedUserIds.includes(u.id);
      }
      if (filterType === 'expired') {
        return u.status === 'Expired' || u.expiry <= getRelativeDate(0);
      }
      return true;
    });
  }, [store.users, searchQuery, filterType, selectedUserIds]);

  // Master toggle select all
  const isAllSelected = displayUsers.length > 0 && displayUsers.every(u => selectedUserIds.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(prev => prev.filter(id => !displayUsers.some(u => u.id === id)));
    } else {
      const newIds = new Set([...selectedUserIds, ...displayUsers.map(u => u.id)]);
      setSelectedUserIds(Array.from(newIds));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Calculate total balance required based on EACH subscriber's assigned current package
  const totalRequiredBalance = useMemo(() => {
    return selectedUserIds.reduce((sum, id) => {
      const user = store.users.find(u => u.id === id);
      if (!user) return sum;
      const pkg = store.packages.find(p => p.name === user.package) || store.packages[0];
      const pkgPrice = pkg ? pkg.pricePerMonth : 1500;
      return sum + pkgPrice * renewMonths;
    }, 0);
  }, [selectedUserIds, store.users, store.packages, renewMonths]);

  // Handle Real-time Sequential 1-by-1 Activation
  const handleStartRecharge = async () => {
    if (selectedUserIds.length === 0) {
      if (addToast) addToast('Please select at least 1 subscriber to renew.', 'error');
      return;
    }
    if (isActivating) return;

    setIsActivating(true);
    setActivatingIndex(0);
    setCompletedUserIds([]);
    let accumulatedBill = 0;
    let failed = false;

    const selectedList = [...selectedUserIds];

    try {
      for (let i = 0; i < selectedList.length; i++) {
        const uId = selectedList[i];
        setActivatingIndex(i);
        setActivatingUserId(uId);

        const targetUser = store.users.find(u => u.id === uId);
        if (targetUser) {
          const res = await store.renewUser(uId, targetUser.package, renewMonths);
          accumulatedBill += res.amount;
        }

        setCompletedUserIds(prev => [...prev, uId]);
      }
    } catch (err: any) {
      failed = true;
      addToast?.(formatRadiusError(err), 'error');
    } finally {
      setActivatingUserId(null);
      setIsActivating(false);
    }

    if (!failed) {
      setTotalRechargedAmount(accumulatedBill);
      setShowCompletionOverlay(true);
      if (addToast) {
        addToast(`Successfully recharged ${selectedList.length} subscribers!`, 'success');
      }
    }
  };

  const handleCompletionOkay = () => {
    setShowCompletionOverlay(false);
    setSelectedUserIds([]);
    if (onBack) {
      onBack();
    } else {
      navigate('/greenradius');
    }
  };

  return (
    <div
      data-font-lexend="true"
      style={{ fontFamily: "'Lexend', sans-serif", WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      className={`min-h-[100dvh] w-full flex flex-col font-lexend overflow-x-hidden ${
        isDarkMode ? 'bg-[#0f131a] text-white' : 'bg-[#eef3f1] text-slate-950'
      }`}
    >
      {/* Header Bar - ONLY Back to Dashboard button */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-300 dark:border-[#2d3648] bg-white dark:bg-[#161b24] flex items-center justify-between shrink-0 sticky top-0 z-40">
        <button
          onClick={() => {
            if (onBack) onBack();
            else navigate('/greenradius');
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </header>

      {/* Main Container - Full Screen Width Fit */}
      <main
        className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-lexend"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Top Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Selected Count */}
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'} shadow-xs flex items-center justify-between`}>
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Subscribers Selected</span>
              <span className="text-2xl font-black text-slate-950 dark:text-white mt-1 block tabular-nums">
                {selectedUserIds.length} <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">/ {store.users.length}</span>
              </span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Renewal Duration Selector */}
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'} shadow-xs flex items-center justify-between`}>
            <div className="w-full">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Renewal Duration
              </label>
              <select
                value={renewMonths}
                onChange={e => setRenewMonths(Number(e.target.value))}
                disabled={isActivating}
                className={`w-full text-xs px-3 py-1.5 rounded-xl border font-bold outline-none cursor-pointer ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value={1}>1 Month (30 Days)</option>
                <option value={2}>2 Months (60 Days)</option>
                <option value={3}>3 Months (90 Days)</option>
                <option value={6}>6 Months (180 Days)</option>
                <option value={12}>12 Months (365 Days)</option>
              </select>
            </div>
          </div>

          {/* Card 3: Total Required Balance */}
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#161b24] border-emerald-500/45 bg-gradient-to-br from-[#161b24] to-emerald-950/50' : 'bg-emerald-50 border-emerald-300'} shadow-xs flex items-center justify-between`}>
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 block">Total Required Balance</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 block tabular-nums">
                Rs. {totalRequiredBalance.toLocaleString()}
              </span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Wallet Balance & Action */}
          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'} shadow-xs flex items-center justify-between`}>
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Reseller Wallet Balance</span>
              <span className="text-2xl font-black text-slate-950 dark:text-white mt-1 block tabular-nums">
                Rs. {(store.totalBalancePKR || store.managers[0]?.balance || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Subscriber List Table Section */}
        <div className={`rounded-3xl border ${isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'} shadow-lg overflow-hidden`}>
          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#2d3648] flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300" />
                <input
                  type="text"
                  placeholder="Search by name, username, package..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full text-xs pl-9 pr-4 py-2 rounded-xl border outline-none font-semibold ${
                    isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-600'
                  }`}
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                {(['selected', 'all', 'expired'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer capitalize whitespace-nowrap shrink-0 ${
                      filterType === f
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isDarkMode
                        ? 'text-slate-100 hover:text-white hover:bg-[#1e2636]'
                        : 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                    }`}
                  >
                    {f === 'selected' ? `Selected Only (${selectedUserIds.length})` : f === 'all' ? 'All Subscribers' : 'Expired / Grace'}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={toggleSelectAll}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] text-slate-950 dark:text-white text-xs font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#1e2636] cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                )}
                <span>{isAllSelected ? 'Unselect All' : 'Select All'}</span>
              </button>

              <button
                onClick={handleStartRecharge}
                disabled={selectedUserIds.length === 0 || isActivating}
                className={`px-5 sm:px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-lg flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedUserIds.length === 0 || isActivating
                    ? 'bg-slate-400 dark:bg-slate-700 opacity-50 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                }`}
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Recharge All Selected ({selectedUserIds.length})</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto vertix-dashboard-scroll" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain' }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b text-[11px] font-extrabold uppercase tracking-wider ${
                  isDarkMode ? 'bg-[#10141b] border-[#2d3648] text-slate-100' : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}>
                  <th className="py-3.5 px-4 w-12 text-center">
                    <button onClick={toggleSelectAll} className="cursor-pointer">
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 dark:text-slate-300 inline" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Subscriber</th>
                  <th className="py-3.5 px-4">Current Package</th>
                  <th className="py-3.5 px-4">Rate / Mo</th>
                  <th className="py-3.5 px-4">Current Expiry</th>
                  <th className="py-3.5 px-4">New Expiry Preview</th>
                  <th className="py-3.5 px-4 text-right">Renewal Bill</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648] font-medium">
                {displayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-700 dark:text-slate-200 font-semibold">
                      No subscribers match the current filter.
                    </td>
                  </tr>
                ) : (
                  displayUsers.map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    const isCurrentlyActivating = activatingUserId === user.id;
                    const isCompleted = completedUserIds.includes(user.id);

                    // User's own assigned package details
                    const pkg = store.packages.find(p => p.name === user.package) || store.packages[0];
                    const pkgPrice = pkg ? pkg.pricePerMonth : 1500;
                    const userBill = pkgPrice * renewMonths;

                    // Expiry preview
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const currentExpDate = new Date(user.expiry);
                    const baseDate = isNaN(currentExpDate.getTime()) || currentExpDate < today ? today : currentExpDate;
                    const nextExpDate = new Date(baseDate);
                    nextExpDate.setDate(nextExpDate.getDate() + renewMonths * 30);
                    const newExpiryStr = nextExpDate.toISOString().split('T')[0];

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${
                          isCurrentlyActivating
                            ? 'bg-emerald-500/15 dark:bg-emerald-950/60 font-bold'
                            : isSelected
                            ? isDarkMode
                              ? 'bg-emerald-950/35'
                              : 'bg-emerald-50/70'
                            : isDarkMode
                            ? 'hover:bg-[#1c2330]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Tick box Checkbox */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toggleSelectUser(user.id)}
                            disabled={isActivating}
                            className="cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 dark:text-slate-300 inline" />
                            )}
                          </button>
                        </td>

                        {/* Subscriber Name & Username */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                                <span>{user.name}</span>
                                <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 font-lexend">@{user.username}</span>
                              </div>
                              <div className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 font-lexend">{user.mobile}</div>
                            </div>
                          </div>
                        </td>

                        {/* Current Package (Preserved!) */}
                        <td className="py-3 px-4 font-bold text-emerald-800 dark:text-emerald-200 font-lexend">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-lexend">
                            {user.package}
                          </span>
                        </td>

                        {/* Rate / Mo */}
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 font-lexend tabular-nums">
                          Rs. {pkgPrice.toLocaleString()}
                        </td>

                        {/* Current Expiry */}
                        <td className={`py-3 px-4 font-lexend ${(user.status === 'Expired' || isUserExpired(user)) ? 'text-rose-700 dark:text-rose-300 font-extrabold' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>
                          {user.expiry}
                        </td>

                        {/* New Expiry Preview */}
                        <td className="py-3 px-4 font-lexend font-bold text-emerald-700 dark:text-emerald-300">
                          {newExpiryStr}
                        </td>

                        {/* Renewal Bill */}
                        <td className="py-3 px-4 text-right font-black text-slate-950 dark:text-white tabular-nums">
                          Rs. {userBill.toLocaleString()}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {isCurrentlyActivating ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-bold animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Activating...</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Renewed</span>
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-800 dark:text-blue-200 text-[10px] font-bold">
                              <span>Ready</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-semibold">
                              <span>Unselected</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* COMPLETION CELEBRATION OVERLAY / MODAL WITH BIG CHECKMARK ANIMATION */}
      <AnimatePresence>
        {showCompletionOverlay && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          >
            <motion.div
              data-font-lexend="true"
              style={{ fontFamily: "'Lexend', sans-serif" }}
              {...dialogMotion}
              className={`transform-gpu will-change-transform w-full max-w-md rounded-3xl p-8 shadow-2xl border text-center flex flex-col items-center relative overflow-hidden font-lexend ${
                isDarkMode ? 'bg-[#161b24] border-[#2d3648] text-white' : 'bg-white border-slate-300 text-slate-950'
              }`}
            >
              <div
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)' }}
              />

              {/* Big Checkmark Animation */}
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-6 relative"
              >
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" />
                <Check className="w-12 h-12 stroke-[3.5]" />
              </motion.div>

              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white mb-6">
                Bulk Recharge Completed!
              </h2>

              <DeferredBody
                fallback={
                  <div className="w-full min-h-[180px] space-y-6">
                    <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <SkBar w="w-36" h="h-3" />
                          <SkBar w="w-24" h="h-3.5" />
                        </div>
                      ))}
                    </div>
                    <SkBar w="w-full" h="h-12" rounded="rounded-full" />
                  </div>
                }
              >
                {/* Summary Box */}
                <div className="w-full p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-xs space-y-2 mb-6">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-700 dark:text-slate-200">Total Accounts Renewed:</span>
                    <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black">
                      {completedUserIds.length} Subscribers
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-700 dark:text-slate-200">Total Amount Deducted:</span>
                    <span className="text-emerald-700 dark:text-emerald-300 text-sm font-black tabular-nums">
                      Rs. {totalRechargedAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-500 dark:text-slate-400">Validity Extension:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      +{renewMonths * 30} Days ({renewMonths} Month{renewMonths === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>

                {/* OKAY BUTTON */}
                <button
                  onClick={handleCompletionOkay}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-500/30 cursor-pointer active:scale-98 transition-transform"
                >
                  OKAY
                </button>
              </DeferredBody>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
