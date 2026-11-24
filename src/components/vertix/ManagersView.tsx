import React, { useState, useMemo } from 'react';
import {
  UserCog,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Phone,
  Shield,
  Ban,
  CheckCircle2,
  Users,
  Wallet,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Manager, useRadiusStore } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixModal, VertixLandscapeCard, ConfirmDeleteModal } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface ManagersViewProps {
  store: ReturnType<typeof useRadiusStore>;
  isDarkMode: boolean;
  currencySymbol: string;
  currencyRate: number;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ManagersView({
  store,
  isDarkMode,
  currencySymbol,
  currencyRate,
  addToast,
}: ManagersViewProps) {
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetManager, setTargetManager] = useState<Manager | null>(null);

  // Forms
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Manager['role']>('Reseller');
  const [initialBalance, setInitialBalance] = useState('25000');
  const [topupAmount, setTopupAmount] = useState('10000');
  const [topupMethod, setTopupMethod] = useState<'Cash' | 'Bank' | 'Online'>('Cash');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4 Landscape Summary Cards
  const summaryCards = useMemo(() => {
    const total = store.managers.length;
    const active = store.managers.filter(m => m.status === 'Active').length;
    const totalFloatPKR = store.managers.reduce((acc, m) => acc + (m.balance || 0), 0);
    const totalManagedUsers = store.managers.reduce((acc, m) => acc + (m.subscribersCount || 0), 0);

    const convertedFloat = (currencySymbol.includes('Rs') || currencyRate === 1) ? totalFloatPKR : (totalFloatPKR / 280 * currencyRate);
    const formattedFloat = `${currencySymbol}${convertedFloat.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;

    return {
      total,
      active,
      floatVal: formattedFloat,
      floatRawPKR: totalFloatPKR,
      managedUsers: totalManagedUsers,
    };
  }, [store.managers, currencySymbol, currencyRate]);

  // Format Balance Helper
  const formatBalance = (valPKR: number) => {
    const converted = (currencySymbol.includes('Rs') || currencyRate === 1) ? valPKR : (valPKR / 280) * currencyRate;
    return `${currencySymbol}${converted.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  // Open Edit
  const openEdit = (mgr: Manager) => {
    setTargetManager(mgr);
    setName(mgr.name);
    setPhone(mgr.phone);
    setRole(mgr.role);
    setFormError('');
    setShowEditModal(true);
  };

  // Open Topup
  const openTopup = (mgr: Manager) => {
    setTargetManager(mgr);
    setTopupAmount('15000');
    setTopupMethod('Cash');
    setShowTopupModal(true);
  };

  // Open Delete
  const openDelete = (mgr: Manager) => {
    setTargetManager(mgr);
    setShowDeleteModal(true);
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim() || !username.trim() || !phone.trim()) {
      setFormError('Please fill all required fields.');
      return;
    }

    const exists = store.managers.some(m => m.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      setFormError(`Username "${username}" already exists.`);
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.addManager({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        balance: Number(initialBalance) || 0,
        subscribersCount: 0,
        status: 'Active',
      });

      addToast(`Manager/Dealer "${name.trim()}" added!`, 'success');
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetManager || isSubmitting) return;

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.updateManager(targetManager.id, {
        name: name.trim(),
        phone: phone.trim(),
        role,
      });

      addToast(`Updated manager "${name.trim()}"`, 'success');
      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Top-up
  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetManager || isSubmitting) return;
    const amt = Number(topupAmount) || 0;
    setIsSubmitting(true);
    try {
      await store.addManagerBalance(targetManager.id, amt, topupMethod);
      addToast(`Added +Rs. ${amt.toLocaleString()} float to ${targetManager.name}!`, 'success');
      setShowTopupModal(false);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const toggleStatus = async (mgr: Manager) => {
    const nextStatus = mgr.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await store.updateManager(mgr.id, { status: nextStatus });
      addToast(`Manager "${mgr.name}" is now ${nextStatus}`, nextStatus === 'Active' ? 'success' : 'info');
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!targetManager || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await store.deleteManager(targetManager.id);
      addToast(`Deleted manager "${targetManager.name}"`, 'info');
      setShowDeleteModal(false);
      setTargetManager(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPhone('');
    setRole('Reseller');
    setInitialBalance('25000');
    setFormError('');
    setTargetManager(null);
  };

  if (store.isLoading && store.managers.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-stretch">
        <VertixLandscapeCard
          title="Total Managers"
          value={summaryCards.total}
          badge="Dealers"
          badgeColor="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={UserCog}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Active Resellers"
          value={summaryCards.active}
          badge="Authorized"
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={CheckCircle2}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Total Dealer Float"
          value={summaryCards.floatVal}
          badge={`Rs. ${summaryCards.floatRawPKR.toLocaleString()}`}
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Wallet}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Managed Subscribers"
          value={summaryCards.managedUsers}
          badge="Network Sub-base"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Users}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* MANAGERS TABLE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <UserCog className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>Managers & Reseller Dealers</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Sub-dealer credit floats, subscriber quotas, and permission tiering
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manager</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-[#2d3648]">
                <th className="py-3 px-3 sm:px-4">Manager / Dealer</th>
                <th className="py-3 px-3 sm:px-4">Role</th>
                <th className="py-3 px-3 sm:px-4">Contact Phone</th>
                <th className="py-3 px-3 sm:px-4">Managed Users</th>
                <th className="py-3 px-3 sm:px-4">Credit Float Balance</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
              {store.managers.map(mgr => (
                <tr
                  key={mgr.id}
                  className="hover:bg-emerald-50/40 dark:hover:bg-[#1c2330] transition-colors"
                >
                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] flex items-center justify-center font-bold text-xs text-slate-900 dark:text-slate-100 shrink-0">
                        {mgr.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-extrabold text-black dark:text-white block">
                          {mgr.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
                          @{mgr.username}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                        mgr.role === 'SuperAdmin'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                          : mgr.role === 'Admin'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                          : mgr.role === 'Reseller'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                          : 'bg-slate-100 dark:bg-[#10141b] text-slate-900 dark:text-slate-100 border-slate-300 dark:border-[#333d52]'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {mgr.role}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      {mgr.phone}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] text-slate-900 dark:text-slate-100">
                      {mgr.subscribersCount} subscribers
                    </span>
                  </td>

                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                        {formatBalance(mgr.balance)}
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                        Rs. {mgr.balance.toLocaleString()}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleStatus(mgr)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border transition-all cursor-pointer ${
                        mgr.status === 'Active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-200 dark:bg-[#10141b] text-slate-900 dark:text-slate-300 border-slate-300 dark:border-[#333d52]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          mgr.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{mgr.status}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openTopup(mgr)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Top up dealer float"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Add Float</span>
                      </button>
                      <button
                        onClick={() => openEdit(mgr)}
                        className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c2330] transition-colors cursor-pointer"
                        title="Edit Manager"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDelete(mgr)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Manager"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MANAGER MODAL */}
      <VertixModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register Manager / Dealer"
        subtitle="Provision a dealer account with initial credit float"
        icon={Plus}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleAddSubmit} className="space-y-3">
          {formError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 p-2 rounded-xl">
              {formError}
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Asad Ullah"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Username *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. asad_dealer"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Phone Number *
              </label>
              <input
                type="text"
                required
                placeholder="0300-1234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Role Tier
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Reseller">Reseller Dealer</option>
                <option value="Admin">Admin</option>
                <option value="Support">Support Desk</option>
                <option value="SuperAdmin">SuperAdmin</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Initial Float (PKR)
              </label>
              <input
                type="number"
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-black ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#14532d] hover:bg-[#0b3d2e] text-white font-bold text-xs shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* TOP-UP DEALER BALANCE MODAL */}
      <VertixModal
        isOpen={showTopupModal && !!targetManager}
        onClose={() => setShowTopupModal(false)}
        title="Add Dealer Balance"
        subtitle={`Deposit credit float to ${targetManager?.name}`}
        icon={DollarSign}
        iconColor="text-emerald-600 bg-emerald-100 dark:bg-emerald-950"
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleTopupSubmit} className="space-y-3">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-xs">
            <p className="text-slate-800 dark:text-slate-100">
              Current Float Balance:{' '}
              <span className="font-black text-emerald-700 dark:text-emerald-300">
                Rs. {targetManager?.balance.toLocaleString()}
              </span>
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Top-up Amount (PKR) *
            </label>
            <input
              type="number"
              required
              value={topupAmount}
              onChange={e => setTopupAmount(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-black text-emerald-700 dark:text-emerald-300 ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52]' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Payment Method *
            </label>
            <select
              value={topupMethod}
              onChange={e => setTopupMethod(e.target.value as any)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            >
              <option value="Cash">Cash (Counter)</option>
              <option value="Bank">Bank Deposit</option>
              <option value="Online">Online Transfer</option>
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowTopupModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Top-up'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* EDIT MODAL */}
      <VertixModal
        isOpen={showEditModal && !!targetManager}
        onClose={() => setShowEditModal(false)}
        title="Edit Manager"
        subtitle={`Updating ${targetManager?.name}`}
        icon={Edit}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Role Tier
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Reseller">Reseller</option>
                <option value="Admin">Admin</option>
                <option value="Support">Support</option>
                <option value="SuperAdmin">SuperAdmin</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal && !!targetManager}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Manager"
        message={`Are you sure you want to remove dealer "${targetManager?.name}"?`}
        subMessage="Subscribers managed by this dealer will need reassignment."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
