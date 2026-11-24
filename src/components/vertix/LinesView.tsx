import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Edit3,
  Power,
  CheckCircle2,
  XCircle,
  ArrowRightCircle,
  Users,
  Building2,
  Layers,
  AlertCircle,
  Sparkles,
  Globe,
} from 'lucide-react';
import {
  radiusApi,
  LINE_CODE_REGEX,
  normalizeLineCode,
  type RadiusLine,
  type MainUserCandidate,
} from './radiusApi';
import { VertixModal, VertixLandscapeCard } from './ui';
import { SkTable, SkVertixLandscapeTile } from '../skeleton/Skeleton';
import type { UserProfile } from '../../types';

interface LinesViewProps {
  store: any;
  mainUsers?: UserProfile[];
  isDarkMode?: boolean;
  currencySymbol?: string;
  currencyRate?: number;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function LinesView({
  store,
  mainUsers = [],
  isDarkMode = false,
  currencySymbol = 'Rs.',
  currencyRate = 1,
  addToast,
}: LinesViewProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLine, setEditingLine] = useState<RadiusLine | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [ownerUid, setOwnerUid] = useState('');
  const [status, setStatus] = useState<'Active' | 'Disabled'>('Active');

  const lines: RadiusLine[] = store.lines || [];
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

  const suggestLineCodeFromName = (rawName: string) => {
    const words = rawName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    let base = '';
    if (words.length >= 2) {
      base = words.map(w => w[0]).join('').slice(0, 4);
    } else if (words.length === 1) {
      base = words[0].slice(0, 4);
    } else {
      base = 'GTS';
    }
    while (base.length < 3) base += 'X';
    let idx = 1;
    let candidate = normalizeLineCode(`${base}0${idx}`);
    const existingCodes = new Set(lines.map(l => l.line_code.toUpperCase()));
    while (existingCodes.has(candidate) && idx < 99) {
      idx++;
      candidate = normalizeLineCode(`${base}${String(idx).padStart(2, '0')}`);
    }
    return candidate;
  };

