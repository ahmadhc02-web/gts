import React, { useState, useMemo } from 'react';
import {
  Router,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Activity,
  CheckCircle2,
  AlertCircle,
  Radio,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
  Terminal,
  Server
} from 'lucide-react';
import { Nas, useRadiusStore } from './radiusStore';
import { formatRadiusError } from './radiusApi';
import { VertixModal, VertixLandscapeCard, ConfirmDeleteModal } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface NasViewProps {
  store: ReturnType<typeof useRadiusStore>;
  isDarkMode: boolean;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function NasView({
  store,
  isDarkMode,
  addToast,
}: NasViewProps) {
  // Reveal state for secrets by NAS ID
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetNas, setTargetNas] = useState<Nas | null>(null);

  // Forms
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [secret, setSecret] = useState('');
  const [type, setType] = useState<Nas['type']>('Mikrotik');
  const [formError, setFormError] = useState('');

  // 4 Landscape Summary Cards
  const summaryCards = useMemo(() => {
    const total = store.nasList.length;
    const online = store.nasList.filter(n => n.status === 'Online').length;
    const totalSessions = store.nasList.reduce((acc, n) => acc + (n.activeSessions || 0), 0);
    const onlineNas = store.nasList.filter(n => n.status === 'Online');
    const avgLatency =
      onlineNas.length > 0
        ? Math.round(onlineNas.reduce((acc, n) => acc + (n.latencyMs || 0), 0) / onlineNas.length)
        : 0;

    return {
      total,
      online: `${online} / ${total}`,
      sessions: totalSessions,
      avgLatency: `${avgLatency} ms`,
    };
  }, [store.nasList]);

  // Toggle Secret Reveal
  const toggleSecret = (id: string) => {
    setRevealedSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy RADIUS Configuration
  const handleCopyRadiusConfig = (nas: Nas) => {
    const configText = `# RADIUS Client Configuration for ${nas.name} (${nas.type})
Server IP: ${store.settings?.radiusServerIp || 'RADIUS_SERVER_IP'}
Auth Port: ${store.settings?.radiusAuthPort || 1812}
Accounting Port: ${store.settings?.radiusAcctPort || 1813}
Secret: ${nas.secret || '(encrypted on server)'}
Timeout: 3000ms
Status: Active`;

    navigator.clipboard.writeText(configText);
    addToast(`Copied RADIUS configuration for ${nas.name}!`, 'info');
  };

  // Open Edit
  const openEdit = (nas: Nas) => {
    setTargetNas(nas);
    setName(nas.name);
    setIp(nas.ip);
    setSecret(nas.secret || '');
    setType(nas.type);
    setFormError('');
    setShowEditModal(true);
  };

  // Open Delete
  const openDelete = (nas: Nas) => {
    setTargetNas(nas);
    setShowDeleteModal(true);
  };

  // Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim() || !ip.trim() || !secret.trim()) {
      setFormError('Please fill all fields.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.addNas({
        name: name.trim(),
        ip: ip.trim(),
        secret: secret.trim(),
        type,
        status: 'Online',
        latencyMs: 0,
        activeSessions: 0,
        lastPing: 'Never',
      });

      addToast(`NAS Router "${name.trim()}" provisioned!`, 'success');
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNas || isSubmitting) return;
    if (!name.trim() || !ip.trim()) {
      setFormError('Router name and IP address are required.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      await store.updateNas(targetNas.id, {
        name: name.trim(),
        ip: ip.trim(),
        ...(secret.trim() ? { secret: secret.trim() } : {}),
        type,
      });

      addToast(`Updated NAS "${name.trim()}"`, 'success');
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
    if (!targetNas || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await store.deleteNas(targetNas.id);
      addToast(`Deleted NAS "${targetNas.name}"`, 'info');
      setShowDeleteModal(false);
      setTargetNas(null);
    } catch (err: any) {
      addToast(formatRadiusError(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setIp('');
    setSecret('');
    setType('Mikrotik');
    setFormError('');
    setTargetNas(null);
  };

  if (store.isLoading && store.nasList.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 content-stretch">
        <VertixLandscapeCard
          title="Total Routers"
          value={summaryCards.total}
          badge="Gateways"
          badgeColor="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800"
          icon={Router}
          iconBgGradient="bg-gradient-to-br from-teal-500 to-cyan-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Routers Online"
          value={summaryCards.online}
          badge="Live Heartbeat"
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={CheckCircle2}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-green-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Connected PPPoE"
          value={summaryCards.sessions}
          badge="Active Tunnels"
          badgeColor="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Radio}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Avg Latency"
          value={summaryCards.avgLatency}
          badge="Healthy ICMP"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Activity}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* NAS TABLE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-[#2d3648] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <Router className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>NAS Routers & Network Access Servers</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Mikrotik RouterOS v6/v7, Cisco, and Ubiquiti EdgeRouter RADIUS authentication & accounting endpoints
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              disabled
              title="Available after the domain/MikroTik step"
              className="px-3 py-2 rounded-full border border-slate-300 dark:border-[#333d52] bg-slate-100 dark:bg-[#10141b] text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center gap-1.5 opacity-60 cursor-not-allowed"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Test Connection</span>
            </button>
            <button
              type="button"
              disabled
              title="Available after the domain/MikroTik step"
              className="px-3 py-2 rounded-full border border-slate-300 dark:border-[#333d52] bg-slate-100 dark:bg-[#10141b] text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center gap-1.5 opacity-60 cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Available after the domain/MikroTik step
            </span>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-4 py-2 rounded-full bg-slate-950 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add NAS Router</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto vertix-scroll-xy w-full min-w-0 mt-3">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-[#2d3648]">
                <th className="py-3 px-3 sm:px-4">Router Name</th>
                <th className="py-3 px-3 sm:px-4">IP Address</th>
                <th className="py-3 px-3 sm:px-4">Shared Secret</th>
                <th className="py-3 px-3 sm:px-4">Hardware Type</th>
                <th className="py-3 px-3 sm:px-4">Status & Latency</th>
                <th className="py-3 px-3 sm:px-4">Active Sessions</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
              {store.nasList.map(nas => {
                const isRevealed = !!revealedSecrets[nas.id];
                const isOnline = nas.status === 'Online';

                return (
                  <tr
                    key={nas.id}
                    className="hover:bg-emerald-50/40 dark:hover:bg-[#1c2330] transition-colors"
                  >
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                          <Router className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-black dark:text-white block">
                            {nas.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
                            {nas.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-slate-100">
                      {nas.ip}
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-900 dark:text-slate-100">
                          {isRevealed ? nas.secret : '••••••••••••'}
                        </span>
                        <button
                          onClick={() => toggleSecret(nas.id)}
                          className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                          title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap font-bold text-xs text-slate-900 dark:text-slate-100">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52]">
                        {nas.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        <span
                          className={`font-extrabold text-xs ${
                            isOnline ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {nas.status} {isOnline && `(${nas.latencyMs}ms)`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                        {nas.activeSessions} sessions
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Disabled Test Connection & Sync buttons */}
                        <button
                          type="button"
                          disabled
                          title="Available after the domain/MikroTik step"
                          className="px-2 py-1 rounded-lg border border-slate-300 dark:border-[#333d52] bg-slate-100 dark:bg-[#10141b] text-slate-500 dark:text-slate-400 text-[11px] font-bold opacity-60 cursor-not-allowed"
                        >
                          Test Connection
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Available after the domain/MikroTik step"
                          className="px-2 py-1 rounded-lg border border-slate-300 dark:border-[#333d52] bg-slate-100 dark:bg-[#10141b] text-slate-500 dark:text-slate-400 text-[11px] font-bold opacity-60 cursor-not-allowed"
                        >
                          Sync
                        </button>

                        {/* Copy RADIUS config */}
                        <button
                          onClick={() => handleCopyRadiusConfig(nas)}
                          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c2330] transition-colors cursor-pointer"
                          title="Copy RADIUS Client Config (IP, Port, Secret)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEdit(nas)}
                          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c2330] transition-colors cursor-pointer"
                          title="Edit Router"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openDelete(nas)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Router"
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

      {/* ADD NAS MODAL */}
      <VertixModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add NAS Router"
        subtitle="Configure a new Mikrotik, Cisco, or Ubiquiti RADIUS client"
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
              Router Identifier / Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Core Mikrotik CCR2004"
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
                IP Address *
              </label>
              <input
                type="text"
                required
                placeholder="10.10.3.1"
                value={ip}
                onChange={e => setIp(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Hardware Vendor
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Mikrotik">Mikrotik RouterOS</option>
                <option value="Cisco">Cisco IOS</option>
                <option value="Ubiquiti">Ubiquiti EdgeRouter</option>
                <option value="Huawei">Huawei NE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Shared RADIUS Secret *
            </label>
            <input
              type="text"
              required
              value={secret}
              onChange={e => setSecret(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            />
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
              className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Provisioning...' : 'Provision Router'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* EDIT NAS MODAL */}
      <VertixModal
        isOpen={showEditModal && !!targetNas}
        onClose={() => setShowEditModal(false)}
        title="Edit NAS Router"
        subtitle={`Updating ${targetNas?.name}`}
        icon={Edit}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Router Name *
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
                IP Address *
              </label>
              <input
                type="text"
                required
                value={ip}
                onChange={e => setIp(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
                Hardware Vendor
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-bold ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                }`}
              >
                <option value="Mikrotik">Mikrotik RouterOS</option>
                <option value="Cisco">Cisco IOS</option>
                <option value="Ubiquiti">Ubiquiti EdgeRouter</option>
                <option value="Huawei">Huawei NE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1 block">
              Shared Secret *
            </label>
            <input
              type="text"
              required
              value={secret}
              onChange={e => setSecret(e.target.value)}
              className={`w-full text-xs px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52] text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
              }`}
            />
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
              className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal && !!targetNas}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete NAS Router"
        message={`Are you sure you want to remove NAS "${targetNas?.name}"?`}
        subMessage="Subscribers authenticating via this router will be rejected until redirected to another gateway."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
