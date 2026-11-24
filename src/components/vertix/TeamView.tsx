import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Shield,
  AlertCircle,
  Globe,
} from 'lucide-react';
import {
  radiusApi,
  type RadiusPermissionKey,
  type TeamMemberRecord,
  type MemberScope,
  type MainUserCandidate,
} from './radiusApi';
import { PermissionsEditor } from './PermissionsEditor';
import { VertixModal, ConfirmDeleteModal } from './ui';
import { SkTable } from '../skeleton/Skeleton';
import type { UserProfile } from '../../types';

interface TeamViewProps {
  store: any;
  mainUsers?: UserProfile[];
  isDarkMode?: boolean;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function TeamView({
  store,
  mainUsers = [],
  isDarkMode = false,
  addToast,
}: TeamViewProps) {
  const isDealer = store.authMe?.radiusRole === 'Dealer';
  const title = isDealer ? 'Sub Accounts' : 'Members';
  const subtitle = isDealer
    ? 'Create and manage staff accounts scoped to your dealership'
    : 'Manage line team members with granular permissions and Dealer / VLAN scope';

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberRecord | null>(null);
  const [revokingMember, setRevokingMember] = useState<TeamMemberRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [selectedUid, setSelectedUid] = useState('');
  const [permissions, setPermissions] = useState<RadiusPermissionKey[]>([]);
  const [scope, setScope] = useState<MemberScope>({ all: true, dealerUids: [], vlanIds: [] });
  const [status, setStatus] = useState<'Active' | 'Disabled'>('Active');

  const teamMembers: TeamMemberRecord[] = store.teamMembers || [];
  const actorPermissions: RadiusPermissionKey[] = store.authMe?.permissions || [];
  const actorRole = store.authMe?.radiusRole;

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
    setEditingMember(null);
    setSelectedUid(candidateUsers[0]?.uid || '');
    setPermissions([]);
    setScope({ all: true, dealerUids: [], vlanIds: [] });
    setStatus('Active');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (member: TeamMemberRecord) => {
    setEditingMember(member);
    setSelectedUid(member.uid);
    setPermissions(member.permissions || []);
    setScope(member.scope || { all: true, dealerUids: [], vlanIds: [] });
    setStatus(member.status || 'Active');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editingMember && !selectedUid) {
      setFormError('Please select an existing main user.');
      return;
    }

    setSubmitting(true);
    try {
      if (isDealer) {
        if (editingMember) {
          await radiusApi.staff.update(editingMember.uid, { permissions, status });
          addToast?.(`Sub account ${editingMember.username} updated`, 'success');
        } else {
          await radiusApi.staff.create({ uid: selectedUid, permissions });
          addToast?.('Sub account created', 'success');
        }
      } else {
        if (editingMember) {
          await radiusApi.members.update(editingMember.uid, { permissions, scope, status });
          addToast?.(`Member ${editingMember.username} updated`, 'success');
        } else {
          await radiusApi.members.create({ uid: selectedUid, permissions, scope });
          addToast?.('Line member created', 'success');
        }
      }
      setShowModal(false);
      await store.refreshAll(true);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save team member';
      setFormError(msg);
      addToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingMember) return;
    try {
      if (isDealer) {
        await radiusApi.staff.revoke(revokingMember.uid);
      } else {
        await radiusApi.members.revoke(revokingMember.uid);
      }
      addToast?.(`Access revoked for ${revokingMember.username}`, 'success');
      setRevokingMember(null);
      await store.refreshAll(true);
    } catch (err: any) {
      addToast?.(err?.message || 'Failed to revoke access', 'error');
    }
  };

