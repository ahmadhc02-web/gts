import React from 'react';
import { ShieldCheck, Lock, Layers, Building2, Globe } from 'lucide-react';
import {
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
  type RadiusPermissionKey,
  type RadiusRole,
  type MemberScope,
  type RadiusDealer,
  type RadiusVlan,
} from './radiusApi';

interface PermissionsEditorProps {
  value: RadiusPermissionKey[];
  onChange: (next: RadiusPermissionKey[]) => void;
  actorPermissions: RadiusPermissionKey[];
  actorRole?: RadiusRole;
  targetRole?: 'DealerStaff' | 'Member';
  isDarkMode?: boolean;
  showScopePicker?: boolean;
  scope?: MemberScope;
  onScopeChange?: (scope: MemberScope) => void;
  dealers?: RadiusDealer[];
  vlans?: RadiusVlan[];
  disabled?: boolean;
}

export function PermissionsEditor({
  value,
  onChange,
  actorPermissions,
  actorRole,
  targetRole = 'Member',
  isDarkMode = false,
  showScopePicker = false,
  scope = { all: true, dealerUids: [], vlanIds: [] },
  onScopeChange,
  dealers = [],
  vlans = [],
  disabled = false,
}: PermissionsEditorProps) {
  const actorHoldsPermission = React.useCallback(
    (key: RadiusPermissionKey) => {
      // NAS permissions are strictly disallowed for Dealer, DealerStaff, and Member
      if (
        (key === 'nas.view' || key === 'nas.manage') &&
        (targetRole === 'DealerStaff' || targetRole === 'Member')
      ) {
        return false;
      }
      if (actorRole === 'SuperAdmin') return true;
      return actorPermissions.includes(key);
    },
    [actorPermissions, actorRole, targetRole]
  );

  const togglePermission = (key: RadiusPermissionKey) => {
    if (disabled || !actorHoldsPermission(key)) return;
    if (value.includes(key)) {
      onChange(value.filter(p => p !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const applyPreset = (presetPermissions: RadiusPermissionKey[]) => {
    if (disabled) return;
    const allowed = presetPermissions.filter(p => actorHoldsPermission(p));
    onChange(Array.from(new Set(allowed)));
  };

  const scopeMode: 'all' | 'dealers' | 'vlans' = scope?.all
    ? 'all'
    : (scope?.vlanIds && scope.vlanIds.length > 0 && (!scope?.dealerUids || scope.dealerUids.length === 0))
    ? 'vlans'
    : 'dealers';

  const setScopeMode = (mode: 'all' | 'dealers' | 'vlans') => {
    if (!onScopeChange) return;
    if (mode === 'all') {
      onScopeChange({ all: true, dealerUids: [], vlanIds: [] });
    } else if (mode === 'dealers') {
      onScopeChange({ all: false, dealerUids: scope?.dealerUids || [], vlanIds: scope?.vlanIds || [] });
    } else {
      onScopeChange({ all: false, dealerUids: scope?.dealerUids || [], vlanIds: scope?.vlanIds || [] });
    }
  };

  const toggleScopeDealer = (uid: string) => {
    if (!onScopeChange) return;
    const current = scope?.dealerUids || [];
    const next = current.includes(uid) ? current.filter(d => d !== uid) : [...current, uid];
    onScopeChange({ all: false, dealerUids: next, vlanIds: scope?.vlanIds || [] });
  };

  const toggleScopeVlan = (vlanId: number) => {
    if (!onScopeChange) return;
    const current = scope?.vlanIds || [];
    const next = current.includes(vlanId) ? current.filter(v => v !== vlanId) : [...current, vlanId];
    onScopeChange({ all: false, dealerUids: scope?.dealerUids || [], vlanIds: next });
  };

  return (
    <div className="space-y-4">
      {/* Presets Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Quick Role Presets
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const allAllowed = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key)).filter(actorHoldsPermission);
                onChange(allAllowed);
              }}
              className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-40"
            >
              Select Allowed
            </button>
            <span className="text-slate-400">·</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([])}
              className="text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PERMISSION_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset.permissions)}
              title={preset.description}
              className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 ${
                isDarkMode
                  ? 'bg-[#24262b] border-slate-700 hover:border-emerald-500/60 text-white'
                  : 'bg-slate-50 border-slate-300 hover:border-emerald-500 text-black'
              }`}
            >
              <div className="text-xs font-black">{preset.label}</div>
              <div className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Permission Checkboxes */}
      <div className="space-y-3">
        {PERMISSION_GROUPS.map(group => (
          <div
            key={group.id}
            className={`rounded-2xl border p-3 ${
              isDarkMode ? 'bg-[#24262b] border-slate-700' : 'bg-slate-50/70 border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700/70">
              <span className="text-xs font-black uppercase tracking-wider text-black dark:text-white">
                {group.label}
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {group.items.filter(i => value.includes(i.key)).length}/{group.items.length} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map(item => {
                const isNasRestricted =
                  (item.key === 'nas.view' || item.key === 'nas.manage') &&
                  (targetRole === 'DealerStaff' || targetRole === 'Member');
                const held = actorHoldsPermission(item.key);
                const checked = held && value.includes(item.key);
                const tooltipText = isNasRestricted
                  ? `NAS access is restricted to Owner & SuperAdmin (never ${targetRole})`
                  : !held
                  ? 'You cannot grant a permission you do not hold yourself'
                  : item.description;

                return (
                  <label
                    key={item.key}
                    title={tooltipText}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs transition-all ${
                      !held || disabled
                        ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-200/40 dark:bg-slate-800/40'
                        : checked
                        ? isDarkMode
                          ? 'bg-emerald-950/40 border-emerald-500/60 cursor-pointer'
                          : 'bg-emerald-50 border-emerald-500 cursor-pointer'
                        : isDarkMode
                        ? 'bg-[#2b2d33] border-slate-700 hover:border-slate-500 cursor-pointer'
                        : 'bg-white border-slate-300 hover:border-slate-500 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!held || disabled}
                      onChange={() => togglePermission(item.key)}
                      className="mt-0.5 w-3.5 h-3.5 accent-emerald-600 rounded shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-black dark:text-white leading-tight">
                        <span className="truncate">{item.label}</span>
                        {!held && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                        {isNasRestricted ? 'Blocked for Dealers & Members' : item.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Member Scope Picker (Owner Members only) */}
      {showScopePicker && onScopeChange && (
        <div
          className={`rounded-2xl border p-3.5 space-y-3 ${
            isDarkMode ? 'bg-[#24262b] border-slate-700' : 'bg-slate-50 border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                Member Visibility Scope
              </h4>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                Restrict this member to specific dealers or VLANs, or grant full line visibility.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setScopeMode('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                  scope?.all
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isDarkMode
                    ? 'bg-[#2b2d33] border-slate-700 text-slate-300'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                All of the line
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setScopeMode('dealers')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                  !scope?.all && scopeMode === 'dealers'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isDarkMode
                    ? 'bg-[#2b2d33] border-slate-700 text-slate-300'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                Specific Dealers
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setScopeMode('vlans')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                  !scope?.all && scopeMode === 'vlans'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isDarkMode
                    ? 'bg-[#2b2d33] border-slate-700 text-slate-300'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                Specific VLANs
              </button>
            </div>
          </div>

          {!scope?.all && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Dealers multi-select */}
              <div
                className={`rounded-xl border p-2.5 ${
                  isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <div className="text-[11px] font-black text-black dark:text-white flex items-center gap-1.5 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  Dealers ({(scope?.dealerUids || []).length} selected)
                </div>
                {dealers.length === 0 ? (
                  <p className="text-[10px] text-slate-500">No dealers in this line yet.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {dealers.map(d => {
                      const active = (scope?.dealerUids || []).includes(d.uid);
                      return (
                        <label
                          key={d.uid}
                          className="flex items-center gap-2 text-xs font-medium cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={disabled}
                            onChange={() => toggleScopeDealer(d.uid)}
                            className="w-3.5 h-3.5 accent-emerald-600 rounded"
                          />
                          <span className="truncate text-black dark:text-white">
                            #{d.dealer_no} {d.company_name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* VLANs multi-select */}
              <div
                className={`rounded-xl border p-2.5 ${
                  isDarkMode ? 'bg-[#2b2d33] border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <div className="text-[11px] font-black text-black dark:text-white flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  VLANs ({(scope?.vlanIds || []).length} selected)
                </div>
                {vlans.length === 0 ? (
                  <p className="text-[10px] text-slate-500">No VLANs configured in this line yet.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {vlans.map(v => {
                      const active = (scope?.vlanIds || []).includes(Number(v.vlan_id));
                      return (
                        <label
                          key={v.id}
                          className="flex items-center gap-2 text-xs font-medium cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={disabled}
                            onChange={() => toggleScopeVlan(Number(v.vlan_id))}
                            className="w-3.5 h-3.5 accent-emerald-600 rounded"
                          />
                          <span className="truncate text-black dark:text-white">
                            VLAN {v.vlan_id} — {v.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {!scope?.all && (scope?.dealerUids?.length || 0) === 0 && (scope?.vlanIds?.length || 0) === 0 && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Warning: Empty scope means this member will see zero subscribers until at least one dealer or VLAN is selected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