  const openCreateModal = () => {
    setEditingLine(null);
    setName('');
    setLineCode('');
    setOwnerUid(candidateUsers[0]?.uid || '');
    setStatus('Active');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (line: RadiusLine) => {
    setEditingLine(line);
    setName(line.name);
    setLineCode(line.line_code);
    setOwnerUid(line.owner_uid);
    setStatus(line.status);
    setFormError('');
    setShowModal(true);
  };

  const normalizedCode = normalizeLineCode(lineCode);
  const isCodeFormatValid = LINE_CODE_REGEX.test(normalizedCode);
  const isCodeUnique = useMemo(() => {
    if (!normalizedCode) return true;
    return !lines.some(
      l => l.line_code.toUpperCase() === normalizedCode && (!editingLine || l.id !== editingLine.id)
    );
  }, [lines, normalizedCode, editingLine]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Line name is required.');
      return;
    }
    if (!isCodeFormatValid) {
      setFormError('Line code must be 4–8 uppercase alphanumeric characters (A-Z, 0-9).');
      return;
    }
    if (!isCodeUnique) {
      setFormError(`Line code "${normalizedCode}" is already taken.`);
      return;
    }
    if (!ownerUid) {
      setFormError('Please pick an Owner from existing main users.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingLine) {
        await radiusApi.lines.update(editingLine.id, {
          name: name.trim(),
          line_code: normalizedCode,
          owner_uid: ownerUid,
          status,
        });
        addToast?.(`Line ${normalizedCode} updated`, 'success');
      } else {
        await radiusApi.lines.create({
          name: name.trim(),
          line_code: normalizedCode,
          owner_uid: ownerUid,
        });
        addToast?.(`Line ${normalizedCode} created and Owner assigned`, 'success');
      }
      setShowModal(false);
      await store.refreshAll(true);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save line';
      setFormError(msg);
      addToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (line: RadiusLine) => {
    const nextStatus = line.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await radiusApi.lines.update(line.id, { status: nextStatus });
      addToast?.(`Line ${line.line_code} is now ${nextStatus}`, 'success');
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to update line status', 'error');
    }
  };

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      l =>
        l.line_code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        (l.owner_username || '').toLowerCase().includes(q) ||
        (l.owner_name || '').toLowerCase().includes(q)
    );
  }, [lines, search]);

  const overview = useMemo(() => {
    const totalLines = lines.length;
    const activeLines = lines.filter(l => l.status === 'Active').length;
    const totalDealers = lines.reduce((sum, l) => sum + Number(l.dealers_count || 0), 0);
    const totalUsers = lines.reduce((sum, l) => sum + Number(l.users_count || 0), 0);
    const totalRevenue = lines.reduce((sum, l) => sum + Number(l.revenue_today || 0), 0);
    return { totalLines, activeLines, totalDealers, totalUsers, totalRevenue };
  }, [lines]);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-black text-black dark:text-white">
              Lines & Multi-Tenant Overview
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {store.activeLineId ? 'Line Scoped' : 'All Lines'}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Create operator lines, assign Owners from main GTS accounts, or switch active line scope.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {store.activeLineId && (
            <button
              type="button"
              onClick={() => store.setActiveLineId(null)}
              className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100"
            >
              <Globe className="w-3.5 h-3.5" />
              All Lines Overview
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Line
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {store.isLoading && lines.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
          <SkVertixLandscapeTile />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <VertixLandscapeCard
            title="Total Lines"
            value={overview.totalLines}
            badge={`${overview.activeLines} Active`}
            badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
            icon={GitBranch}
            iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            isDarkMode={isDarkMode}
          />
          <VertixLandscapeCard
            title="Total Dealers"
            value={overview.totalDealers}
            icon={Building2}
            iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            isDarkMode={isDarkMode}
          />
          <VertixLandscapeCard
            title="Total Subscribers"
            value={overview.totalUsers}
            icon={Users}
            iconBgGradient="bg-gradient-to-br from-violet-500 to-purple-600"
            isDarkMode={isDarkMode}
          />
          {canViewRevenue ? (
            <VertixLandscapeCard
              title="Today Revenue (All Lines)"
              value={`${currencySymbol} ${Math.round(overview.totalRevenue * currencyRate).toLocaleString()}`}
              icon={Layers}
              iconBgGradient="bg-gradient-to-br from-amber-500 to-orange-600"
              isDarkMode={isDarkMode}
            />
          ) : (
            <VertixLandscapeCard
              title="Active Scope"
              value={store.activeLineId ? (lines.find(l => l.id === store.activeLineId)?.line_code || 'Line') : 'ALL'}
              icon={Globe}
              iconBgGradient="bg-gradient-to-br from-slate-600 to-slate-800"
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      )}

      {/* Search & Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-black dark:text-white">
            Registered Lines ({filteredLines.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, name or owner..."
            className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-medium outline-none ${
              isDarkMode
                ? 'bg-[#24262b] border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-400'
            }`}
          />
        </div>

        {store.isLoading && lines.length === 0 ? (
          <div className="p-4">
            <SkTable variant="flat" rows={4} cols={6} />
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <GitBranch className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-black text-black dark:text-white">No lines found</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Create your first operator line to assign an Owner and isolate subscribers, dealers, and VLANs.
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
                  <th className="py-2.5 px-4">Line Code</th>
                  <th className="py-2.5 px-4">Line Name</th>
                  <th className="py-2.5 px-4">Owner</th>
                  <th className="py-2.5 px-4">Dealers / Users</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs">
                {filteredLines.map(line => {
                  const isSelected = store.activeLineId === line.id;
                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-emerald-950/25'
                            : 'bg-emerald-50/70'
                          : isDarkMode
                          ? 'hover:bg-[#24262b]/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-black">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-emerald-950 dark:text-emerald-300 font-mono text-xs tracking-wider">
                          {line.line_code}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-black dark:text-white">
                        {line.name}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        <div>{line.owner_name || line.owner_username || line.owner_uid}</div>
                        {line.owner_username && (
                          <div className="text-[10px] text-slate-500">@{line.owner_username}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {line.dealers_count ?? 0} dealers · {line.users_count ?? 0} users
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            line.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {line.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => store.setActiveLineId(isSelected ? null : line.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : isDarkMode
                                ? 'bg-[#24262b] border-slate-700 text-emerald-400 hover:border-emerald-500'
                                : 'bg-white border-slate-300 text-emerald-700 hover:border-emerald-500'
                            }`}
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            {isSelected ? 'Active' : 'Enter Line'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(line)}
                            title="Edit line"
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#24262b] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(line)}
                            title={line.status === 'Active' ? 'Disable line' : 'Enable line'}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              line.status === 'Active'
                                ? 'border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40'
                                : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Line Modal */}
      <VertixModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingLine ? `Edit Line ${editingLine.line_code}` : 'Create New Operator Line'}
        subtitle="Upper-case alphanumeric code (4–8 chars), unique across Green Radius"
        icon={GitBranch}
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
              Line Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                const nextName = e.target.value;
                setName(nextName);
                if (!editingLine && !lineCode) {
                  // let user click Suggest or type manually; keep clean
                }
              }}
              placeholder="e.g. Green Telecom Lahore"
              className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                isDarkMode
                  ? 'bg-[#24262b] border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-black'
              }`}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-black text-[11px] text-slate-800 dark:text-slate-200">
                Line Code (4–8 chars, A-Z / 0-9) *
              </label>
              <button
                type="button"
                onClick={() => setLineCode(suggestLineCodeFromName(name || 'GTS'))}
                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Auto-suggest
              </button>
            </div>
            <input
              type="text"
              value={lineCode}
              onChange={e => setLineCode(normalizeLineCode(e.target.value))}
              placeholder="GTS01"
              maxLength={8}
              className={`w-full px-3 py-2 rounded-xl border font-mono font-black uppercase tracking-widest outline-none ${
                isDarkMode
                  ? 'bg-[#24262b] border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-black'
              }`}
              required
            />
            {lineCode && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
                {isCodeFormatValid && isCodeUnique ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Code "{normalizedCode}" is valid & available
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {!isCodeFormatValid
                      ? 'Must be 4–8 uppercase letters/numbers'
                      : `Line code "${normalizedCode}" already exists`}
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
              Line Owner (Main User Account) *
            </label>
            <select
              value={ownerUid}
              onChange={e => setOwnerUid(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                isDarkMode
                  ? 'bg-[#24262b] border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-black'
              }`}
              required
            >
              <option value="">Select a main user...</option>
              {candidateUsers.map(u => (
                <option key={u.uid} value={u.uid}>
                  {u.fullName || u.username} (@{u.username}) {u.role ? `— ${u.role}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
              Assigning an owner automatically grants them Owner radius_access for this line.
            </p>
          </div>

          {editingLine && (
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Disabled')}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode
                    ? 'bg-[#24262b] border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-black'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          )}

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
              disabled={submitting || !isCodeFormatValid || !isCodeUnique}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
            >
              {submitting ? 'Saving...' : editingLine ? 'Save Changes' : 'Create Line'}
            </button>
          </div>
        </form>
      </VertixModal>
    </div>
  );
}
