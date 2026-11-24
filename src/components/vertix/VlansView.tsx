import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit3,
  Trash2,
  Terminal,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  radiusApi,
  validateVlanIdClient,
  type RadiusVlan,
  type RadiusDealer,
} from './radiusApi';
import { VertixModal, ConfirmDeleteModal } from './ui';
import { SkTable } from '../skeleton/Skeleton';

interface VlansViewProps {
  store: any;
  isDarkMode?: boolean;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function VlansView({
  store,
  isDarkMode = false,
  addToast,
}: VlansViewProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVlan, setEditingVlan] = useState<RadiusVlan | null>(null);
  const [deletingVlan, setDeletingVlan] = useState<RadiusVlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [vlanIdInput, setVlanIdInput] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('dealer');
  const [dealerUid, setDealerUid] = useState('');
  const [nasId, setNasId] = useState('');
  const [pppoeService, setPppoeService] = useState('');
  const [ipPool, setIpPool] = useState('');

  // RouterOS modal
  const [scriptModalVlan, setScriptModalVlan] = useState<RadiusVlan | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [scriptNote, setScriptNote] = useState('');
  const [scriptError, setScriptError] = useState('');
  const [copied, setCopied] = useState(false);

  const vlans: RadiusVlan[] = store.vlans || [];
  const dealers: RadiusDealer[] = store.dealers || [];
  const nasList: any[] = store.nasList || [];
  const role = store.authMe?.radiusRole;
  const canManage =
    store.can('vlans.manage') && role !== 'Dealer' && role !== 'DealerStaff';
  const canViewNas = store.can('nas.view') && role !== 'Dealer' && role !== 'DealerStaff' && role !== 'Member';

  const openAddModal = () => {
    setEditingVlan(null);
    setVlanIdInput('');
    setName('');
    setKind('dealer');
    setDealerUid('');
    setNasId('');
    setPppoeService('');
    setIpPool('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (v: RadiusVlan) => {
    setEditingVlan(v);
    setVlanIdInput(String(v.vlan_id));
    setName(v.name);
    setKind(v.kind || 'dealer');
    setDealerUid(v.dealer_uid || '');
    setNasId(v.nas_id || '');
    setPppoeService(v.pppoe_service || '');
    setIpPool(v.ip_pool || '');
    setFormError('');
    setShowModal(true);
  };

  const parsedVlanId = Number(vlanIdInput);
  const clientVlanValidationError = useMemo(() => {
    if (!vlanIdInput.trim()) return null;
    return validateVlanIdClient(parsedVlanId, vlans, editingVlan?.id);
  }, [vlanIdInput, parsedVlanId, vlans, editingVlan]);

  const handleSuggestVlan = async () => {
    try {
      const selectedDealer = dealers.find(d => d.uid === dealerUid);
      const res = await radiusApi.vlans.suggest(selectedDealer?.dealer_no);
      if (res?.suggestedVlanId) {
        setVlanIdInput(String(res.suggestedVlanId));
        if (!name && selectedDealer) {
          setName(`${selectedDealer.company_name} VLAN`);
        }
        addToast?.(`Suggested VLAN ${res.suggestedVlanId}`, 'info');
      }
    } catch (err: any) {
      addToast?.(err?.message || 'Could not fetch VLAN suggestion', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validationErr = validateVlanIdClient(parsedVlanId, vlans, editingVlan?.id);
    if (validationErr) {
      setFormError(validationErr);
      return;
    }
    if (!name.trim()) {
      setFormError('VLAN name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vlan_id: parsedVlanId,
        name: name.trim(),
        kind,
        dealer_uid: dealerUid || null,
        nas_id: nasId || null,
        pppoe_service: pppoeService.trim() || undefined,
        ip_pool: ipPool.trim() || undefined,
      };
      if (editingVlan) {
        await radiusApi.vlans.update(editingVlan.id, payload);
        addToast?.(`VLAN ${parsedVlanId} updated`, 'success');
      } else {
        await radiusApi.vlans.create(payload);
        addToast?.(`VLAN ${parsedVlanId} created`, 'success');
      }
      setShowModal(false);
      await store.refreshAll(true);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save VLAN';
      setFormError(msg);
      addToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVlan) return;
    try {
      await radiusApi.vlans.delete(deletingVlan.id);
      addToast?.(`VLAN ${deletingVlan.vlan_id} deleted`, 'success');
      setDeletingVlan(null);
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to delete VLAN', 'error');
    }
  };

  const openRouterOsModal = async (vlan: RadiusVlan) => {
    setScriptModalVlan(vlan);
    setScriptText('');
    setScriptNote('');
    setScriptError('');
    setCopied(false);
    setScriptLoading(true);
    try {
      const res = await radiusApi.vlans.routerosScript(Number(vlan.vlan_id));
      setScriptText(res?.script || '');
      setScriptNote(res?.note || '');
    } catch (err: any) {
      setScriptError(err?.message || 'Failed to fetch RouterOS commands from server');
    } finally {
      setScriptLoading(false);
    }
  };

  const handleCopyScript = async () => {
    if (!scriptText) return;
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopied(true);
      addToast?.('RouterOS commands copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast?.('Could not access clipboard', 'error');
    }
  };

  const filteredVlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vlans;
    return vlans.filter(
      v =>
        String(v.vlan_id).includes(q) ||
        v.name.toLowerCase().includes(q) ||
        (v.dealer_name || '').toLowerCase().includes(q) ||
        (v.pppoe_service || '').toLowerCase().includes(q)
    );
  }, [vlans, search]);

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
            <Layers className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-black text-black dark:text-white">
              VLAN Registry & Isolation
            </h2>
            {!canManage && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                Read-Only
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            IEEE 802.1Q VLAN isolation per line & dealer (valid range 2–4093; 1 & 4094+ blocked).
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add VLAN
          </button>
        )}
      </div>

