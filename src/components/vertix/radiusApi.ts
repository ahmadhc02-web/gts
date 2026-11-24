/// <reference types="vite/client" />
import { safeLocalStorage } from '../../lib/safeLocalStorage';

export type RadiusRole = 'SuperAdmin' | 'Owner' | 'Dealer' | 'DealerStaff' | 'Member';

export type RadiusPermissionKey =
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'users.renew'
  | 'users.toggle'
  | 'users.disconnect'
  | 'users.viewPassword'
  | 'online.view'
  | 'packages.view'
  | 'packages.manage'
  | 'vouchers.view'
  | 'vouchers.manage'
  | 'payments.view'
  | 'payments.create'
  | 'revenue.view'
  | 'dealers.manage'
  | 'members.manage'
  | 'nas.view'
  | 'nas.manage'
  | 'vlans.view'
  | 'vlans.manage'
  | 'reports.view'
  | 'logs.view'
  | 'sms.send'
  | 'settings.manage';

export interface PermissionItemDef {
  key: RadiusPermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroupDef {
  id: 'Users' | 'Billing' | 'Network' | 'Reports' | 'Messages';
  label: string;
  items: PermissionItemDef[];
}

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    id: 'Users',
    label: 'Users',
    items: [
      { key: 'users.view', label: 'View Users', description: 'Browse subscriber list and account details' },
      { key: 'users.create', label: 'Create Users', description: 'Register new PPPoE / RADIUS subscribers' },
      { key: 'users.edit', label: 'Edit Users', description: 'Modify subscriber profile & package' },
      { key: 'users.delete', label: 'Delete Users', description: 'Remove subscriber accounts' },
      { key: 'users.renew', label: 'Renew / Recharge', description: 'Activate and extend subscriber expiration' },
      { key: 'users.toggle', label: 'Enable / Disable', description: 'Toggle subscriber active/disabled state' },
      { key: 'users.disconnect', label: 'Disconnect Session', description: 'Send CoA/PoD disconnect to live sessions' },
      { key: 'users.viewPassword', label: 'View Passwords', description: 'Reveal subscriber PPPoE password column' },
      { key: 'online.view', label: 'Online Sessions', description: 'View active live sessions & traffic' },
    ],
  },
  {
    id: 'Billing',
    label: 'Billing',
    items: [
      { key: 'packages.view', label: 'View Packages', description: 'Browse internet speed packages' },
      { key: 'packages.manage', label: 'Manage Packages', description: 'Create, edit & delete speed packages' },
      { key: 'vouchers.view', label: 'View Vouchers', description: 'View prepaid voucher batches' },
      { key: 'vouchers.manage', label: 'Manage Vouchers', description: 'Generate, redeem & delete vouchers' },
      { key: 'payments.view', label: 'View Payments', description: 'Browse payment & ledger history' },
      { key: 'payments.create', label: 'Record Payments', description: 'Log manual cash/online collections' },
      { key: 'revenue.view', label: 'View Revenue & Prices', description: 'See total balance, revenue cards & package prices' },
      { key: 'dealers.manage', label: 'Manage Dealers', description: 'Add dealers, wallet top-ups & dealer prices' },
      { key: 'members.manage', label: 'Manage Team', description: 'Assign sub-accounts or line members' },
    ],
  },
  {
    id: 'Network',
    label: 'Network',
    items: [
      { key: 'nas.view', label: 'View NAS Routers', description: 'View RouterOS NAS list (Owner/SuperAdmin only)' },
      { key: 'nas.manage', label: 'Manage NAS Routers', description: 'Add, edit, delete & ping NAS routers' },
      { key: 'vlans.view', label: 'View VLANs', description: 'Browse VLAN assignments & RouterOS scripts' },
      { key: 'vlans.manage', label: 'Manage VLANs', description: 'Create, edit & remove line VLANs' },
    ],
  },
  {
    id: 'Reports',
    label: 'Reports',
    items: [
      { key: 'reports.view', label: 'View Reports', description: 'Access analytics & CSV reports' },
      { key: 'logs.view', label: 'View Logs', description: 'Access RADIUS auth & audit trails' },
      { key: 'settings.manage', label: 'Engine Settings', description: 'Modify RADIUS server configuration' },
    ],
  },
  {
    id: 'Messages',
    label: 'Messages',
    items: [
      { key: 'sms.send', label: 'Send WhatsApp & SMS', description: 'Dispatch billing & expiry notifications' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: RadiusPermissionKey[] = PERMISSION_GROUPS.flatMap(g =>
  g.items.map(i => i.key)
);

export interface PermissionPresetDef {
  id: 'Collector' | 'Technician' | 'Support' | 'Viewer';
  label: string;
  description: string;
  permissions: RadiusPermissionKey[];
}

export const PERMISSION_PRESETS: PermissionPresetDef[] = [
  {
    id: 'Collector',
    label: 'Collector',
    description: 'Renewals, payments, vouchers & balances',
    permissions: [
      'users.view',
      'users.renew',
      'payments.view',
      'payments.create',
      'vouchers.view',
      'vouchers.manage',
      'revenue.view',
    ],
  },
  {
    id: 'Technician',
    label: 'Technician',
    description: 'Online sessions, disconnects, VLANs & logs',
    permissions: [
      'users.view',
      'users.toggle',
      'users.disconnect',
      'online.view',
      'nas.view',
      'vlans.view',
      'logs.view',
    ],
  },
  {
    id: 'Support',
    label: 'Support',
    description: 'Customer onboarding, renewals & messaging',
    permissions: [
      'users.view',
      'users.create',
      'users.edit',
      'users.renew',
      'users.toggle',
      'users.disconnect',
      'online.view',
      'packages.view',
      'vouchers.view',
      'sms.send',
      'logs.view',
    ],
  },
  {
    id: 'Viewer',
    label: 'Viewer',
    description: 'Read-only access to users, packages & reports',
    permissions: [
      'users.view',
      'online.view',
      'packages.view',
      'vouchers.view',
      'payments.view',
      'vlans.view',
      'reports.view',
      'logs.view',
    ],
  },
];

export interface MemberScope {
  all?: boolean;
  dealerUids?: string[];
  vlanIds?: number[];
}

export interface RadiusAuthMe {
  sub: string;
  username: string;
  fullName?: string;
  radiusRole: RadiusRole;
  lineId: string | null;
  lineCode: string | null;
  lineName?: string | null;
  parentUid?: string | null;
  dealerUid?: string | null;
  dealerNo?: number | null;
  companyName?: string | null;
  balance?: number;
  creditLimit?: number;
  permissions: RadiusPermissionKey[];
  scope?: MemberScope | null;
  status?: 'Active' | 'Disabled' | string;
}

export interface MainUserCandidate {
  uid: string;
  username: string;
  fullName?: string;
  role?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  status?: string;
}

export interface RadiusLine {
  id: string;
  line_code: string;
  name: string;
  owner_uid: string;
  owner_username?: string;
  owner_name?: string;
  status: 'Active' | 'Disabled';
  dealers_count?: number;
  users_count?: number;
  online_count?: number;
  revenue_today?: number;
  created_at?: string;
}

export interface RadiusDealer {
  uid: string;
  username?: string;
  full_name?: string;
  dealer_no: number;
  company_name: string;
  phone: string;
  vlan_id?: number | null;
  main_vlan_id?: number | null;
  wallet_balance: number;
  credit_limit: number;
  commission_pct: number;
  subscribers_count: number;
  status: 'Active' | 'Disabled';
  line_id?: string;
  created_at?: string;
}

export interface WalletLedgerEntry {
  id: string;
  dealer_uid: string;
  amount: number;
  balance_after: number;
  type: 'topup' | 'debit' | 'refund' | 'adjustment' | string;
  method?: string;
  reference?: string;
  note?: string;
  created_by?: string;
  created_at: string;
}

export interface DealerPackagePrice {
  package_id: string;
  package_name: string;
  speed?: string;
  retail_price: number;
  dealer_price: number;
}

export interface TeamMemberRecord {
  uid: string;
  username: string;
  full_name?: string;
  radius_role: 'DealerStaff' | 'Member';
  parent_uid?: string;
  dealer_uid?: string;
  permissions: RadiusPermissionKey[];
  scope?: MemberScope | null;
  status: 'Active' | 'Disabled';
  created_at?: string;
}

export interface RadiusVlan {
  id: string;
  vlan_id: number;
  name: string;
  kind: 'unused' | 'management' | 'direct' | 'dealer' | string;
  line_id?: string;
  dealer_uid?: string | null;
  dealer_name?: string | null;
  dealer_no?: number | null;
  nas_id?: string | null;
  nas_name?: string | null;
  pppoe_service?: string;
  ip_pool?: string;
  users_count?: number;
  notes?: string;
}

export interface VlanSuggestResponse {
  suggestedVlanId: number;
  dealerNo?: number | null;
  rule?: string;
}

export interface RouterOsScriptResponse {
  vlanId: number;
  script: string;
  note?: string;
}

export type RadiusErrorKind = 'unreachable' | 'unauthorized' | 'forbidden' | 'validation' | 'server';

export class RadiusApiError extends Error {
  status: number;
  data: any;
  kind: RadiusErrorKind;
  constructor(message: string, status: number, data?: any, kind?: RadiusErrorKind) {
    super(message);
    this.name = 'RadiusApiError';
    this.status = status;
    this.data = data;
    this.kind =
      kind ||
      (status === 0 || status === 404 || status === 502 || status === 503 || status === 504
        ? 'unreachable'
        : status === 401
        ? 'unauthorized'
        : status === 403
        ? 'forbidden'
        : status === 400 || status === 409 || status === 422
        ? 'validation'
        : 'server');
  }

  get isUnreachable(): boolean {
    return this.kind === 'unreachable';
  }
  get isUnauthorized(): boolean {
    return this.kind === 'unauthorized';
  }
  get isForbidden(): boolean {
    return this.kind === 'forbidden';
  }
  get isValidation(): boolean {
    return this.kind === 'validation';
  }
}

export function formatRadiusError(err: any): string {
  if (err instanceof RadiusApiError) {
    if (err.kind === 'unreachable') {
      return `Radius service is not reachable (${err.message})`;
    }
    if (err.kind === 'unauthorized') {
      return err.message || 'Session expired. Please verify your password.';
    }
    if (err.kind === 'forbidden') {
      return err.message || 'No Green Radius access for this account.';
    }
    if (err.kind === 'validation') {
      if (err.data?.fieldErrors && typeof err.data.fieldErrors === 'object') {
        const parts = Object.entries(err.data.fieldErrors).map(([k, v]) => `${k}: ${v}`);
        if (parts.length > 0) return parts.join('; ');
      }
      if (Array.isArray(err.data?.errors) && err.data.errors.length > 0) {
        return err.data.errors.map((e: any) => e?.message || e?.msg || String(e)).join('; ');
      }
      return err.message || 'Validation failed.';
    }
    return err.message || `Server error (${err.status})`;
  }
  return err?.message || 'Unexpected error communicating with Radius service.';
}

export const LINE_CODE_REGEX = /^[A-Z0-9]{4,8}$/;

export function normalizeLineCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function validateVlanIdClient(
  vlanId: number,
  existingVlans: RadiusVlan[],
  excludeId?: string
): string | null {
  if (!Number.isInteger(vlanId)) {
    return 'VLAN ID must be a whole number.';
  }
  if (vlanId === 1) {
    return 'VLAN 1 is reserved (unused default) and cannot be assigned.';
  }
  if (vlanId < 2 || vlanId > 4093) {
    return 'VLAN ID must be between 2 and 4093 (VLANs 1 and 4094+ are rejected).';
  }
  const duplicate = existingVlans.find(
    v => Number(v.vlan_id) === vlanId && (!excludeId || v.id !== excludeId)
  );
  if (duplicate) {
    return `VLAN ${vlanId} (${duplicate.name}) is already used in this line.`;
  }
  return null;
}

export function hasPermission(authMe: RadiusAuthMe | null | undefined, key: RadiusPermissionKey): boolean {
  if (!authMe || authMe.status === 'Disabled') return false;
  if (authMe.radiusRole === 'SuperAdmin') return true;
  // Rule: no NAS anywhere for Dealer, DealerStaff or Member
  if (
    (key === 'nas.view' || key === 'nas.manage') &&
    (authMe.radiusRole === 'Dealer' || authMe.radiusRole === 'DealerStaff' || authMe.radiusRole === 'Member')
  ) {
    return false;
  }
  if (!Array.isArray(authMe.permissions)) return false;
  return authMe.permissions.includes(key);
}

// --- API BASE URL & HEADER MANAGEMENT ---

const envRadiusUrl =
  import.meta.env.VITE_RADIUS_SERVICE_URL || import.meta.env.VITE_RADIUS_API_URL || '';

const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const isEnvInsecureHttp = Boolean(envRadiusUrl && envRadiusUrl.startsWith('http://'));

let resolvedBaseUrl = '/api/radius';
if (envRadiusUrl && !(isPageHttps && isEnvInsecureHttp)) {
  resolvedBaseUrl = envRadiusUrl.replace(/\/+$/, '');
}

const TOKEN_STORAGE_KEY = 'gts_radius_jwt';
const ACTIVE_LINE_STORAGE_KEY = 'gts_radius_active_line_id';

let memoryActiveLineId: string | null = (() => {
  try {
    return safeLocalStorage.getItem(ACTIVE_LINE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
})();

export function getRadiusBaseUrl(): string {
  return resolvedBaseUrl;
}

export function getRadiusToken(): string | null {
  try {
    return (
      safeLocalStorage.getItem(TOKEN_STORAGE_KEY) ||
      safeLocalStorage.getItem('radius_jwt') ||
      safeLocalStorage.getItem('auth_token') ||
      null
    );
  } catch {
    return null;
  }
}

export function setRadiusToken(token: string | null) {
  try {
    if (token) {
      safeLocalStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      safeLocalStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearRadiusSession() {
  try {
    safeLocalStorage.removeItem(TOKEN_STORAGE_KEY);
    safeLocalStorage.removeItem('radius_jwt');
    safeLocalStorage.removeItem('auth_token');
    safeLocalStorage.removeItem(ACTIVE_LINE_STORAGE_KEY);
  } catch {
    // ignore
  }
  memoryActiveLineId = null;
}

export function getActiveLineId(): string | null {
  return memoryActiveLineId;
}

export function setActiveLineIdHeader(lineId: string | null) {
  memoryActiveLineId = lineId && lineId !== 'all' ? lineId : null;
  try {
    if (memoryActiveLineId) {
      safeLocalStorage.setItem(ACTIVE_LINE_STORAGE_KEY, memoryActiveLineId);
    } else {
      safeLocalStorage.removeItem(ACTIVE_LINE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function requestJson<T = any>(
  path: string,
  options: RequestInit & { skipLineHeader?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${resolvedBaseUrl}${cleanPath}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const token = getRadiusToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!options.skipLineHeader && memoryActiveLineId) {
    headers.set('X-Radius-Line', memoryActiveLineId);
  }

  const { skipLineHeader: _skip, timeoutMs, signal: externalSignal, ...fetchOpts } = options;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (controller && timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  if (externalSignal && controller) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOpts,
      headers,
      credentials: 'include',
      signal: controller ? controller.signal : externalSignal,
    });
  } catch (networkErr: any) {
    if (timer) clearTimeout(timer);
    const reason =
      networkErr?.name === 'AbortError'
        ? `Request timed out (${timeoutMs || 3000}ms)`
        : networkErr?.message || 'Network error connecting to Radius service';
    throw new RadiusApiError(reason, 0, null, 'unreachable');
  } finally {
    if (timer) clearTimeout(timer);
  }

  const proxiedStatusRaw = Number(res.headers.get('x-radius-http-status'));
  const effectiveStatus = Number.isFinite(proxiedStatusRaw) && proxiedStatusRaw > 0 ? proxiedStatusRaw : res.status;

  if (effectiveStatus === 401 && !cleanPath.startsWith('/auth/login') && !cleanPath.startsWith('/auth/session')) {
    clearRadiusSession();
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    await res.text().catch(() => '');
    if (effectiveStatus === 401) {
      throw new RadiusApiError('Session expired. Please verify your password.', 401, null, 'unauthorized');
    }
    if (effectiveStatus === 403) {
      throw new RadiusApiError('Access denied by gateway or missing Radius session permissions (HTTP 403).', 403, null, 'forbidden');
    }
    throw new RadiusApiError(
      `Radius endpoint returned HTML instead of JSON (HTTP ${effectiveStatus})`,
      effectiveStatus || 404,
      null,
      'unreachable'
    );
  }

  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    const trimmed = text.trim();
    if (/^<!doctype\s+html|^<html/i.test(trimmed)) {
      if (effectiveStatus === 401) {
        throw new RadiusApiError('Session expired. Please verify your password.', 401, null, 'unauthorized');
      }
      if (effectiveStatus === 403) {
        throw new RadiusApiError('Access denied by gateway or missing Radius session permissions (HTTP 403).', 403, null, 'forbidden');
      }
      throw new RadiusApiError(
        `Radius endpoint returned HTML page instead of JSON (HTTP ${effectiveStatus})`,
        effectiveStatus || 404,
        null,
        'unreachable'
      );
    }
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  }

  if (!res.ok || effectiveStatus >= 400) {
    const errMsg =
      (data && typeof data === 'object' && (data.error || data.message || data.detail)) ||
      (typeof data === 'string' && data.trim()) ||
      `Request failed (${effectiveStatus})`;
    throw new RadiusApiError(errMsg, effectiveStatus, data);
  }

  return data as T;
}

export const radiusApi = {
  auth: {
    me: (opts?: { timeoutMs?: number }) =>
      requestJson<RadiusAuthMe>('/auth/me', opts),
    login: async (username: string, password: string) => {
      const res = await requestJson<{ token: string; user?: RadiusAuthMe }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        skipLineHeader: true,
      });
      if (res?.token) setRadiusToken(res.token);
      return res;
    },
    session: async (payload: { uid: string; password: string }, timeoutMs = 3000) => {
      const res = await requestJson<{ token: string; user?: RadiusAuthMe }>('/auth/session', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipLineHeader: true,
        timeoutMs,
      });
      if (res?.token) setRadiusToken(res.token);
      return res;
    },
    sessionGoogle: async (payload: { uid: string; accessToken: string }, timeoutMs = 3000) => {
      const res = await requestJson<{ token: string; user?: RadiusAuthMe }>('/auth/session', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'google',
          uid: payload.uid,
          accessToken: payload.accessToken,
        }),
        skipLineHeader: true,
        timeoutMs,
      });
      if (res?.token) setRadiusToken(res.token);
      return res;
    },
    refresh: async () => {
      const res = await requestJson<{ token: string; user?: RadiusAuthMe }>('/auth/refresh', {
        method: 'POST',
      });
      if (res?.token) setRadiusToken(res.token);
      return res;
    },
  },

  lines: {
    list: () => requestJson<RadiusLine[] | { lines: RadiusLine[] }>('/lines', { skipLineHeader: true }),
    create: (payload: { name: string; line_code: string; owner_uid: string }) =>
      requestJson<RadiusLine>('/lines', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipLineHeader: true,
      }),
    update: (id: string, payload: Partial<{ name: string; line_code: string; owner_uid: string; status: 'Active' | 'Disabled' }>) =>
      requestJson<RadiusLine>(`/lines/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        skipLineHeader: true,
      }),
    overview: () => requestJson<any>('/lines/overview', { skipLineHeader: true }),
  },

  dealers: {
    list: () => requestJson<RadiusDealer[] | { dealers: RadiusDealer[] }>('/dealers'),
    create: (payload: {
      uid: string;
      company_name: string;
      phone: string;
      credit_limit: number;
      commission_pct: number;
    }) =>
      requestJson<RadiusDealer>('/dealers', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      uid: string,
      payload: Partial<{
        company_name: string;
        phone: string;
        credit_limit: number;
        commission_pct: number;
        status: 'Active' | 'Disabled';
      }>
    ) =>
      requestJson<RadiusDealer>(`/dealers/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    disable: (uid: string, status: 'Active' | 'Disabled') =>
      requestJson<RadiusDealer>(`/dealers/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    topupWallet: (uid: string, payload: { amount: number; method?: string; reference?: string; note?: string }) =>
      requestJson<{ dealer?: RadiusDealer; entry?: WalletLedgerEntry; wallet_balance?: number }>(
        `/dealers/${encodeURIComponent(uid)}/wallet/topup`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),
    getWalletLedger: (uid: string) =>
      requestJson<WalletLedgerEntry[] | { ledger: WalletLedgerEntry[]; wallet_balance?: number }>(
        `/dealers/${encodeURIComponent(uid)}/wallet/ledger`
      ),
    getPrices: (uid: string) =>
      requestJson<DealerPackagePrice[] | { prices: DealerPackagePrice[] }>(
        `/dealers/${encodeURIComponent(uid)}/prices`
      ),
    updatePrices: (uid: string, prices: Array<{ package_id: string; dealer_price: number }>) =>
      requestJson<DealerPackagePrice[] | { prices: DealerPackagePrice[] }>(
        `/dealers/${encodeURIComponent(uid)}/prices`,
        {
          method: 'PUT',
          body: JSON.stringify({ prices }),
        }
      ),
  },

  staff: {
    list: () => requestJson<TeamMemberRecord[] | { staff: TeamMemberRecord[] }>('/staff'),
    create: (payload: { uid: string; permissions: RadiusPermissionKey[] }) =>
      requestJson<TeamMemberRecord>('/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (uid: string, payload: Partial<{ permissions: RadiusPermissionKey[]; status: 'Active' | 'Disabled' }>) =>
      requestJson<TeamMemberRecord>(`/staff/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    revoke: (uid: string) =>
      requestJson<{ success?: boolean }>(`/staff/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      }),
  },

  members: {
    list: () => requestJson<TeamMemberRecord[] | { members: TeamMemberRecord[] }>('/members'),
    create: (payload: { uid: string; permissions: RadiusPermissionKey[]; scope: MemberScope }) =>
      requestJson<TeamMemberRecord>('/members', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      uid: string,
      payload: Partial<{ permissions: RadiusPermissionKey[]; scope: MemberScope; status: 'Active' | 'Disabled' }>
    ) =>
      requestJson<TeamMemberRecord>(`/members/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    revoke: (uid: string) =>
      requestJson<{ success?: boolean }>(`/members/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      }),
  },

  vlans: {
    list: () => requestJson<RadiusVlan[] | { vlans: RadiusVlan[] }>('/vlans'),
    suggest: (dealerNo?: number) => {
      const q = dealerNo !== undefined && dealerNo !== null ? `?dealerNo=${encodeURIComponent(String(dealerNo))}` : '';
      return requestJson<VlanSuggestResponse>(`/vlans/suggest${q}`);
    },
    create: (payload: {
      vlan_id: number;
      name: string;
      kind?: string;
      dealer_uid?: string | null;
      nas_id?: string | null;
      pppoe_service?: string;
      ip_pool?: string;
      notes?: string;
    }) =>
      requestJson<RadiusVlan>('/vlans', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        vlan_id: number;
        name: string;
        kind: string;
        dealer_uid: string | null;
        nas_id: string | null;
        pppoe_service: string;
        ip_pool: string;
        notes: string;
      }>
    ) =>
      requestJson<RadiusVlan>(`/vlans/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      requestJson<{ success?: boolean }>(`/vlans/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    routerosScript: (vlanId: number) =>
      requestJson<RouterOsScriptResponse>(`/vlans/routeros-script?vlanId=${encodeURIComponent(String(vlanId))}`),
  },

  users: {
    list: () => requestJson<any[]>('/users'),
    mainUsers: () => requestJson<MainUserCandidate[] | { users: MainUserCandidate[] }>('/users/main-users'),
    create: (payload: any) =>
      requestJson<any>('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: any) =>
      requestJson<any>(`/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      requestJson<{ success?: boolean }>(`/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    renew: (id: string, payload: any) =>
      requestJson<any>(`/users/${encodeURIComponent(id)}/renew`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    toggle: (id: string) =>
      requestJson<any>(`/users/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
      }),
    disconnect: (id: string) =>
      requestJson<any>(`/users/${encodeURIComponent(id)}/disconnect`, {
        method: 'POST',
      }),
  },

  packages: {
    list: () => requestJson<any[]>('/packages'),
    create: (payload: any) =>
      requestJson<any>('/packages', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: any) =>
      requestJson<any>(`/packages/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      requestJson<{ success?: boolean }>(`/packages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },

  vouchers: {
    list: () => requestJson<any[]>('/vouchers'),
    generate: (payload: any) =>
      requestJson<any[]>('/vouchers/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    redeem: (payload: { code: string; userId: string }) =>
      requestJson<any>('/vouchers/redeem', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    delete: (ids: string[]) =>
      requestJson<{ success?: boolean }>('/vouchers/delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },

  payments: {
    list: () => requestJson<any[]>('/payments'),
    create: (payload: any) =>
      requestJson<any>('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  nas: {
    list: () => requestJson<any[]>('/nas'),
    create: (payload: any) =>
      requestJson<any>('/nas', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: any) =>
      requestJson<any>(`/nas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      requestJson<{ success?: boolean }>(`/nas/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    ping: (id: string) =>
      requestJson<{ status: 'Online' | 'Offline'; latencyMs: number }>(`/nas/${encodeURIComponent(id)}/ping`, {
        method: 'POST',
      }),
  },

  stats: {
    get: () => requestJson<any>('/stats'),
  },

  logs: {
    list: () => requestJson<any[]>('/logs'),
  },

  sms: {
    send: (payload: any) =>
      requestJson<any>('/sms/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  settings: {
    get: () => requestJson<any>('/settings'),
    update: (payload: any) =>
      requestJson<any>('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  },
};
