import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Download,
  Search,
  Filter,
  DollarSign,
  Calendar,
  RotateCcw,
  User,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Send
} from 'lucide-react';
import { Payment, useRadiusStore, getRelativeDate } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixModal, VertixLandscapeCard } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface PaymentsViewProps {
  store: ReturnType<typeof useRadiusStore>;
  isDarkMode: boolean;
  currencySymbol: string;
  currencyRate: number;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PaymentsView({
  store,
  isDarkMode,
  currencySymbol,
  currencyRate,
  addToast,
}: PaymentsViewProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'All' | 'Today' | 'Week' | 'Month'>('All');
  const [methodFilter, setMethodFilter] = useState<'All' | Payment['method']>('All');

  // Modal State
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(store.users[0]?.id || '');
  const [amount, setAmount] = useState('2000');
  const [method, setMethod] = useState<Payment['method']>('Cash');
  const [note, setNote] = useState('');
  const [renewNow, setRenewNow] = useState(false);
  const [renewPackageId, setRenewPackageId] = useState(store.packages[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedUserId && store.users.length > 0) {
      setSelectedUserId(store.users[0].id);
    }
  }, [selectedUserId, store.users]);

  useEffect(() => {
    if (!renewPackageId && store.packages.length > 0) {
      setRenewPackageId(store.packages[0].id);
    }
  }, [renewPackageId, store.packages]);

  // Helpers to calculate date metrics
  const summaryCards = useMemo(() => {
    const todayStr = getRelativeDate(0);
    const weekAgoStr = getRelativeDate(-7);
    const monthAgoStr = getRelativeDate(-30);

    let todayTotal = 0;
    let weekTotal = 0;
    let monthTotal = 0;
    let allTotal = 0;

    for (const p of store.payments) {
      const amt = p.amount || 0;
      allTotal += amt;
      if (p.date === todayStr) {
        todayTotal += amt;
      }
      if (p.date >= weekAgoStr) {
        weekTotal += amt;
      }
      if (p.date >= monthAgoStr) {
        monthTotal += amt;
      }
    }

    const formatAmt = (val: number) => {
      // Amount in PKR converted using rate and symbol
      const converted = (currencySymbol.includes('Rs') || currencyRate === 1) ? val : (val / 280) * currencyRate;
      return `${currencySymbol}${converted.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    };

    return {
      today: formatAmt(todayTotal),
      todayRawPKR: todayTotal,
      week: formatAmt(weekTotal),
      month: formatAmt(monthTotal),
      total: formatAmt(allTotal),
    };
  }, [store.payments, currencySymbol, currencyRate]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    const todayStr = getRelativeDate(0);
    const weekAgoStr = getRelativeDate(-7);
    const monthAgoStr = getRelativeDate(-30);

    return store.payments.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.username.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q)) ||
        (p.manager && p.manager.toLowerCase().includes(q)) ||
        (p.packageName && p.packageName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Date Range
      if (dateRange === 'Today' && p.date !== todayStr) return false;
      if (dateRange === 'Week' && p.date < weekAgoStr) return false;
      if (dateRange === 'Month' && p.date < monthAgoStr) return false;

      // Method
      if (methodFilter !== 'All' && p.method !== methodFilter) return false;

      return true;
    });
  }, [store.payments, searchQuery, dateRange, methodFilter]);

  // Format single payment amount
  const formatPaymentAmount = (pkrAmt: number) => {
    const converted = (currencySymbol.includes('Rs') || currencyRate === 1) ? pkrAmt : (pkrAmt / 280) * currencyRate;
    return `${currencySymbol}${converted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredPayments.length === 0) {
      addToast('No payments to export.', 'error');
      return;
    }
    const headers = ['ID', 'Date', 'Username', 'Package', 'Amount (PKR)', 'Converted', 'Type', 'Method', 'Manager', 'Note'];
    const rows = filteredPayments.map(p => [
      p.id,
      p.date,
      p.username,
      `"${p.packageName || 'N/A'}"`,
      p.amount,
      `"${formatPaymentAmount(p.amount)}"`,
      p.type,
      p.method,
      `"${p.manager || 'Admin'}"`,
      `"${(p.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `vertix_payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${filteredPayments.length} payments to CSV!`, 'success');
  };

  // Add Payment Submit
  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const user = store.users.find(u => u.id === selectedUserId);
    const amt = Number(amount) || 0;

    setIsSubmitting(true);
    try {
      await store.addPayment({
        userId: selectedUserId,
        username: user ? user.username : 'Walk-in Subscriber',
        amount: amt,
        type: 'Manual',
        method,
        date: getRelativeDate(0),
        packageName: user?.package,
        note: note.trim() || 'Manual counter payment',
      });

      if (renewNow && user) {
        await store.renewUser(user.id, renewPackageId, 1);
        addToast(`Payment of Rs. ${amt.toLocaleString()} recorded & ${user.username} renewed (+1 mo)!`, 'success');
      } else {
        addToast(`Payment of Rs. ${amt.toLocaleString()} recorded in ledger!`, 'success');
      }

      setShowAddPaymentModal(false);
      setAmount('2000');
      setNote('');
      setRenewNow(false);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (store.isLoading && store.payments.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-stretch">
        <VertixLandscapeCard
          title="Today's Collection"
          value={summaryCards.today}
          badge={`Rs. ${summaryCards.todayRawPKR.toLocaleString()}`}
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={DollarSign}
          iconBgGradient="bg-gradient-to-br from-emerald-600 to-green-700"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="This Week"
          value={summaryCards.week}
          badge="7-Day Rolling"
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Calendar}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="This Month"
          value={summaryCards.month}
          badge="30-Day Total"
          badgeColor="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={Banknote}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Total Invoiced"
          value={summaryCards.total}
          badge="Ledger Total"
          badgeColor="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-700"
          icon={CreditCard}
          iconBgGradient="bg-gradient-to-br from-slate-700 to-indigo-900"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* PAYMENTS TABLE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-colors w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>Payments & Billing Ledger</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
              Real-time audit log of all subscriber renewals, dealer top-ups, voucher redemptions, and transfers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user, manager, note..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`text-xs pl-8 pr-3 py-1.5 sm:py-2 rounded-full border outline-none font-semibold w-36 sm:w-48 ${
                  isDarkMode
                    ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400'
                    : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-600'
                }`}
              />
            </div>

            {/* Date Range Chips */}
            <div className="flex items-center gap-1">
              {(['All', 'Today', 'Week', 'Month'] as const).map(chip => (
                <button
                  key={chip}
                  onClick={() => setDateRange(chip)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    dateRange === chip
                      ? 'bg-[#14532d] text-white border-emerald-500 shadow-xs'
                      : isDarkMode
                      ? 'bg-[#10141b] border-[#333d52] text-slate-100 hover:bg-[#1e2636]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Method Select */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value as any)}
              className={`text-xs font-bold px-3 py-1.5 sm:py-2 rounded-full border outline-none cursor-pointer ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Easypaisa">Easypaisa</option>
              <option value="JazzCash">JazzCash</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Online">Online Gateway</option>
            </select>

            {/* Add Payment Button */}
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="px-4 py-1.5 sm:py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Payment</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 sm:py-2 rounded-full border border-slate-300 dark:border-[#333d52] hover:bg-slate-100 dark:hover:bg-[#1c2330] text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Export Ledger CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-[#2d3648]">
                <th className="py-3 px-3 sm:px-4">Date</th>
                <th className="py-3 px-3 sm:px-4">Subscriber / Party</th>
                <th className="py-3 px-3 sm:px-4">Package</th>
                <th className="py-3 px-3 sm:px-4">Amount</th>
                <th className="py-3 px-3 sm:px-4">Method</th>
                <th className="py-3 px-3 sm:px-4">Type</th>
                <th className="py-3 px-3 sm:px-4">Agent / Manager</th>
                <th className="py-3 px-3 sm:px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-700 dark:text-slate-300 font-bold text-xs">
                    No payment records match this criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] transition-colors"
                  >
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                      {p.date}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap font-extrabold text-black dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{p.username}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap text-xs font-bold text-slate-900 dark:text-slate-100">
                      {p.packageName || 'Standard'}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                          {formatPaymentAmount(p.amount)}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          Rs. {p.amount.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-[#10141b] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-[#333d52]">
                        {p.method}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.type === 'Renewal'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                            : p.type === 'Voucher'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                            : p.type === 'Transfer'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                        }`}
                      >
                        {p.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {p.manager || 'SuperAdmin'}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {p.note || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PAYMENT MODAL */}
      <VertixModal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        title="Record Payment / Top-up"
        subtitle="Log an incoming cash, online, or dealer float payment to the ledger"
        icon={Plus}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleAddPaymentSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Subscriber / Payer *
            </label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              {store.users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} — {u.name} ({u.package})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Amount (PKR) *
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-black ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Payment Channel *
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as any)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Cash">Cash (Counter)</option>
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Bank">Bank Deposit</option>
                <option value="Online">Online Gateway</option>
              </select>
            </div>
          </div>

          {/* Renew Now Checkbox */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#10141b] border border-slate-300 dark:border-[#2d3648] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={renewNow}
                onChange={e => setRenewNow(e.target.checked)}
                className="rounded border-slate-400 dark:border-[#333d52] dark:bg-[#10141b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-black dark:text-white">
                Renew subscriber account immediately
              </span>
            </label>

            {renewNow && (
              <div className="pt-2 border-t border-slate-200 dark:border-[#2d3648]">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1 block">
                  Assign Package for Renewal
                </label>
                <select
                  value={renewPackageId}
                  onChange={e => setRenewPackageId(e.target.value)}
                  className={`w-full text-xs px-3 py-1.5 rounded-xl border outline-none font-bold ${
                    isDarkMode ? 'bg-[#161b24] border-[#333d52] text-white' : 'bg-white border-slate-300 text-slate-950'
                  }`}
                >
                  {store.packages.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Rs. {p.pricePerMonth})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Notes / Receipt Number
            </label>
            <input
              type="text"
              placeholder="e.g. Counter receipt #88192"
              value={note}
              onChange={e => setNote(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              }`}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddPaymentModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </VertixModal>
    </div>
  );
}
