import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Power,
  Wallet,
  Tag,
  AlertCircle,
  Sparkles,
  Users,
  CheckCircle2,
  History,
} from 'lucide-react';
import {
  radiusApi,
  type RadiusDealer,
  type WalletLedgerEntry,
  type DealerPackagePrice,
  type MainUserCandidate,
} from './radiusApi';
import { VertixModal, VertixLandscapeCard } from './ui';
import { SkTable, SkVertixLandscapeTile } from '../skeleton/Skeleton';
import type { UserProfile } from '../../types';

interface DealersViewProps {
  store: any;
  mainUsers?: UserProfile[];
  isDarkMode?: boolean;
  currencySymbol?: string;
  currencyRate?: number;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function DealersView({
  store,
  mainUsers = [],
  isDarkMode = false,
  currencySymbol = 'Rs.',
  currencyRate = 1,
  addToast,
}: DealersViewProps) {
  const [search, setSearch] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDealer, setEditingDealer] = useState<RadiusDealer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [selectedUid, setSelectedUid] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [commissionPct, setCommissionPct] = useState('0');
  const [suggestedVlan, setSuggestedVlan] = useState<number | null>(null);

  // Wallet modal
  const [walletDealer, setWalletDealer] = useState<RadiusDealer | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupMethod, setTopupMethod] = useState('Cash');
  const [topupRef, setTopupRef] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupSaving, setTopupSaving] = useState(false);

  // Prices modal
  const [priceDealer, setPriceDealer] = useState<RadiusDealer | null>(null);
  const [prices, setPrices] = useState<DealerPackagePrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesSaving, setPricesSaving] = useState(false);

  const dealers: RadiusDealer[] = store.dealers || [];
  const canViewRevenue = store.can('revenue.view');

  const candidateUsers = useMemo<MainUserCandidate[]>(() => {
    const map = new Map<string, MainUserCandidate>();
    for (const u of store.mainUsers || []) {
      if (u?.uid) map.set(u.uid, u);
    }
    for (const u of mainUsers) {
      if (u?.uid && !map.has(u.uid)) {
        map.set(u.uid, {
          uid: u.uid,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          email: u.email,
          phone: (u as { phone?: string }).phone,
          companyName: u.companyName,
          status: u.status,
        });
      }
    }
    return Array.from(map.values());
  }, [store.mainUsers, mainUsers]);

  const openAddModal = () => {
    setEditingDealer(null);
    setSelectedUid(candidateUsers[0]?.uid || '');
    setCompanyName('');
    setPhone('');
    setCreditLimit('0');
    setCommissionPct('0');
    setFormError('');
    setSuggestedVlan(null);
    setShowAddEditModal(true);

    radiusApi.vlans
      .suggest()
      .then(res => {
        if (res?.suggestedVlanId) setSuggestedVlan(res.suggestedVlanId);
      })
      .catch(() => {
        // Compute next dealer VLAN preview from existing dealers count if endpoint unavailable
        const nextNo = dealers.reduce((max, d) => Math.max(max, d.dealer_no || 0), 0) + 1;
        setSuggestedVlan(100 + nextNo * 10);
      });
  };

  useEffect(() => {
    if (!editingDealer && selectedUid) {
      const user = candidateUsers.find(u => u.uid === selectedUid);
      if (user) {
        if (!companyName && user.companyName) setCompanyName(user.companyName);
        if (!phone && user.phone) setPhone(user.phone);
      }
    }
  }, [selectedUid, editingDealer, candidateUsers]);

  const openEditModal = (dealer: RadiusDealer) => {
    setEditingDealer(dealer);
    setSelectedUid(dealer.uid);
    setCompanyName(dealer.company_name);
    setPhone(dealer.phone);
    setCreditLimit(String(dealer.credit_limit ?? 0));
    setCommissionPct(String(dealer.commission_pct ?? 0));
    setSuggestedVlan(dealer.main_vlan_id || dealer.vlan_id || null);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleSaveDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!editingDealer && !selectedUid) {
      setFormError('Please select an existing main user.');
      return;
    }
    if (!companyName.trim()) {
      setFormError('Company name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingDealer) {
        await radiusApi.dealers.update(editingDealer.uid, {
          company_name: companyName.trim(),
          phone: phone.trim(),
          credit_limit: Number(creditLimit) || 0,
          commission_pct: Number(commissionPct) || 0,
        });
        addToast?.(`Dealer "${companyName.trim()}" updated`, 'success');
      } else {
        await radiusApi.dealers.create({
          uid: selectedUid,
          company_name: companyName.trim(),
          phone: phone.trim(),
          credit_limit: Number(creditLimit) || 0,
          commission_pct: Number(commissionPct) || 0,
        });
        addToast?.(`Dealer "${companyName.trim()}" added`, 'success');
      }
      setShowAddEditModal(false);
      await store.refreshAll(true);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save dealer';
      setFormError(msg);
      addToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisable = async (dealer: RadiusDealer) => {
    const nextStatus = dealer.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await radiusApi.dealers.disable(dealer.uid, nextStatus);
      addToast?.(`Dealer ${dealer.company_name} is now ${nextStatus}`, 'success');
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to toggle dealer status', 'error');
    }
  };

  const openWalletModal = async (dealer: RadiusDealer) => {
    setWalletDealer(dealer);
    setTopupAmount('');
    setTopupMethod('Cash');
    setTopupRef('');
    setTopupNote('');
    setLedger([]);
    setLedgerLoading(true);
    try {
      const res = await radiusApi.dealers.getWalletLedger(dealer.uid);
      const rows = Array.isArray(res) ? res : res?.ledger || [];
      setLedger(rows);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to load wallet ledger', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletDealer) return;
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) {
      addToast?.('Enter a valid positive amount', 'error');
      return;
    }
    setTopupSaving(true);
    try {
      const res = await radiusApi.dealers.topupWallet(walletDealer.uid, {
        amount: amt,
        method: topupMethod,
        reference: topupRef.trim() || undefined,
        note: topupNote.trim() || undefined,
      });
      addToast?.(`Wallet topped up by ${currencySymbol} ${amt.toLocaleString()}`, 'success');
      setTopupAmount('');
      setTopupRef('');
      setTopupNote('');
      if (typeof res?.wallet_balance === 'number') {
        setWalletDealer(prev => (prev ? { ...prev, wallet_balance: res.wallet_balance! } : null));
      }
      const ledgerRes = await radiusApi.dealers.getWalletLedger(walletDealer.uid);
      setLedger(Array.isArray(ledgerRes) ? ledgerRes : ledgerRes?.ledger || []);
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Wallet top-up failed', 'error');
    } finally {
      setTopupSaving(false);
    }
  };

  const openPricesModal = async (dealer: RadiusDealer) => {
    setPriceDealer(dealer);
    setPrices([]);
    setPricesLoading(true);
    try {
      const res = await radiusApi.dealers.getPrices(dealer.uid);
      const list = Array.isArray(res) ? res : res?.prices || [];
      setPrices(list);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to load dealer package prices', 'error');
    } finally {
      setPricesLoading(false);
    }
  };

  const handleSavePrices = async () => {
    if (!priceDealer) return;
    setPricesSaving(true);
    try {
      await radiusApi.dealers.updatePrices(
        priceDealer.uid,
        prices.map(p => ({ package_id: p.package_id, dealer_price: Number(p.dealer_price) || 0 }))
      );
      addToast?.(`Dealer prices saved for ${priceDealer.company_name}`, 'success');
      setPriceDealer(null);
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to save dealer prices', 'error');
    } finally {
      setPricesSaving(false);
    }
  };

  const filteredDealers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      d =>
        String(d.dealer_no).includes(q) ||
        d.company_name.toLowerCase().includes(q) ||
        (d.username || '').toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q)
    );
  }, [dealers, search]);

  const summary = useMemo(() => {
    const total = dealers.length;
    const active = dealers.filter(d => d.status === 'Active').length;
    const totalWallet = dealers.reduce((s, d) => s + Number(d.wallet_balance || 0), 0);
    const totalCredit = dealers.reduce((s, d) => s + Number(d.credit_limit || 0), 0);
    const totalSubs = dealers.reduce((s, d) => s + Number(d.subscribers_count || 0), 0);
    return { total, active, totalWallet, totalCredit, totalSubs };
  }, [dealers]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-black text-black dark:text-white">
              Dealers Management
            </h2>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Manage line dealers, auto-assigned VLANs, wallet top-ups, credit limits, and dealer package pricing.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Dealer
        </button>
      </div>

      {/* Stat Cards */}
      {store.isLoading && dealers.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <VertixLandscapeCard
            title="Total Dealers"
            value={summary.total}
            badge={`${summary.active} Active`}
            badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
            icon={Building2}
            iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            isDarkMode={isDarkMode}
          />
          <VertixLandscapeCard
            title="Dealer Subscribers"
            value={summary.totalSubs}
            icon={Users}
            iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            isDarkMode={isDarkMode}
          />
          {canViewRevenue && (
            <>
              <VertixLandscapeCard
                title="Total Wallet Balance"
                value={`${currencySymbol} ${Math.round(summary.totalWallet * currencyRate).toLocaleString()}`}
                icon={Wallet}
                iconBgGradient="bg-gradient-to-br from-amber-500 to-orange-600"
                isDarkMode={isDarkMode}
              />
              <VertixLandscapeCard
                title="Total Credit Limits"
                value={`${currencySymbol} ${Math.round(summary.totalCredit * currencyRate).toLocaleString()}`}
                icon={Tag}
                iconBgGradient="bg-gradient-to-br from-violet-500 to-purple-600"
                isDarkMode={isDarkMode}
              />
            </>
          )}
        </div>
      )}

      {/* Dealers Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-black dark:text-white">
            Dealers ({filteredDealers.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search dealer #, company, phone..."
            className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-medium outline-none ${
              isDarkMode
                ? 'bg-[#24262b] border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-400'
            }`}
          />
        </div>

        {store.isLoading && dealers.length === 0 ? (
          <div className="p-4">
            <SkTable variant="flat" rows={5} cols={8} />
          </div>
        ) : filteredDealers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-black text-black dark:text-white">No dealers registered in this line</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click "Add Dealer" to promote an existing main user into a dealer with a dedicated VLAN & wallet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className={`text-[11px] font-black uppercase tracking-wider border-b ${
                    isDarkMode
                      ? 'bg-[#24262b] text-slate-300 border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <th className="py-2.5 px-3">Dealer No.</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">VLAN</th>
                  {canViewRevenue && <th className="py-2.5 px-3">Wallet Balance</th>}
                  {canViewRevenue && <th className="py-2.5 px-3">Credit Limit</th>}
                  <th className="py-2.5 px-3">Subscribers</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs">
                {filteredDealers.map(d => (
                  <tr
                    key={d.uid}
                    className={isDarkMode ? 'hover:bg-[#24262b]/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-3 font-black text-black dark:text-white">
                      #{d.dealer_no}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-black dark:text-white">{d.company_name}</div>
                      {d.username && (
                        <div className="text-[10px] text-slate-500">@{d.username}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {d.phone || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {d.main_vlan_id || d.vlan_id ? (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold text-[11px]">
                          VLAN {d.main_vlan_id || d.vlan_id}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {canViewRevenue && (
                      <td className="py-2.5 px-3 font-black text-emerald-700 dark:text-emerald-400">
                        {currencySymbol} {Math.round((d.wallet_balance || 0) * currencyRate).toLocaleString()}
                      </td>
                    )}
                    {canViewRevenue && (
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        {currencySymbol} {Math.round((d.credit_limit || 0) * currencyRate).toLocaleString()}
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-bold text-black dark:text-white">
                      {d.subscribers_count ?? 0}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                          d.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openWalletModal(d)}
                          title="Wallet Top-Up & Ledger"
                          className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                        >
                          <Wallet className="w-3 h-3" />
                          Wallet
                        </button>
                        <button
                          type="button"
                          onClick={() => openPricesModal(d)}
                          title="Dealer Package Prices"
                          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-blue-100"
                        >
                          <Tag className="w-3 h-3" />
                          Prices
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(d)}
                          title="Edit Dealer"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#24262b] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDisable(d)}
                          title={d.status === 'Active' ? 'Disable Dealer' : 'Enable Dealer'}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            d.status === 'Active'
                              ? 'border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800'
                              : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dealer Modal */}
      <VertixModal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingDealer ? `Edit Dealer #${editingDealer.dealer_no}` : 'Add New Dealer'}
        subtitle="Dealer gets an auto-assigned main VLAN and isolated wallet"
        icon={Building2}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleSaveDealer} className="space-y-3 text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {suggestedVlan && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {editingDealer ? 'Assigned Main VLAN' : 'Auto-Suggested Main VLAN'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-black">
                VLAN {suggestedVlan}
              </span>
            </div>
          )}

          {!editingDealer && (
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Existing Main User *
              </label>
              <select
                value={selectedUid}
                onChange={e => setSelectedUid(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
                required
              >
                <option value="">Select main user...</option>
                {candidateUsers.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.fullName || u.username} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
              Company Name *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. FastNet Cable & Fiber"
              className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0300-0000000"
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Credit Limit ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Commission (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionPct}
                onChange={e => setCommissionPct(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddEditModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
            >
              {submitting ? 'Saving...' : editingDealer ? 'Update Dealer' : 'Create Dealer'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* Wallet Top-Up + Ledger History Modal */}
      <VertixModal
        isOpen={!!walletDealer}
        onClose={() => setWalletDealer(null)}
        title={walletDealer ? `Wallet & Ledger — ${walletDealer.company_name}` : 'Dealer Wallet'}
        subtitle={walletDealer ? `Dealer #${walletDealer.dealer_no}` : undefined}
        icon={Wallet}
        maxWidth="max-w-2xl"
        isDarkMode={isDarkMode}
      >
        {walletDealer && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-3 rounded-2xl border ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700' : 'bg-emerald-50 border-emerald-300'
                }`}
              >
                <div className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                  Current Wallet Balance
                </div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {currencySymbol} {Math.round((walletDealer.wallet_balance || 0) * currencyRate).toLocaleString()}
                </div>
              </div>
              <div
                className={`p-3 rounded-2xl border ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}
              >
                <div className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                  Credit Limit
                </div>
                <div className="text-lg font-black text-black dark:text-white mt-0.5">
                  {currencySymbol} {Math.round((walletDealer.credit_limit || 0) * currencyRate).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Top-Up Form */}
            <form
              onSubmit={handleTopup}
              className={`p-3 rounded-2xl border space-y-2.5 ${
                isDarkMode ? 'bg-[#24262b] border-slate-700' : 'bg-slate-50 border-slate-300'
              }`}
            >
              <div className="font-black text-black dark:text-white">Record Wallet Top-Up</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  placeholder={`Amount (${currencySymbol})`}
                  className={`px-3 py-2 rounded-xl border font-bold outline-none ${
                    isDarkMode ? 'bg-[#2b2d33] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                  }`}
                  required
                />
                <select
                  value={topupMethod}
                  onChange={e => setTopupMethod(e.target.value)}
                  className={`px-3 py-2 rounded-xl border font-semibold outline-none ${
                    isDarkMode ? 'bg-[#2b2d33] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                  }`}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Easypaisa">Easypaisa</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="Online">Online</option>
                </select>
                <input
                  type="text"
                  value={topupRef}
                  onChange={e => setTopupRef(e.target.value)}
                  placeholder="Reference / Slip #"
                  className={`px-3 py-2 rounded-xl border font-medium outline-none ${
                    isDarkMode ? 'bg-[#2b2d33] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={topupNote}
                  onChange={e => setTopupNote(e.target.value)}
                  placeholder="Optional note..."
                  className={`flex-1 px-3 py-2 rounded-xl border font-medium outline-none ${
                    isDarkMode ? 'bg-[#2b2d33] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                  }`}
                />
                <button
                  type="submit"
                  disabled={topupSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black cursor-pointer shrink-0"
                >
                  {topupSaving ? 'Adding...' : 'Add Credit'}
                </button>
              </div>
            </form>

            {/* Ledger History */}
            <div>
              <div className="flex items-center gap-1.5 font-black text-black dark:text-white mb-2">
                <History className="w-3.5 h-3.5 text-emerald-600" />
                Wallet Ledger History
              </div>
              {ledgerLoading ? (
                <SkTable variant="flat" rows={4} cols={5} />
              ) : ledger.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-700">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr
                        className={`text-[10px] font-black uppercase border-b ${
                          isDarkMode
                            ? 'bg-[#24262b] text-slate-300 border-slate-700'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Balance After</th>
                        <th className="py-2 px-3">Method / Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-[11px]">
                      {ledger.map(entry => {
                        const isCredit = entry.amount >= 0 && entry.type !== 'debit';
                        return (
                          <tr key={entry.id}>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                              {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                            </td>
                            <td className="py-2 px-3 font-bold uppercase text-black dark:text-white">
                              {entry.type}
                            </td>
                            <td
                              className={`py-2 px-3 font-black ${
                                isCredit ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isCredit ? '+' : ''}
                              {currencySymbol} {Math.round(entry.amount * currencyRate).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 font-bold text-black dark:text-white">
                              {currencySymbol} {Math.round((entry.balance_after ?? 0) * currencyRate).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                              {[entry.method, entry.reference, entry.note].filter(Boolean).join(' · ') || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </VertixModal>

      {/* Dealer Package Prices Modal */}
      <VertixModal
        isOpen={!!priceDealer}
        onClose={() => setPriceDealer(null)}
        title={priceDealer ? `Package Pricing — ${priceDealer.company_name}` : 'Dealer Prices'}
        subtitle="Set wholesale dealer rates per package"
        icon={Tag}
        maxWidth="max-w-xl"
        isDarkMode={isDarkMode}
      >
        <div className="space-y-3 text-xs">
          {pricesLoading ? (
            <SkTable variant="flat" rows={4} cols={3} />
          ) : prices.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No packages available to configure for this dealer.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className={`text-[10px] font-black uppercase border-b ${
                      isDarkMode
                        ? 'bg-[#24262b] text-slate-300 border-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <th className="py-2 px-3">Package</th>
                    <th className="py-2 px-3">Retail Price</th>
                    <th className="py-2 px-3">Dealer Price ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70">
                  {prices.map((p, idx) => (
                    <tr key={p.package_id}>
                      <td className="py-2 px-3 font-bold text-black dark:text-white">
                        {p.package_name}
                        {p.speed && (
                          <span className="ml-1.5 text-[10px] text-slate-500">({p.speed})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">
                        {currencySymbol} {Math.round(p.retail_price * currencyRate).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          value={p.dealer_price}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setPrices(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, dealer_price: isNaN(val) ? 0 : val } : item
                              )
                            );
                          }}
                          className={`w-28 px-2.5 py-1 rounded-lg border font-bold outline-none ${
                            isDarkMode
                              ? 'bg-[#24262b] border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-black'
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPriceDealer(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pricesSaving || pricesLoading || prices.length === 0}
              onClick={handleSavePrices}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {pricesSaving ? 'Saving...' : 'Save Dealer Prices'}
            </button>
          </div>
        </div>
      </VertixModal>
    </div>
  );
}