      {/* Numbering Legend */}
      <div
        className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center gap-2 text-[11px] ${
          isDarkMode ? 'bg-[#24262b] border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
        }`}
      >
        <span className="font-black uppercase tracking-wider flex items-center gap-1 text-black dark:text-white mr-1">
          <Info className="w-3.5 h-3.5 text-emerald-600" />
          VLAN Numbering Standard:
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
          1 = Unused (Blocked)
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
          10 = Management
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
          100 = Owner Direct
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold">
          Dealer N = 100 + N × 10 (e.g. D1=110, D2=120)
        </span>
      </div>

      {/* Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-black dark:text-white">
            Configured VLANs ({filteredVlans.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search VLAN ID, name, dealer..."
            className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-medium outline-none ${
              isDarkMode
                ? 'bg-[#24262b] border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-400'
            }`}
          />
        </div>

        {store.isLoading && vlans.length === 0 ? (
          <div className="p-4">
            <SkTable variant="flat" rows={4} cols={7} />
          </div>
        ) : filteredVlans.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-black text-black dark:text-white">No VLANs found</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {canManage
                ? 'Add a VLAN (e.g. 100 for Owner Direct or 110 for Dealer 1) to generate MikroTik PPPoE service scripts.'
                : 'No VLANs are assigned to your scope yet.'}
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
                  <th className="py-2.5 px-3">VLAN ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Kind</th>
                  <th className="py-2.5 px-3">Dealer</th>
                  {canViewNas && <th className="py-2.5 px-3">NAS</th>}
                  <th className="py-2.5 px-3">PPPoE Service</th>
                  <th className="py-2.5 px-3">IP Pool</th>
                  <th className="py-2.5 px-3">Users</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs">
                {filteredVlans.map(v => (
                  <tr
                    key={v.id}
                    className={isDarkMode ? 'hover:bg-[#24262b]/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-blue-950 dark:text-blue-300 font-mono font-black">
                        {v.vlan_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-black dark:text-white">{v.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold uppercase text-[10px]">
                        {v.kind}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {v.dealer_name || (v.dealer_no ? `Dealer #${v.dealer_no}` : 'Owner / Direct')}
                    </td>
                    {canViewNas && (
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {v.nas_name || v.nas_id || '—'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {v.pppoe_service || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {v.ip_pool || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-black dark:text-white">
                      {v.users_count ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openRouterOsModal(v)}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-black text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Terminal className="w-3 h-3" />
                          RouterOS
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(v)}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#24262b] cursor-pointer"
                              title="Edit VLAN"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingVlan(v)}
                              className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Delete VLAN"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit VLAN Modal */}
      <VertixModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVlan ? `Edit VLAN ${editingVlan.vlan_id}` : 'Add New VLAN'}
        subtitle="Valid range: 2–4093 (VLAN 1 and 4094+ are strictly rejected)"
        icon={Layers}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-black text-[11px] text-slate-800 dark:text-slate-200">
                  VLAN ID (2–4093) *
                </label>
                <button
                  type="button"
                  onClick={handleSuggestVlan}
                  className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Suggest VLAN
                </button>
              </div>
              <input
                type="number"
                min={2}
                max={4093}
                value={vlanIdInput}
                onChange={e => setVlanIdInput(e.target.value)}
                placeholder="e.g. 110"
                className={`w-full px-3 py-2 rounded-xl border font-mono font-black outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
                required
              />
              {clientVlanValidationError && (
                <p className="mt-1 text-[10px] font-bold text-rose-600">{clientVlanValidationError}</p>
              )}
            </div>

            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Kind *
              </label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              >
                <option value="dealer">Dealer (100 + N×10)</option>
                <option value="direct">Owner Direct (100)</option>
                <option value="management">Management (10)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
              VLAN Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Dealer 1 — Sector A"
              className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Assigned Dealer
              </label>
              <select
                value={dealerUid}
                onChange={e => setDealerUid(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              >
                <option value="">Owner Direct / None</option>
                {dealers.map(d => (
                  <option key={d.uid} value={d.uid}>
                    #{d.dealer_no} {d.company_name}
                  </option>
                ))}
              </select>
            </div>

            {canViewNas && (
              <div>
                <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                  NAS Router
                </label>
                <select
                  value={nasId}
                  onChange={e => setNasId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                    isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                  }`}
                >
                  <option value="">Any / Default NAS</option>
                  {nasList.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.ip})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                PPPoE Service Name
              </label>
              <input
                type="text"
                value={pppoeService}
                onChange={e => setPppoeService(e.target.value)}
                placeholder="e.g. pppoe-vlan110"
                className={`w-full px-3 py-2 rounded-xl border font-mono outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                IP Pool
              </label>
              <input
                type="text"
                value={ipPool}
                onChange={e => setIpPool(e.target.value)}
                placeholder="e.g. pool-vlan110"
                className={`w-full px-3 py-2 rounded-xl border font-mono outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!clientVlanValidationError}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
            >
              {submitting ? 'Saving...' : editingVlan ? 'Save VLAN' : 'Create VLAN'}
            </button>
          </div>
        </form>
      </VertixModal>

      {/* RouterOS Commands Modal */}
      <VertixModal
        isOpen={!!scriptModalVlan}
        onClose={() => setScriptModalVlan(null)}
        title={scriptModalVlan ? `RouterOS Commands — VLAN ${scriptModalVlan.vlan_id}` : 'RouterOS Script'}
        subtitle="Paste these commands into your MikroTik terminal"
        icon={Terminal}
        maxWidth="max-w-xl"
        isDarkMode={isDarkMode}
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black">Switch & OLT Requirement: </span>
              <span>
                {scriptNote ||
                  `VLAN ${scriptModalVlan?.vlan_id} must also be created and tagged on your L2/L3 Switch and OLT uplink/PON ports before PPPoE discovery frames will pass.`}
              </span>
            </div>
          </div>

          {scriptLoading ? (
            <SkTable variant="flat" rows={4} cols={1} />
          ) : scriptError ? (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
              {scriptError}
            </div>
          ) : (
            <div className="relative">
              <pre
                className={`p-3.5 rounded-2xl border font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed ${
                  isDarkMode
                    ? 'bg-[#1b1d21] border-slate-700 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-emerald-300'
                }`}
              >
                {scriptText}
              </pre>
              <button
                type="button"
                onClick={handleCopyScript}
                className="mt-2.5 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied to Clipboard' : 'Copy RouterOS Commands'}
              </button>
            </div>
          )}
        </div>
      </VertixModal>

      <ConfirmDeleteModal
        isOpen={!!deletingVlan}
        onClose={() => setDeletingVlan(null)}
        onConfirm={handleDelete}
        title="Delete VLAN"
        message={`Delete VLAN ${deletingVlan?.vlan_id} (${deletingVlan?.name})?`}
        subMessage="Ensure no active subscribers depend on this VLAN before deleting."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