  const formatScopeLabel = (m: TeamMemberRecord) => {
    if (isDealer) return 'Parent Dealer Scope';
    const sc = m.scope;
    if (!sc) return 'Empty (No data)';
    if (sc.all) return 'All of the line';
    const parts: string[] = [];
    if (sc.dealerUids && sc.dealerUids.length > 0) {
      parts.push(`${sc.dealerUids.length} dealer(s)`);
    }
    if (sc.vlanIds && sc.vlanIds.length > 0) {
      parts.push(`VLAN ${sc.vlanIds.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Empty (No access)';
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter(
      m =>
        m.username.toLowerCase().includes(q) ||
        (m.full_name || '').toLowerCase().includes(q) ||
        m.radius_role.toLowerCase().includes(q)
    );
  }, [teamMembers, search]);

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
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-black text-black dark:text-white">
              {title}
            </h2>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add {isDealer ? 'Sub Account' : 'Member'}
        </button>
      </div>

      {/* Team Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-black text-black dark:text-white">
            {title} ({filteredMembers.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search username or name..."
            className={`w-full sm:w-64 px-3 py-1.5 rounded-xl border text-xs font-medium outline-none ${
              isDarkMode
                ? 'bg-[#24262b] border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-300 text-black placeholder:text-slate-400'
            }`}
          />
        </div>

        {store.isLoading && teamMembers.length === 0 ? (
          <div className="p-4">
            <SkTable variant="flat" rows={4} cols={5} />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Shield className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-black text-black dark:text-white">
              No {title.toLowerCase()} yet
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isDealer
                ? 'Add staff members who can only perform actions you hold permissions for.'
                : 'Add line members with custom permissions and optional Dealer or VLAN restrictions.'}
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
                  <th className="py-2.5 px-4">Account</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Permissions</th>
                  <th className="py-2.5 px-4">Scope</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/70 text-xs">
                {filteredMembers.map(member => (
                  <tr
                    key={member.uid}
                    className={isDarkMode ? 'hover:bg-[#24262b]/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-black dark:text-white">
                        {member.full_name || member.username}
                      </div>
                      <div className="text-[10px] text-slate-500">@{member.username}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-200 font-bold text-[11px]">
                        {member.radius_role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {(member.permissions || []).length} permission(s)
                      </span>
                      <div className="text-[10px] text-slate-500 truncate max-w-[220px]">
                        {(member.permissions || []).slice(0, 3).join(', ')}
                        {(member.permissions || []).length > 3 ? '...' : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-[11px]">
                        <Globe className="w-3 h-3" />
                        {formatScopeLabel(member)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                          member.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-[#24262b] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokingMember(member)}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-[11px] font-bold flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Revoke
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

      {/* Add / Edit Modal */}
      <VertixModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          editingMember
            ? `Edit ${isDealer ? 'Sub Account' : 'Member'}: ${editingMember.username}`
            : `Add ${isDealer ? 'Sub Account' : 'Member'}`
        }
        subtitle="You can only grant permissions you hold yourself"
        icon={Shield}
        maxWidth="max-w-2xl"
        isDarkMode={isDarkMode}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {!editingMember && (
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Select Main User Account *
              </label>
              <select
                value={selectedUid}
                onChange={e => setSelectedUid(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
                required
              >
                <option value="">Choose main user...</option>
                {candidateUsers.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.fullName || u.username} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          {editingMember && (
            <div>
              <label className="block font-black text-[11px] mb-1 text-slate-800 dark:text-slate-200">
                Account Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Disabled')}
                className={`w-full px-3 py-2 rounded-xl border font-semibold outline-none ${
                  isDarkMode ? 'bg-[#24262b] border-slate-700 text-white' : 'bg-white border-slate-300 text-black'
                }`}
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          )}

          <PermissionsEditor
            value={permissions}
            onChange={setPermissions}
            actorPermissions={actorPermissions}
            actorRole={actorRole}
            targetRole={isDealer ? 'DealerStaff' : 'Member'}
            isDarkMode={isDarkMode}
            showScopePicker={!isDealer}
            scope={scope}
            onScopeChange={setScope}
            dealers={store.dealers || []}
            vlans={store.vlans || []}
          />

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
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
            >
              {submitting ? 'Saving...' : editingMember ? 'Save Permissions' : `Create ${isDealer ? 'Sub Account' : 'Member'}`}
            </button>
          </div>
        </form>
      </VertixModal>

      <ConfirmDeleteModal
        isOpen={!!revokingMember}
        onClose={() => setRevokingMember(null)}
        onConfirm={handleRevoke}
        title={`Revoke ${isDealer ? 'Sub Account' : 'Member'} Access`}
        message={`Revoke Green Radius access for "${revokingMember?.username}"?`}
        subMessage="Their main GTS account remains intact, but their Green Radius access row will be removed."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
