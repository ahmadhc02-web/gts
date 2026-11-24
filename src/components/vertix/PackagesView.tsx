import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  Zap,
  Gauge
} from 'lucide-react';
import { RadiusPackage, useRadiusStore } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixModal, VertixLandscapeCard, ConfirmDeleteModal } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface PackagesViewProps {
  store: ReturnType<typeof useRadiusStore>;
  isDarkMode: boolean;
  currencySymbol: string;
  currencyRate: number;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PackagesView({
  store,
  isDarkMode,
  currencySymbol,
  currencyRate,
  addToast,
}: PackagesViewProps) {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetPkg, setTargetPkg] = useState<RadiusPackage | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [speed, setSpeed] = useState('');
  const [price, setPrice] = useState('2000');
  const [dataLimit, setDataLimit] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = store.packages.length;
    const active = store.packages.filter(p => p.status === 'Active').length;

    // Monthly revenue potential = sum(pricePerMonth * subscriberCount)
    let potentialPKR = 0;
    let mostPopularPkg: { name: string; count: number } = { name: 'None', count: 0 };

    for (const p of store.packages) {
      const count = store.packageUserCounts[p.name] || 0;
      potentialPKR += p.pricePerMonth * count;
      if (count > mostPopularPkg.count) {
        mostPopularPkg = { name: p.name, count };
      }
    }

    const convertedVal = (currencySymbol.includes('Rs') || currencyRate === 1) ? potentialPKR : (potentialPKR / 280 * currencyRate);
    const potentialFormatted = `${currencySymbol}${convertedVal.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;

    return {
      total,
      active,
      potential: potentialFormatted,
      mostPopular: mostPopularPkg.count > 0 ? `${mostPopularPkg.name} (${mostPopularPkg.count})` : 'None',
    };
  }, [store.packages, store.packageUserCounts, currencySymbol, currencyRate]);

  // Open Edit Modal
  const openEdit = (pkg: RadiusPackage) => {
    setTargetPkg(pkg);
    setName(pkg.name);
    setSpeed(pkg.speed);
    setPrice(String(pkg.pricePerMonth));
    setDataLimit(pkg.dataLimitGB ? String(pkg.dataLimitGB) : '');
    setStatus(pkg.status);
    setFormError('');
    setShowEditModal(true);
  };

  // Open Delete Modal
  const openDelete = (pkg: RadiusPackage) => {
    const count = store.packageUserCounts[pkg.name] || 0;
    if (count > 0) {
      addToast(
        `Cannot delete "${pkg.name}": ${count} active subscriber(s) currently assigned.`,
        'error'
      );
      return;
    }
    setTargetPkg(pkg);
    setShowDeleteModal(true);
  };

  // Submit Add Package
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim() || !speed.trim()) {
      setFormError('Please provide both package name and speed.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.addPackage({
        name: name.trim(),
        speed: speed.trim(),
        pricePerMonth: Number(price) || 1500,
        status,
        dataLimitGB: dataLimit ? Number(dataLimit) : undefined,
      });

      addToast(`Package "${name.trim()}" created successfully!`, 'success');
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Package
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPkg || isSubmitting) return;
    if (!name.trim() || !speed.trim()) {
      setFormError('Please provide both package name and speed.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.updatePackage(targetPkg.id, {
        name: name.trim(),
        speed: speed.trim(),
        pricePerMonth: Number(price) || 1500,
        status,
        dataLimitGB: dataLimit ? Number(dataLimit) : undefined,
      });

      addToast(`Package "${name.trim()}" updated!`, 'success');
      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!targetPkg || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await store.deletePackage(targetPkg.id);
      addToast(`Package "${targetPkg.name}" removed from RADIUS catalog.`, 'info');
      setShowDeleteModal(false);
      setTargetPkg(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active / Inactive
  const togglePackageStatus = async (pkg: RadiusPackage) => {
    const nextStatus = pkg.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await store.updatePackage(pkg.id, { status: nextStatus });
      addToast(
        `Package "${pkg.name}" is now ${nextStatus}`,
        nextStatus === 'Active' ? 'success' : 'info'
      );
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    }
  };

  const resetForm = () => {
    setName('');
    setSpeed('');
    setPrice('2000');
    setDataLimit('');
    setStatus('Active');
    setFormError('');
    setTargetPkg(null);
  };

  if (store.isLoading && store.packages.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-stretch">
        <VertixLandscapeCard
          title="Total Packages"
          value={summaryMetrics.total}
          badge="Catalog"
          badgeColor="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={Layers}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Active Tiers"
          value={summaryMetrics.active}
          badge="Live Mikrotik"
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={CheckCircle2}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Monthly Potential"
          value={summaryMetrics.potential}
          badge="MRR Forecast"
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={TrendingUp}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Most Popular"
          value={summaryMetrics.mostPopular}
          badge="Top Pick"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Award}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* PACKAGES TABLE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <span>Bandwidth Packages & Profiles</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Queue speed profiles, bandwidth bursting, and monthly subscription tiers
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
            <span>Add Package</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-[#2d3648]">
                <th className="py-3 px-3 sm:px-4">Package Name</th>
                <th className="py-3 px-3 sm:px-4">Speed / Rate Limit</th>
                <th className="py-3 px-3 sm:px-4">Monthly Rate</th>
                <th className="py-3 px-3 sm:px-4">Data Cap</th>
                <th className="py-3 px-3 sm:px-4">Subscribers</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
              {store.packages.map(pkg => {
                const subCount = store.packageUserCounts[pkg.name] || 0;
                return (
                  <tr
                    key={pkg.id}
                    className="hover:bg-emerald-50/40 dark:hover:bg-[#1c2330] transition-colors"
                  >
                    <td className="py-3.5 px-3 sm:px-4 font-extrabold text-black dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <span>{pkg.name}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] text-slate-900 dark:text-slate-100 font-mono text-xs font-bold">
                        <Gauge className="w-3.5 h-3.5 text-blue-500" />
                        {pkg.speed}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 font-black text-slate-950 dark:text-white whitespace-nowrap">
                      Rs. {pkg.pricePerMonth.toLocaleString()}
                      <span className="text-[11px] font-normal text-slate-700 dark:text-slate-300 ml-1">/mo</span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      {pkg.dataLimitGB ? `${pkg.dataLimitGB} GB Limit` : 'Unlimited FUP'}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                        {subCount} users
                      </span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <button
                        onClick={() => togglePackageStatus(pkg)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border transition-all cursor-pointer ${
                          pkg.status === 'Active'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                            : 'bg-slate-200 dark:bg-[#10141b] text-slate-900 dark:text-slate-300 border-slate-300 dark:border-[#333d52]'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            pkg.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{pkg.status}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(pkg)}
                          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c2330] transition-colors cursor-pointer"
                          title="Edit Package"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDelete(pkg)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Package"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PACKAGE MODAL */}
      <VertixModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Internet Package"
        subtitle="Create a new bandwidth queue and rate limit tier"
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
              Package Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Turbo 25M"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Speed / Queue *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 25 Mbps"
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Monthly Price (PKR) *
              </label>
              <input
                type="number"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Data Cap (Optional GB)
              </label>
              <input
                type="number"
                placeholder="Leave blank for Unlimited"
                value={dataLimit}
                onChange={e => setDataLimit(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Inactive')}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
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
              {isSubmitting ? 'Creating...' : 'Create Package'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* EDIT PACKAGE MODAL */}
      <VertixModal
        isOpen={showEditModal && !!targetPkg}
        onClose={() => setShowEditModal(false)}
        title="Edit Package"
        subtitle={`Updating ${targetPkg?.name}`}
        icon={Edit}
        iconColor="text-blue-600 bg-blue-100 dark:bg-blue-950"
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3">
          {formError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 p-2 rounded-xl">
              {formError}
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Package Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Speed / Queue *
              </label>
              <input
                type="text"
                required
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Monthly Price (PKR) *
              </label>
              <input
                type="number"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Data Cap (Optional GB)
              </label>
              <input
                type="number"
                placeholder="Leave blank for Unlimited"
                value={dataLimit}
                onChange={e => setDataLimit(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Inactive')}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
        isOpen={showDeleteModal && !!targetPkg}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Package"
        message={`Are you sure you want to delete package "${targetPkg?.name}"?`}
        subMessage="This cannot be undone. Mikrotik queues linked to this package name will need reconfiguration."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
