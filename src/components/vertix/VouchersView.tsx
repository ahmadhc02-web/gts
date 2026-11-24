import React, { useState, useMemo, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Copy,
  Printer,
  Download,
  Trash2,
  RotateCcw,
  Search,
  Check,
  CheckCircle2,
  Clock,
  UserCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Voucher, useRadiusStore } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixModal, VertixLandscapeCard, ConfirmDeleteModal } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface VouchersViewProps {
  store: ReturnType<typeof useRadiusStore>;
  isDarkMode: boolean;
  currencySymbol: string;
  currencyRate: number;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function VouchersView({
  store,
  isDarkMode,
  currencySymbol,
  currencyRate,
  addToast,
}: VouchersViewProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unused' | 'Used'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals
  const [showGenModal, setShowGenModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Generate Form
  const [genPackageId, setGenPackageId] = useState(store.packages[0]?.id || '');
  const [genCount, setGenCount] = useState(20);
  const [genPrefix, setGenPrefix] = useState('VTX');
  const [genMonths, setGenMonths] = useState(1);

  // Redeem Form
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemUserId, setRedeemUserId] = useState(store.users[0]?.id || '');
  const [redeemError, setRedeemError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!genPackageId && store.packages.length > 0) {
      setGenPackageId(store.packages[0].id);
    }
  }, [genPackageId, store.packages]);

  useEffect(() => {
    if (!redeemUserId && store.users.length > 0) {
      setRedeemUserId(store.users[0].id);
    }
  }, [redeemUserId, store.users]);

  // 4 Landscape Summary Cards
  const summaryCards = useMemo(() => {
    const total = store.vouchers.length;
    const unused = store.vouchers.filter(v => v.status === 'Active').length;
    const used = store.vouchers.filter(v => v.status === 'Redeemed').length;
    const totalFaceValuePKR = store.vouchers.reduce((acc, v) => acc + (v.price || 0), 0);
    const convertedVal = (currencySymbol.includes('Rs') || currencyRate === 1) ? totalFaceValuePKR : (totalFaceValuePKR / 280 * currencyRate);
    const formattedVal = `${currencySymbol}${convertedVal.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;

    return {
      total,
      unused,
      used,
      inventoryVal: formattedVal,
    };
  }, [store.vouchers, currencySymbol, currencyRate]);

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return store.vouchers.filter(v => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.code.toLowerCase().includes(q) ||
        v.packageName.toLowerCase().includes(q) ||
        (v.redeemedBy && v.redeemedBy.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'Unused') return v.status === 'Active';
      if (statusFilter === 'Used') return v.status === 'Redeemed';
      return true;
    });
  }, [store.vouchers, searchQuery, statusFilter]);

  // Unused vouchers for print layout
  const unusedVouchers = useMemo(() => {
    return store.vouchers.filter(v => v.status === 'Active');
  }, [store.vouchers]);

  // Copy code helper
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addToast(`Copied code "${code}" to clipboard!`, 'info');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVouchers.map(v => v.id));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) {
      addToast('No vouchers to export.', 'error');
      return;
    }
    const headers = ['Voucher Code', 'Package', 'Price (PKR)', 'Duration (Months)', 'Status', 'Created Date', 'Used By', 'Redeemed At'];
    const rows = filteredVouchers.map(v => [
      v.code,
      `"${v.packageName}"`,
      v.price,
      v.months,
      v.status === 'Active' ? 'Unused' : v.status === 'Redeemed' ? 'Used' : v.status,
      v.createdAt,
      v.redeemedBy || 'N/A',
      v.redeemedAt || 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `vertix_vouchers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${filteredVouchers.length} vouchers to CSV!`, 'success');
  };

  // Generate submit
  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!genPackageId) {
      addToast('Please select a package profile.', 'error');
      return;
    }
    const count = Math.min(200, Math.max(1, Number(genCount) || 10));
    setIsSubmitting(true);
    try {
      const created = await store.generateVouchers(count, genPackageId, Number(genMonths) || 1, genPrefix.trim() || 'VTX');
      addToast(`Generated ${created.length || count} new 10-character vouchers!`, 'success');
      setShowGenModal(false);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redeem submit
  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setRedeemError('');
    if (!redeemCode.trim()) {
      setRedeemError('Please enter a voucher code.');
      return;
    }
    setIsSubmitting(true);
    try {
      await store.redeemVoucher(redeemCode.trim(), redeemUserId);
      const user = store.users.find(u => u.id === redeemUserId);
      addToast(`Redeemed voucher for ${user?.username || 'subscriber'}! Account renewed.`, 'success');
      setShowRedeemModal(false);
      setRedeemCode('');
    } catch (err: any) {
      setRedeemError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await store.deleteVouchers(selectedIds);
      addToast(`Deleted ${selectedIds.length} vouchers.`, 'info');
      setSelectedIds([]);
      setShowDeleteModal(false);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (store.isLoading && store.vouchers.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-stretch">
        <VertixLandscapeCard
          title="Total Vouchers"
          value={summaryCards.total}
          badge="Inventory"
          badgeColor="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={Ticket}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Unused Cards"
          value={summaryCards.unused}
          badge="Ready to Redeem"
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={CheckCircle2}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Redeemed / Used"
          value={summaryCards.used}
          badge="Claimed"
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={UserCheck}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Face Value Inventory"
          value={summaryCards.inventoryVal}
          badge="Stock Value"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Sparkles}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* VOUCHERS TABLE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>Prepaid Vouchers & Scratch Cards</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              10-character scratch card generation, 1-click clipboard copy, and printable dealer sheets
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, package..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`text-xs pl-8 pr-3 py-1.5 sm:py-2 rounded-full border outline-none font-medium w-36 sm:w-48 ${
                  isDarkMode
                    ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400'
                    : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1">
              {(['All', 'Unused', 'Used'] as const).map(chip => (
                <button
                  key={chip}
                  onClick={() => setStatusFilter(chip)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                    statusFilter === chip
                      ? 'bg-[#14532d] text-white border-emerald-600 shadow-xs'
                      : isDarkMode
                      ? 'bg-[#10141b] border-[#333d52] text-slate-200 hover:text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Redeem Modal Trigger */}
            <button
              onClick={() => {
                setRedeemError('');
                setShowRedeemModal(true);
              }}
              className="px-3.5 py-1.5 sm:py-2 rounded-full border border-emerald-500/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Redeem</span>
            </button>

            {/* Generate Modal Trigger */}
            <button
              onClick={() => setShowGenModal(true)}
              className="px-4 py-1.5 sm:py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate (1-200)</span>
            </button>

            {/* Print Layout Trigger */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-1.5 sm:py-2 rounded-full border border-slate-300 dark:border-[#333d52] hover:bg-slate-100 dark:hover:bg-[#1c2330] text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Print Scratch Cards"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 sm:py-2 rounded-full border border-slate-300 dark:border-[#333d52] hover:bg-slate-100 dark:hover:bg-[#1c2330] text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Export Vouchers CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="mt-3 p-2.5 px-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-600/40 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              {selectedIds.length} vouchers selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-700 hover:underline font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-[#2d3648]">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredVouchers.length > 0 &&
                      selectedIds.length === filteredVouchers.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-400 dark:border-[#333d52] dark:bg-[#10141b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 sm:px-4">Voucher Code</th>
                <th className="py-3 px-3 sm:px-4">Package</th>
                <th className="py-3 px-3 sm:px-4">Price / Duration</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4">Redeemed By</th>
                <th className="py-3 px-3 sm:px-4">Created Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-700 dark:text-slate-300 font-bold text-xs">
                    No vouchers match your filter.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(voucher => {
                  const isSelected = selectedIds.includes(voucher.id);
                  const isUnused = voucher.status === 'Active';

                  return (
                    <tr
                      key={voucher.id}
                      className={`transition-colors ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-emerald-950/30'
                            : 'bg-emerald-50/70'
                          : 'hover:bg-emerald-50/40 dark:hover:bg-[#1c2330]'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(voucher.id)}
                          className="rounded border-slate-400 dark:border-[#333d52] dark:bg-[#10141b] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs sm:text-sm text-black dark:text-white tracking-wider">
                            {voucher.code}
                          </span>
                          <button
                            onClick={() => handleCopy(voucher.code)}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#2d3648] text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                            title="Copy code to clipboard"
                          >
                            {copiedCode === voucher.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {voucher.packageName}
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <span className="font-bold text-black dark:text-white">
                          Rs. {voucher.price.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 ml-1">
                          ({voucher.months} mo)
                        </span>
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            isUnused
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-slate-200 dark:bg-[#10141b] text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-[#333d52]'
                          }`}
                        >
                          ● {isUnused ? 'Unused' : 'Used'}
                        </span>
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {voucher.redeemedBy ? (
                          <span className="flex items-center gap-1 font-mono font-bold text-blue-700 dark:text-blue-300">
                            <UserCheck className="w-3 h-3" />
                            {voucher.redeemedBy}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 italic">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                        {voucher.createdAt}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedIds([voucher.id]);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GENERATE VOUCHERS MODAL (1-200) */}
      <VertixModal
        isOpen={showGenModal}
        onClose={() => setShowGenModal(false)}
        title="Generate Scratch Cards"
        subtitle="Batch generate unique 10-character subscriber voucher codes"
        icon={Plus}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleGenerateSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Package Profile *
            </label>
            <select
              value={genPackageId}
              onChange={e => setGenPackageId(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              {store.packages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.speed}) — Rs. {p.pricePerMonth}/mo
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Quantity (1 - 200) *
              </label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={genCount}
                onChange={e => setGenCount(Number(e.target.value))}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Code Prefix
              </label>
              <input
                type="text"
                placeholder="e.g. VTX"
                value={genPrefix}
                onChange={e => setGenPrefix(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Validity Duration
            </label>
            <select
              value={genMonths}
              onChange={e => setGenMonths(Number(e.target.value))}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              <option value={1}>1 Month (30 Days)</option>
              <option value={2}>2 Months (60 Days)</option>
              <option value={3}>3 Months (90 Days)</option>
              <option value={6}>6 Months (180 Days)</option>
              <option value={12}>1 Year (360 Days)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/50 border border-emerald-600/40 text-xs font-bold flex items-center justify-between text-emerald-950 dark:text-emerald-200">
            <span>Total Face Value:</span>
            <span className="text-sm font-black">
              Rs. {((store.packages.find(p => p.id === genPackageId)?.pricePerMonth || 1500) * genMonths * genCount).toLocaleString()}
            </span>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowGenModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#14532d] hover:bg-[#0b3d2e] text-white font-bold text-xs shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Generating...' : 'Generate Batch'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* REDEEM VOUCHER MODAL */}
      <VertixModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        title="Redeem Voucher Card"
        subtitle="Apply voucher to renew subscriber account and record ledger payment"
        icon={RotateCcw}
        iconColor="text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleRedeemSubmit} className="space-y-3">
          {redeemError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 p-2 rounded-xl">
              {redeemError}
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              10-Character Voucher Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. VTX-7A9B3C2D1E"
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold tracking-wider ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              }`}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Target Subscriber *
            </label>
            <select
              value={redeemUserId}
              onChange={e => setRedeemUserId(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              {store.users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} — {u.name} ({u.status}, Exp: {u.expiry})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowRedeemModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Redeeming...' : 'Redeem & Activate'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* PRINT LAYOUT MODAL (12 per page) */}
      <VertixModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Printable Voucher Cards"
        subtitle={`Showing ${Math.min(12, unusedVouchers.length)} of ${unusedVouchers.length} unused vouchers for high-quality printing`}
        icon={Printer}
        maxWidth="max-w-4xl"
        isDarkMode={isDarkMode}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2d3648]">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Print Sheet (12 Cards / Page layout)
            </span>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Send to Printer</span>
            </button>
          </div>

          {/* 12 Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {unusedVouchers.slice(0, 12).map((voucher, idx) => (
              <div
                key={voucher.id}
                className="p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#333d52] bg-white dark:bg-[#10141b] flex flex-col justify-between text-xs space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2d3648] pb-1.5">
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-[11px] tracking-tight">
                    GREEN PRO FIBER
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">#{idx + 1}</span>
                </div>

                <div>
                  <p className="font-extrabold text-slate-950 dark:text-white text-xs">
                    {voucher.packageName}
                  </p>
                  <p className="text-[10px] text-slate-700 dark:text-slate-300">
                    Validity: {voucher.months} Month(s)
                  </p>
                </div>

                {/* Scratch Code Box */}
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#161b24] border border-slate-300 dark:border-[#333d52] text-center">
                  <span className="text-[9px] text-slate-600 dark:text-slate-300 uppercase font-bold block">
                    Scratch Secret
                  </span>
                  <span className="font-mono font-black text-xs text-black dark:text-white tracking-widest">
                    {voucher.code}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-[#2d3648]">
                  <span>Price: Rs. {voucher.price}</span>
                  <span>Dial 1212</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowPrintModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </VertixModal>

      {/* BULK DELETE CONFIRM */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Vouchers"
        message={`Are you sure you want to delete ${selectedIds.length} selected vouchers?`}
        subMessage="Redeemed or active codes will be permanently removed from circulation."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
