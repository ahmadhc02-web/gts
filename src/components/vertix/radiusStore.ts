import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import {
  radiusApi,
  RadiusApiError,
  formatRadiusError,
  hasPermission,
  clearRadiusSession,
  setActiveLineIdHeader,
  getActiveLineId,
  type RadiusAuthMe,
  type RadiusPermissionKey,
  type RadiusLine,
  type RadiusDealer,
  type TeamMemberRecord,
  type RadiusVlan,
  type DealerPackagePrice,
  type MainUserCandidate,
} from './radiusApi';

export interface RadiusUser {
  id: string;
  username: string;
  name: string;
  mobile: string;
  owner?: string;
  dealerUid?: string | null;
  dealerName?: string | null;
  vlanId?: number | null;
  lineId?: string | null;
  password?: string; // Only populated if server includes it (requires users.viewPassword)
  package: string;
  packageId?: string;
  status: 'Active' | 'Expired' | 'Disabled' | 'Terminated' | 'Pre-Active';
  online: boolean;
  ip: string;
  expiry: string; // ISO date YYYY-MM-DD
  mac?: string;
  dataUsedGB: number;
  balance: number;
  onlineSince?: string;
  createdAt?: string;

  email?: string;
  city?: string;
  address?: string;
  nationalId?: string;
  company?: string;
  secondaryPhone?: string;
  notes?: string;
  autoRenew?: boolean;
  macLock?: boolean;
  separatePortalPassword?: boolean;
  portalPassword?: string;
}

export interface RadiusPackage {
  id: string;
  name: string;
  speed: string;
  pricePerMonth: number;
  dealerPrice?: number;
  dataLimitGB?: number;
  activeUsers?: number;
  status: 'Active' | 'Inactive';
}

export interface Voucher {
  id: string;
  code: string;
  packageId: string;
  packageName: string;
  price: number;
  months: number;
  status: 'Active' | 'Redeemed' | 'Expired';
  createdAt: string;
  redeemedBy?: string;
  redeemedAt?: string;
}

export interface Payment {
  id: string;
  userId: string;
  username: string;
  amount: number;
  type: 'Renewal' | 'Voucher' | 'Manual' | 'Transfer' | 'Request';
  method: 'Cash' | 'Easypaisa' | 'JazzCash' | 'Bank' | 'Online';
  date: string;
  note?: string;
  manager?: string;
  packageName?: string;
}

export interface Manager {
  id: string;
  name: string;
  username: string;
  role: 'SuperAdmin' | 'Admin' | 'Reseller' | 'Support';
  balance: number;
  subscribersCount: number;
  phone: string;
  status: 'Active' | 'Suspended';
}

export interface Nas {
  id: string;
  name: string;
  ip: string;
  type: 'Mikrotik' | 'Cisco' | 'Huawei' | 'Ubiquiti';
  secret: string;
  status: 'Online' | 'Offline' | 'Warning';
  latencyMs: number;
  activeSessions: number;
  lastPing: string;
}

export interface LogEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
}

export interface RadiusSettings {
  companyName: string;
  logoInitials: string;
  defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'PKR';
  defaultPackage: string;
  defaultMonths: number;
  expiryReminderDays: number;
  radiusServerIp: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  themeDefault: 'light' | 'dark';
}

export interface RadiusStoreState {
  authMe: RadiusAuthMe | null;
  authLoading: boolean;
  authError: string | null;
  isLoading: boolean;
  apiError: string | null;
  serviceUnavailable: boolean;
  serviceUnavailableReason: string | null;
  needsPasswordVerify: boolean;
  accessDenied: boolean;
  activeLineId: string | null;
  lines: RadiusLine[];
  dealers: RadiusDealer[];
  teamMembers: TeamMemberRecord[];
  vlans: RadiusVlan[];
  dealerPrices: DealerPackagePrice[];
  mainUsers: MainUserCandidate[];
  users: RadiusUser[];
  packages: RadiusPackage[];
  vouchers: Voucher[];
  payments: Payment[];
  managers: Manager[];
  nasList: Nas[];
  logs: LogEntry[];
  readNotificationIds: string[];
  settings: RadiusSettings;
  serverStats: Record<string, any> | null;
}

export const DEFAULT_SETTINGS: RadiusSettings = {
  companyName: 'Green Pro Network Solutions',
  logoInitials: 'G',
  defaultCurrency: 'PKR',
  defaultPackage: '',
  defaultMonths: 1,
  expiryReminderDays: 3,
  radiusServerIp: '',
  radiusAuthPort: 1812,
  radiusAcctPort: 1813,
  themeDefault: 'light',
};

export const toLocalDateKey = (dateInput?: string | Date | null): string => {
  if (!dateInput || dateInput === 'Not Activated') return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getDayDiffFromToday = (dateStr?: string | null): number | null => {
  const key = toLocalDateKey(dateStr);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  const expLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
};

export const isUserCreatedThisMonth = (user: Partial<RadiusUser> | null | undefined): boolean => {
  if (!user) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (user.createdAt) {
    const key = toLocalDateKey(user.createdAt);
    if (key) {
      const [y, m] = key.split('-').map(Number);
      return y === currentYear && m - 1 === currentMonth;
    }
  }
  return false;
};

export const getRelativeDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateKey(d);
};

export const getNowTime = (): string => {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export function isUserExpired(user: Partial<RadiusUser> | null | undefined): boolean {
  if (!user || !user.expiry || user.expiry === 'Not Activated' || user.status === 'Pre-Active' || user.status === 'Disabled' || user.status === 'Terminated') {
    return false;
  }
  if (user.status === 'Expired') return true;
  const key = toLocalDateKey(user.expiry);
  if (!key) return false;
  const [y, m, d] = key.split('-').map(Number);
  const cutoffTime = new Date(y, m - 1, d, 11, 59, 0, 0);
  return Date.now() >= cutoffTime.getTime();
}

export function formatExpiryDateDisplay(dateStr?: string | null): string {
  if (!dateStr || dateStr === 'Not Activated') return 'Not Activated';
  const key = toLocalDateKey(dateStr);
  const d = key ? (() => { const [y, m, day] = key.split('-').map(Number); return new Date(y, m - 1, day); })() : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function getExpiryCountdown(dateStr?: string | null): string {
  if (!dateStr || dateStr === 'Not Activated') return 'Not Activated';
  const key = toLocalDateKey(dateStr);
  if (!key) return '0d 00h 00m 00s';
  const [y, m, d] = key.split('-').map(Number);
  const cutoff = new Date(y, m - 1, d, 11, 59, 0, 0);
  const diffMs = cutoff.getTime() - Date.now();
  if (diffMs <= 0) return '0d 00h 00m 00s';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}

// Normalize backend rows into frontend shapes cleanly
function normalizeUserRow(row: any): RadiusUser {
  return {
    id: String(row.id || row.uid || row.username),
    username: String(row.username || ''),
    name: String(row.name || row.full_name || row.fullName || row.username || ''),
    mobile: String(row.mobile || row.phone || ''),
    owner: row.owner || row.dealer_company || row.dealer_name || (row.dealer_uid ? `Dealer` : row.line_code || ''),
    dealerUid: row.dealer_uid ?? row.dealerUid ?? null,
    dealerName: row.dealer_name ?? row.dealer_company ?? row.dealerName ?? null,
    vlanId: row.vlan_id !== undefined && row.vlan_id !== null ? Number(row.vlan_id) : row.vlanId ?? null,
    lineId: row.line_id ?? row.lineId ?? null,
    password: row.password,
    package: String(row.package || row.package_name || ''),
    packageId: row.package_id || row.packageId,
    status: row.status || 'Pre-Active',
    online: Boolean(row.online),
    ip: String(row.ip || row.framed_ip || ''),
    expiry: String(row.expiry || row.expires_at || 'Not Activated'),
    mac: row.mac || row.mac_address || undefined,
    dataUsedGB: Number(row.dataUsedGB ?? row.data_used_gb ?? 0),
    balance: Number(row.balance ?? 0),
    onlineSince: row.onlineSince || row.online_since,
    createdAt: row.createdAt || row.created_at,
    email: row.email,
    city: row.city,
    address: row.address,
    nationalId: row.nationalId || row.national_id,
    company: row.company,
    secondaryPhone: row.secondaryPhone || row.secondary_phone,
    notes: row.notes,
    autoRenew: Boolean(row.autoRenew ?? row.auto_renew),
    macLock: Boolean(row.macLock ?? row.mac_lock),
  };
}

function normalizePackageRow(row: any): RadiusPackage {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    speed: String(row.speed || ''),
    pricePerMonth: Number(row.pricePerMonth ?? row.price_per_month ?? row.price ?? 0),
    dealerPrice: row.dealerPrice !== undefined ? Number(row.dealerPrice) : row.dealer_price !== undefined ? Number(row.dealer_price) : undefined,
    dataLimitGB: row.dataLimitGB ?? row.data_limit_gb ?? undefined,
    activeUsers: row.activeUsers ?? row.active_users,
    status: row.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function normalizeDealerRow(row: any): RadiusDealer {
  return {
    uid: String(row.uid || row.id),
    username: row.username,
    full_name: row.full_name || row.fullName,
    dealer_no: Number(row.dealer_no ?? row.dealerNo ?? 0),
    company_name: String(row.company_name || row.companyName || row.username || ''),
    phone: String(row.phone || ''),
    vlan_id: row.vlan_id !== undefined && row.vlan_id !== null ? Number(row.vlan_id) : null,
    main_vlan_id: row.main_vlan_id !== undefined && row.main_vlan_id !== null ? Number(row.main_vlan_id) : (row.vlan_id !== undefined && row.vlan_id !== null ? Number(row.vlan_id) : null),
    wallet_balance: Number(row.wallet_balance ?? row.balance ?? 0),
    credit_limit: Number(row.credit_limit ?? 0),
    commission_pct: Number(row.commission_pct ?? 0),
    subscribers_count: Number(row.subscribers_count ?? row.subscribersCount ?? 0),
    status: row.status === 'Disabled' ? 'Disabled' : 'Active',
    line_id: row.line_id,
    created_at: row.created_at,
  };
}

const getInitialState = (): RadiusStoreState => {
  return {
    authMe: null,
    authLoading: true,
    authError: null,
    isLoading: true,
    apiError: null,
    serviceUnavailable: false,
    serviceUnavailableReason: null,
    needsPasswordVerify: false,
    accessDenied: false,
    activeLineId: getActiveLineId(),
    lines: [],
    dealers: [],
    teamMembers: [],
    vlans: [],
    dealerPrices: [],
    mainUsers: [],
    users: [],
    packages: [],
    vouchers: [],
    payments: [],
    managers: [],
    nasList: [],
    logs: [],
    readNotificationIds: [],
    settings: DEFAULT_SETTINGS,
    serverStats: null,
  };
};

let globalRadiusState: RadiusStoreState = getInitialState();
const globalRadiusListeners = new Set<Dispatch<SetStateAction<RadiusStoreState>>>();
let activeRefreshPromise: Promise<void> | null = null;
let hasInitializedOnce = false;

export function getGlobalRadiusState(): RadiusStoreState {
  return globalRadiusState;
}

export function updateGlobalRadiusState(
  updater: RadiusStoreState | ((prev: RadiusStoreState) => RadiusStoreState)
): RadiusStoreState {
  const next = typeof updater === 'function' ? updater(globalRadiusState) : updater;
  globalRadiusState = next;
  globalRadiusListeners.forEach(listener => {
    try {
      listener(next);
    } catch (e) {
      console.error('Listener notify error:', e);
    }
  });
  return next;
}

export function resetRadiusStore() {
  hasInitializedOnce = false;
  activeRefreshPromise = null;
  updateGlobalRadiusState({
    ...getInitialState(),
    isLoading: false,
    authLoading: false,
  });
}

async function fetchAllFromApi(force = false): Promise<void> {
  if (activeRefreshPromise && !force) return activeRefreshPromise;

  const run = async () => {
    updateGlobalRadiusState(prev => ({
      ...prev,
      isLoading: true,
      authLoading: prev.authMe === null,
      apiError: null,
      serviceUnavailable: false,
      serviceUnavailableReason: null,
      accessDenied: false,
    }));

    try {
      const me = await radiusApi.auth.me();
      if (me.radiusRole !== 'SuperAdmin') {
        setActiveLineIdHeader(null);
      }

      updateGlobalRadiusState(prev => ({
        ...prev,
        authMe: me,
        authLoading: false,
        authError: null,
        needsPasswordVerify: false,
        accessDenied: false,
        serviceUnavailable: false,
        serviceUnavailableReason: null,
        activeLineId: me.radiusRole === 'SuperAdmin' ? getActiveLineId() : me.lineId,
      }));

      const can = (perm: RadiusPermissionKey) => hasPermission(me, perm);
      const isSuperAdmin = me.radiusRole === 'SuperAdmin';
      const isOwner = me.radiusRole === 'Owner';
      const isDealer = me.radiusRole === 'Dealer';
      const isDealerOrStaff = isDealer || me.radiusRole === 'DealerStaff';
      const isNasForbidden = isDealer || me.radiusRole === 'DealerStaff' || me.radiusRole === 'Member';

      const unwrapList = <T,>(res: any, key?: string): T[] => {
        if (Array.isArray(res)) return res;
        if (key && Array.isArray(res?.[key])) return res[key];
        if (Array.isArray(res?.items)) return res.items;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      };

      const tasks: Promise<void>[] = [];
      let unreachableError: RadiusApiError | null = null;
      let unauthorizedError: RadiusApiError | null = null;
      let forbiddenError: RadiusApiError | null = null;

      const handleListError = (err: any) => {
        if (err instanceof RadiusApiError) {
          if (err.isUnreachable && !unreachableError) unreachableError = err;
          if (err.isUnauthorized && !unauthorizedError) unauthorizedError = err;
          if (err.isForbidden && !forbiddenError) forbiddenError = err;
        }
      };

      let nextLines: RadiusLine[] = [];
      let nextDealers: RadiusDealer[] = [];
      let nextTeam: TeamMemberRecord[] = [];
      let nextVlans: RadiusVlan[] = [];
      let nextDealerPrices: DealerPackagePrice[] = [];
      let nextUsers: RadiusUser[] = [];
      let nextPackages: RadiusPackage[] = [];
      let nextVouchers: Voucher[] = [];
      let nextPayments: Payment[] = [];
      let nextNas: Nas[] = [];
      let nextLogs: LogEntry[] = [];
      let nextSettings: RadiusSettings = DEFAULT_SETTINGS;
      let nextMainUsers: MainUserCandidate[] = [];
      let nextServerStats: Record<string, any> | null = null;

      if (isSuperAdmin) {
        tasks.push(
          radiusApi.lines.list()
            .then(res => { nextLines = unwrapList<RadiusLine>(res, 'lines'); })
            .catch(err => { handleListError(err); nextLines = []; })
        );
      }

      if (can('users.view') || can('online.view')) {
        tasks.push(
          radiusApi.users.list()
            .then(res => { nextUsers = unwrapList<any>(res, 'users').map(normalizeUserRow); })
            .catch(err => { handleListError(err); nextUsers = []; })
        );
      }

      if (can('packages.view') || can('packages.manage') || can('users.create') || can('users.renew')) {
        tasks.push(
          radiusApi.packages.list()
            .then(res => { nextPackages = unwrapList<any>(res, 'packages').map(normalizePackageRow); })
            .catch(err => { handleListError(err); nextPackages = []; })
        );
      }

      if (can('vouchers.view') || can('vouchers.manage')) {
        tasks.push(
          radiusApi.vouchers.list()
            .then(res => { nextVouchers = unwrapList<Voucher>(res, 'vouchers'); })
            .catch(err => { handleListError(err); nextVouchers = []; })
        );
      }

      if (can('payments.view') || can('revenue.view') || can('reports.view')) {
        tasks.push(
          radiusApi.payments.list()
            .then(res => { nextPayments = unwrapList<Payment>(res, 'payments'); })
            .catch(err => { handleListError(err); nextPayments = []; })
        );
      }

      if (!isNasForbidden && (can('nas.view') || can('nas.manage'))) {
        tasks.push(
          radiusApi.nas.list()
            .then(res => { nextNas = unwrapList<Nas>(res, 'nas'); })
            .catch(err => { handleListError(err); nextNas = []; })
        );
      }

      if (can('logs.view')) {
        tasks.push(
          radiusApi.logs.list()
            .then(res => { nextLogs = unwrapList<LogEntry>(res, 'logs'); })
            .catch(err => { handleListError(err); nextLogs = []; })
        );
      }

      if (isSuperAdmin || isOwner || can('dealers.manage')) {
        tasks.push(
          radiusApi.dealers.list()
            .then(res => { nextDealers = unwrapList<any>(res, 'dealers').map(normalizeDealerRow); })
            .catch(err => { handleListError(err); nextDealers = []; })
        );
      }

      if (isDealer && can('members.manage')) {
        tasks.push(
          radiusApi.staff.list()
            .then(res => { nextTeam = unwrapList<TeamMemberRecord>(res, 'staff'); })
            .catch(err => { handleListError(err); nextTeam = []; })
        );
      } else if ((isOwner || isSuperAdmin) && can('members.manage')) {
        tasks.push(
          radiusApi.members.list()
            .then(res => { nextTeam = unwrapList<TeamMemberRecord>(res, 'members'); })
            .catch(err => { handleListError(err); nextTeam = []; })
        );
      }

      if (can('vlans.view') || can('vlans.manage') || can('users.create') || isDealerOrStaff) {
        tasks.push(
          radiusApi.vlans.list()
            .then(res => { nextVlans = unwrapList<RadiusVlan>(res, 'vlans'); })
            .catch(err => { handleListError(err); nextVlans = []; })
        );
      }

      if (isDealerOrStaff && (me.dealerUid || me.sub)) {
        const targetUid = me.dealerUid || me.sub;
        tasks.push(
          radiusApi.dealers.getPrices(targetUid)
            .then(res => { nextDealerPrices = unwrapList<DealerPackagePrice>(res, 'prices'); })
            .catch(() => { nextDealerPrices = []; })
        );
      }

      if (isSuperAdmin || can('dealers.manage') || can('members.manage')) {
        tasks.push(
          radiusApi.users.mainUsers()
            .then(res => { nextMainUsers = unwrapList<MainUserCandidate>(res, 'users'); })
            .catch(() => { nextMainUsers = []; })
        );
      }

      tasks.push(
        radiusApi.stats.get()
          .then(res => { nextServerStats = res; })
          .catch(err => { handleListError(err); nextServerStats = null; })
      );

      if (can('settings.manage')) {
        tasks.push(
          radiusApi.settings.get()
            .then(res => {
              if (res && typeof res === 'object') {
                nextSettings = { ...DEFAULT_SETTINGS, ...res };
              }
            })
            .catch(err => { handleListError(err); })
        );
      }

      await Promise.all(tasks);

      if (unreachableError) {
        const reason = (unreachableError as RadiusApiError).message || 'Radius service unavailable';
        updateGlobalRadiusState(prev => ({
          ...prev,
          isLoading: false,
          authLoading: false,
          serviceUnavailable: true,
          serviceUnavailableReason: reason,
          apiError: formatRadiusError(unreachableError),
          lines: [],
          dealers: [],
          managers: [],
          teamMembers: [],
          vlans: [],
          dealerPrices: [],
          mainUsers: [],
          users: [],
          packages: [],
          vouchers: [],
          payments: [],
          nasList: [],
          logs: [],
          serverStats: null,
        }));
        return;
      }

      if (unauthorizedError) {
        clearRadiusSession();
        updateGlobalRadiusState(prev => ({
          ...prev,
          isLoading: false,
          authLoading: false,
          authMe: null,
          needsPasswordVerify: true,
          authError: (unauthorizedError as RadiusApiError).message,
          apiError: formatRadiusError(unauthorizedError),
          users: [],
          packages: [],
          vouchers: [],
          payments: [],
          nasList: [],
          logs: [],
        }));
        return;
      }

      if (forbiddenError && nextUsers.length === 0 && nextPackages.length === 0 && tasks.length > 0) {
        updateGlobalRadiusState(prev => ({
          ...prev,
          isLoading: false,
          authLoading: false,
          accessDenied: true,
          authError: (forbiddenError as RadiusApiError).message,
          apiError: formatRadiusError(forbiddenError),
        }));
        return;
      }

      const mappedManagers: Manager[] = nextDealers.map(d => ({
        id: d.uid,
        name: d.company_name || d.full_name || d.username || `Dealer #${d.dealer_no}`,
        username: d.username || `dealer_${d.dealer_no}`,
        role: 'Reseller',
        balance: d.wallet_balance,
        subscribersCount: d.subscribers_count,
        phone: d.phone,
        status: d.status === 'Disabled' ? 'Suspended' : 'Active',
      }));

      updateGlobalRadiusState(prev => ({
        ...prev,
        isLoading: false,
        authLoading: false,
        serviceUnavailable: false,
        serviceUnavailableReason: null,
        needsPasswordVerify: false,
        accessDenied: false,
        lines: nextLines,
        dealers: nextDealers,
        managers: mappedManagers,
        teamMembers: nextTeam,
        vlans: nextVlans,
        dealerPrices: nextDealerPrices,
        mainUsers: nextMainUsers,
        users: nextUsers,
        packages: nextPackages,
        vouchers: nextVouchers,
        payments: nextPayments,
        nasList: nextNas,
        logs: nextLogs,
        settings: nextSettings,
        serverStats: nextServerStats,
      }));
    } catch (err: any) {
      const apiErr = err instanceof RadiusApiError ? err : new RadiusApiError(err?.message || 'Radius request failed', 0, null, 'unreachable');
      if (apiErr.isUnauthorized) {
        clearRadiusSession();
      }
      const msg = formatRadiusError(apiErr);
      updateGlobalRadiusState(prev => ({
        ...prev,
        authMe: null,
        isLoading: false,
        authLoading: false,
        authError: msg,
        apiError: msg,
        serviceUnavailable: apiErr.isUnreachable,
        serviceUnavailableReason: apiErr.isUnreachable ? apiErr.message : null,
        needsPasswordVerify: apiErr.isUnauthorized,
        accessDenied: apiErr.isForbidden,
        lines: [],
        dealers: [],
        managers: [],
        teamMembers: [],
        vlans: [],
        dealerPrices: [],
        mainUsers: [],
        users: [],
        packages: [],
        vouchers: [],
        payments: [],
        nasList: [],
        logs: [],
        serverStats: null,
      }));
    }
  };

  activeRefreshPromise = run().finally(() => {
    activeRefreshPromise = null;
  });
  return activeRefreshPromise;
}

export function useRadiusStore() {
  const [state, setLocalState] = useState<RadiusStoreState>(globalRadiusState);

  useEffect(() => {
    globalRadiusListeners.add(setLocalState);
    setLocalState(globalRadiusState);
    if (!hasInitializedOnce) {
      hasInitializedOnce = true;
      fetchAllFromApi();
    }
    return () => {
      globalRadiusListeners.delete(setLocalState);
    };
  }, []);

  // Refresh /auth/me & state every 5 minutes per backend JWT freshness rule
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllFromApi(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const setState = updateGlobalRadiusState;

  const refreshAll = useCallback((force = true) => {
    return fetchAllFromApi(force);
  }, []);

  const setActiveLineId = useCallback(async (lineId: string | null) => {
    const normalized = lineId && lineId !== 'all' ? lineId : null;
    setActiveLineIdHeader(normalized);
    setState(prev => ({ ...prev, activeLineId: normalized }));
    await fetchAllFromApi(true);
  }, []);

  const can = useCallback(
    (perm: RadiusPermissionKey) => hasPermission(state.authMe, perm),
    [state.authMe]
  );

  const fetchDealerPrices = useCallback(async (dealerUid: string): Promise<DealerPackagePrice[]> => {
    const res = await radiusApi.dealers.getPrices(dealerUid);
    return Array.isArray(res) ? res : (res?.prices || []);
  }, []);

  const appendLog = useCallback((action: string, target: string, actor = 'system') => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: getNowTime(),
      actor,
      action,
      target,
    };
    setState(prev => ({
      ...prev,
      logs: [newEntry, ...prev.logs.slice(0, 99)],
    }));
  }, []);

  const handleMutationError = useCallback((err: any, fallbackLabel: string): never => {
    const msg = formatRadiusError(err) || fallbackLabel;
    toast.error(msg);
    setState(prev => ({
      ...prev,
      apiError: msg,
      ...(err instanceof RadiusApiError && err.isUnreachable
        ? { serviceUnavailable: true, serviceUnavailableReason: err.message }
        : {}),
      ...(err instanceof RadiusApiError && err.isUnauthorized
        ? { needsPasswordVerify: true }
        : {}),
    }));
    throw err;
  }, []);

  // --- USER ACTIONS (API-FIRST & HONEST) ---
  const createUserAsync = useCallback(async (userData: {
    username: string;
    name: string;
    mobile: string;
    package: string;
    packageId?: string;
    months?: number;
    password?: string;
    owner?: string;
    dealerUid?: string | null;
    vlanId?: number | null;
    status?: 'Active' | 'Disabled' | 'Pre-Active';
    email?: string;
    city?: string;
    address?: string;
    nationalId?: string;
    company?: string;
    secondaryPhone?: string;
    notes?: string;
    autoRenew?: boolean;
    macLock?: boolean;
  }): Promise<RadiusUser> => {
    const cleanUsername = String(userData.username || '').toLowerCase().trim();
    const exists = state.users.some(
      u => u && u.username && u.username.toLowerCase().trim() === cleanUsername
    );
    if (exists) {
      const dupErr = new RadiusApiError(
        `Username "${cleanUsername}" already exists.`,
        409,
        null,
        'validation'
      );
      return handleMutationError(dupErr, 'Duplicate username');
    }

    const pkg = state.packages.find(
      p => p.name === userData.package || p.id === userData.package || p.id === userData.packageId
    );

    try {
      const createdRaw = await radiusApi.users.create({
        ...userData,
        username: cleanUsername,
        package_id: pkg?.id || userData.packageId,
        package_name: pkg?.name || userData.package,
        package: pkg?.name || userData.package,
        dealer_uid: userData.dealerUid || undefined,
        vlan_id: userData.vlanId ?? undefined,
      });

      const created = normalizeUserRow(createdRaw?.user || createdRaw);
      setState(prev => ({
        ...prev,
        users: [created, ...prev.users.filter(u => u.id !== created.id)],
      }));
      await refreshAll(true);
      appendLog('User Registered', `${created.username} (${created.package})`, state.authMe?.username);
      return created;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to create user');
    }
  }, [state.users, state.packages, state.authMe, refreshAll, appendLog, handleMutationError]);

  const addUser = useCallback(async (userData: any): Promise<RadiusUser> => {
    return createUserAsync(userData);
  }, [createUserAsync]);

  const updateUser = useCallback(async (userId: string, partial: Partial<RadiusUser>): Promise<RadiusUser> => {
    try {
      const updatedRaw = await radiusApi.users.update(userId, partial);
      const updated = updatedRaw?.user || updatedRaw;
      const normalized = updated && (updated.id || updated.username) ? normalizeUserRow(updated) : null;
      if (normalized) {
        setState(prev => ({
          ...prev,
          users: prev.users.map(u => (u.id === userId ? normalized : u)),
        }));
      }
      await refreshAll(true);
      return normalized || (state.users.find(u => u.id === userId) as RadiusUser);
    } catch (err: any) {
      return handleMutationError(err, 'Failed to update subscriber');
    }
  }, [state.users, refreshAll, handleMutationError]);

  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    try {
      await radiusApi.users.delete(userId);
      setState(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId),
      }));
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Failed to delete subscriber');
    }
  }, [refreshAll, handleMutationError]);

  const renewSubscriberAsync = useCallback(async (params: {
    userId: string;
    packageName: string;
    packageId?: string;
    newExpiry: string;
    amount: number;
    extraFee?: number;
    paymentMethod?: 'Cash' | 'Online';
    durationMonths?: number;
    customDays?: number;
    expiryType?: 'Default' | 'Custom Date';
  }) => {
    try {
      const pkg = state.packages.find(
        p => p.name === params.packageName || p.id === params.packageName || p.id === params.packageId
      );
      const res = await radiusApi.users.renew(params.userId, {
        package: params.packageName,
        package_id: pkg?.id || params.packageId,
        new_expiry: params.newExpiry,
        amount: params.amount,
        extra_fee: params.extraFee || 0,
        payment_method: params.paymentMethod || 'Cash',
        months: params.durationMonths || 1,
        custom_days: params.customDays,
        expiry_type: params.expiryType || 'Default',
      });
      await refreshAll(true);
      return {
        newExpiry: res?.newExpiry || res?.expiry || params.newExpiry,
        newBalance: res?.newBalance ?? res?.wallet_balance ?? 0,
        amount: res?.chargedAmount ?? res?.amount ?? params.amount,
      };
    } catch (err: any) {
      return handleMutationError(err, 'Failed to renew subscriber');
    }
  }, [state.packages, refreshAll, handleMutationError]);

  const renewUser = useCallback(async (userId: string, packageIdOrName: string, months: number) => {
    const user = state.users.find(u => u.id === userId);
    if (!user) {
      const notFound = new RadiusApiError('User not found', 404, null, 'validation');
      return handleMutationError(notFound, 'User not found');
    }
    const pkg = state.packages.find(p => p.id === packageIdOrName || p.name === packageIdOrName) || state.packages[0];
    const dealerPriceObj = state.dealerPrices.find(dp => dp.package_id === pkg?.id || dp.package_name === pkg?.name);
    const unitPrice =
      (state.authMe?.radiusRole === 'Dealer' || state.authMe?.radiusRole === 'DealerStaff') && dealerPriceObj
        ? dealerPriceObj.dealer_price
        : (pkg?.dealerPrice ?? pkg?.pricePerMonth ?? 0);
    const amount = unitPrice * months;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentExp = new Date(user.expiry);
    const baseDate = isNaN(currentExp.getTime()) || currentExp < today ? today : currentExp;
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + months * 30);
    const newExpiryStr = toLocalDateKey(nextDate);

    try {
      const res = await radiusApi.users.renew(userId, {
        package: pkg?.name || packageIdOrName,
        package_id: pkg?.id,
        months,
        new_expiry: newExpiryStr,
        amount,
      });
      await refreshAll(true);
      return {
        newExpiry: res?.newExpiry || res?.expiry || newExpiryStr,
        newBalance: res?.newBalance ?? res?.wallet_balance ?? ((state.authMe?.balance ?? 0) - amount),
        amount: res?.chargedAmount ?? res?.amount ?? amount,
      };
    } catch (err: any) {
      return handleMutationError(err, 'Renewal failed');
    }
  }, [state.users, state.packages, state.dealerPrices, state.authMe, refreshAll, handleMutationError]);

  const renewSubscriber = useCallback(async (params: {
    userId: string;
    packageName: string;
    packageId?: string;
    newExpiry: string;
    amount: number;
    extraFee?: number;
    paymentMethod?: 'Cash' | 'Online';
    durationMonths?: number;
    customDays?: number;
    expiryType?: 'Default' | 'Custom Date';
  }) => {
    return renewSubscriberAsync(params);
  }, [renewSubscriberAsync]);

  const toggleUserStatus = useCallback(async (userId: string) => {
    try {
      const res = await radiusApi.users.toggle(userId);
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Status toggle failed');
    }
  }, [refreshAll, handleMutationError]);

  const disconnectUser = useCallback(async (userId: string) => {
    try {
      const res = await radiusApi.users.disconnect(userId);
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Disconnect failed');
    }
  }, [refreshAll, handleMutationError]);

  const toggleUserOnline = useCallback(async (userId: string) => {
    const user = state.users.find(u => u.id === userId);
    if (user?.online) {
      return disconnectUser(userId);
    }
    return toggleUserStatus(userId);
  }, [state.users, disconnectUser, toggleUserStatus]);

  const bulkRenew = useCallback(async (userIds: string[], packageIdOrName: string, months: number) => {
    try {
      const pkg = state.packages.find(p => p.id === packageIdOrName || p.name === packageIdOrName);
      await Promise.all(
        userIds.map(id =>
          radiusApi.users.renew(id, {
            package: pkg?.name || packageIdOrName,
            package_id: pkg?.id,
            months,
          })
        )
      );
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Bulk renew failed');
    }
  }, [state.packages, refreshAll, handleMutationError]);

  const bulkDisable = useCallback(async (userIds: string[]) => {
    try {
      await Promise.all(userIds.map(id => radiusApi.users.update(id, { status: 'Disabled' })));
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Bulk disable failed');
    }
  }, [refreshAll, handleMutationError]);

  const bulkDelete = useCallback(async (userIds: string[]) => {
    try {
      await Promise.all(userIds.map(id => radiusApi.users.delete(id)));
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Bulk delete failed');
    }
  }, [refreshAll, handleMutationError]);

  // --- PACKAGE ACTIONS ---
  const addPackage = useCallback(async (pkg: Omit<RadiusPackage, 'id'>): Promise<RadiusPackage> => {
    try {
      const res = await radiusApi.packages.create(pkg);
      const normalized = normalizePackageRow(res?.package || res);
      setState(prev => ({
        ...prev,
        packages: [normalized, ...prev.packages.filter(p => p.id !== normalized.id)],
      }));
      await refreshAll(true);
      appendLog('Package Created', `${normalized.name} (${normalized.speed})`, state.authMe?.username);
      return normalized;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to create package');
    }
  }, [state.authMe, refreshAll, appendLog, handleMutationError]);

  const updatePackage = useCallback(async (packageId: string, partial: Partial<RadiusPackage>): Promise<RadiusPackage> => {
    try {
      const res = await radiusApi.packages.update(packageId, partial);
      const normalized = normalizePackageRow(res?.package || res);
      setState(prev => ({
        ...prev,
        packages: prev.packages.map(p => (p.id === packageId ? { ...p, ...normalized } : p)),
      }));
      await refreshAll(true);
      appendLog('Package Updated', packageId, state.authMe?.username);
      return normalized;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to update package');
    }
  }, [state.authMe, refreshAll, appendLog, handleMutationError]);

  const deletePackage = useCallback(async (packageId: string): Promise<void> => {
    const pkgToDelete = globalRadiusState.packages.find(p => p.id === packageId);
    try {
      await radiusApi.packages.delete(packageId);
      setState(prev => ({
        ...prev,
        packages: prev.packages.filter(p => p.id !== packageId),
      }));
      await refreshAll(true);
      appendLog('Package Deleted', pkgToDelete?.name || packageId, state.authMe?.username);
    } catch (err: any) {
      handleMutationError(err, 'Failed to delete package');
    }
  }, [state.authMe, refreshAll, appendLog, handleMutationError]);

  // --- VOUCHERS ---
  const generateVouchers = useCallback(async (count: number, packageId: string, customMonths = 1, prefix = 'VTX'): Promise<Voucher[]> => {
    try {
      const res = await radiusApi.vouchers.generate({ count, packageId, months: customMonths, prefix });
      const created = Array.isArray(res) ? res : ((res as any)?.vouchers || (res as any)?.items || []);
      await refreshAll(true);
      return created;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to generate vouchers');
    }
  }, [refreshAll, handleMutationError]);

  const deleteVouchers = useCallback(async (voucherIds: string[]): Promise<void> => {
    try {
      await radiusApi.vouchers.delete(voucherIds);
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Failed to delete vouchers');
    }
  }, [refreshAll, handleMutationError]);

  const redeemVoucher = useCallback(async (code: string, userId: string): Promise<any> => {
    try {
      const res = await radiusApi.vouchers.redeem({ code, userId });
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to redeem voucher');
    }
  }, [refreshAll, handleMutationError]);

  // --- PAYMENTS ---
  const addPayment = useCallback(async (payment: Omit<Payment, 'id'>): Promise<Payment> => {
    try {
      const res = await radiusApi.payments.create(payment);
      await refreshAll(true);
      return (res?.payment || res) as Payment;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to record payment');
    }
  }, [refreshAll, handleMutationError]);

  // --- LEGACY MANAGER HELPERS (delegating to dealers API) ---
  const addManager = useCallback(async (mgr: Omit<Manager, 'id'> & { uid?: string }) => {
    try {
      const cleanUsername = String(mgr.username || '').trim().toLowerCase();
      const matched = state.mainUsers.find(
        u => String(u.username || '').trim().toLowerCase() === cleanUsername
      );
      const res = await radiusApi.dealers.create({
        uid: mgr.uid || matched?.uid || cleanUsername,
        company_name: mgr.name,
        phone: mgr.phone,
        credit_limit: mgr.balance || 0,
        commission_pct: 0,
      });
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to create dealer');
    }
  }, [state.mainUsers, refreshAll, handleMutationError]);

  const updateManager = useCallback(async (id: string, partial: Partial<Manager>) => {
    try {
      const res = await radiusApi.dealers.update(id, {
        company_name: partial.name,
        phone: partial.phone,
        status: partial.status === 'Suspended' ? 'Disabled' : partial.status === 'Active' ? 'Active' : undefined,
      });
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to update dealer');
    }
  }, [refreshAll, handleMutationError]);

  const deleteManager = useCallback(async (id: string) => {
    try {
      await radiusApi.dealers.disable(id, 'Disabled');
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Failed to disable dealer');
    }
  }, [refreshAll, handleMutationError]);

  const addManagerBalance = useCallback(async (managerId: string, amount: number, method: Payment['method'] = 'Cash') => {
    try {
      const res = await radiusApi.dealers.topupWallet(managerId, { amount, method });
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Wallet top-up failed');
    }
  }, [refreshAll, handleMutationError]);

  // --- NAS ---
  const addNas = useCallback(async (nas: Omit<Nas, 'id'>) => {
    try {
      const res = await radiusApi.nas.create(nas);
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to add NAS');
    }
  }, [refreshAll, handleMutationError]);

  const updateNas = useCallback(async (id: string, partial: Partial<Nas>) => {
    try {
      const res = await radiusApi.nas.update(id, partial);
      await refreshAll(true);
      return res;
    } catch (err: any) {
      return handleMutationError(err, 'Failed to update NAS');
    }
  }, [refreshAll, handleMutationError]);

  const deleteNas = useCallback(async (id: string) => {
    try {
      await radiusApi.nas.delete(id);
      await refreshAll(true);
    } catch (err: any) {
      handleMutationError(err, 'Failed to delete NAS');
    }
  }, [refreshAll, handleMutationError]);

  const pingNas = useCallback(async (_id: string) => {
    const err = new RadiusApiError('Available after the domain/MikroTik step', 501, null, 'validation');
    return handleMutationError(err, 'Available after the domain/MikroTik step');
  }, [handleMutationError]);

  // --- LOGS & SETTINGS ---
  const addLog = useCallback((action: string, target: string, actor = 'system') => {
    appendLog(action, target, actor);
  }, [appendLog]);

  const clearLogs = useCallback(() => {
    setState(prev => ({ ...prev, logs: [] }));
  }, []);

  const updateSettings = useCallback(async (partial: Partial<RadiusSettings>) => {
    const prevSettings = globalRadiusState.settings;
    try {
      const res = await radiusApi.settings.update(partial);
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, ...partial, ...(res && typeof res === 'object' ? res : {}) },
      }));
      await refreshAll(true);
      return res;
    } catch (err: any) {
      setState(prev => ({ ...prev, settings: prevSettings }));
      return handleMutationError(err, 'Failed to update settings');
    }
  }, [refreshAll, handleMutationError]);

  const exportData = useCallback((): string => {
    return JSON.stringify({
      users: state.users,
      packages: state.packages,
      vouchers: state.vouchers,
      payments: state.payments,
      vlans: state.vlans,
      settings: state.settings,
    }, null, 2);
  }, [state]);

  const importData = useCallback((_jsonText?: string): { success: boolean; error?: string } => {
    return { success: false, error: 'Direct client import disabled when connected to live RADIUS API.' };
  }, []);

  const resetDemoData = useCallback(async () => {
    await refreshAll(true);
  }, [refreshAll]);

  const markAllNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      readNotificationIds: ['all-read'],
    }));
  }, []);

  // Periodic expiration check
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicker(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const evaluatedUsers = useMemo(() => {
    return state.users.map(u => {
      if (isUserExpired(u)) {
        if (u.status !== 'Expired' || u.online !== false) {
          return { ...u, status: 'Expired' as const, online: false, ip: '' };
        }
      }
      return u;
    });
  }, [state.users, ticker]);

  const packageUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of state.packages) {
      counts[p.name] = evaluatedUsers.filter(u => u.package === p.name).length;
    }
    return counts;
  }, [state.packages, evaluatedUsers]);

  const stats = useMemo(() => {
    const reminderDays = state.settings?.expiryReminderDays || 3;
    const total = evaluatedUsers.length;
    let active = 0;
    let online = 0;
    let offline = 0;
    let expired = 0;
    let preActive = 0;
    let expiring = 0;
    let expiringToday = 0;
    let expiredToday = 0;
    let expiring3d = 0;
    let expiring1w = 0;
    let disabled = 0;
    let newThisMonth = 0;
    let totalDataGB = 0;
    let requiredBalanceToday = 0;

    const pkgCounts: Record<string, number> = {};
    for (const p of state.packages) {
      pkgCounts[p.name] = 0;
    }

    for (const u of evaluatedUsers) {
      totalDataGB += u.dataUsedGB || 0;
      if (u.online) online++;
      if (isUserCreatedThisMonth(u)) newThisMonth++;
      if (u.package) pkgCounts[u.package] = (pkgCounts[u.package] || 0) + 1;

      const dayDiff = getDayDiffFromToday(u.expiry);
      if (u.status === 'Disabled') {
        disabled++;
      } else if (u.status === 'Pre-Active') {
        preActive++;
      } else if (u.status === 'Terminated') {
        // excluded
      } else if (u.status === 'Expired') {
        expired++;
        if (dayDiff === 0) {
          expiredToday++;
          const pkg = state.packages.find(p => p.name === u.package);
          requiredBalanceToday += pkg ? pkg.pricePerMonth : 0;
        }
      } else if (u.status === 'Active') {
        active++;
        if (!u.online) offline++;
        if (dayDiff !== null) {
          if (dayDiff === 0) {
            expiringToday++;
            const pkg = state.packages.find(p => p.name === u.package);
            requiredBalanceToday += pkg ? pkg.pricePerMonth : 0;
          }
          if (dayDiff >= 0 && dayDiff <= 3) expiring3d++;
          if (dayDiff >= 0 && dayDiff <= 7) expiring1w++;
          if (dayDiff >= 0 && dayDiff <= reminderDays) expiring++;
        }
      }
    }

    const todayStr = getRelativeDate(0);
    const todayPayments = state.payments.filter(p => toLocalDateKey(p.date) === todayStr);
    const todayCollection = todayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalInvoiced = state.payments.reduce((acc, p) => acc + (p.amount || 0), 0);

    const rankedPackages = Object.entries(pkgCounts)
      .map(([name, count]) => {
        const pkg = state.packages.find(p => p.name === name);
        return { name, count, price: pkg?.pricePerMonth ?? 0 };
      })
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.price - b.price))
      .slice(0, 4);

    const nasOnline = state.nasList.filter(n => n.status === 'Online').length;
    const activePackages = state.packages.filter(p => p.status === 'Active').length;

    return {
      total,
      active,
      online,
      offline,
      expired,
      preActive,
      expiring,
      expiringToday,
      expiredToday,
      expiring3d,
      expiring1w,
      disabled,
      newThisMonth,
      totalDataGB: Math.round(totalDataGB * 10) / 10,
      todayCollection,
      totalInvoiced,
      nasOnline,
      activePackages,
      expiryReminderDays: reminderDays,
      requiredBalanceToday,
      topPackages: rankedPackages,
    };
  }, [evaluatedUsers, state.payments, state.nasList, state.packages, state.settings?.expiryReminderDays]);

  const realNotifications = useMemo(() => {
    const items: Array<{ id: string; title: string; desc: string; time: string; type: 'urgent' | 'warning' | 'info' }> = [];
    const reminderDays = state.settings?.expiryReminderDays || 3;

    const expiringUsers = evaluatedUsers.filter(u => {
      if (u.status !== 'Active') return false;
      const diff = getDayDiffFromToday(u.expiry);
      return diff !== null && diff >= 0 && diff <= reminderDays;
    });

    if (expiringUsers.length > 0) {
      items.push({
        id: 'notif-expiring',
        title: `${expiringUsers.length} Subscribers Expiring Soon`,
        desc: `${expiringUsers.map(u => u.username).slice(0, 3).join(', ')}${expiringUsers.length > 3 ? '...' : ''} expire within ${reminderDays} days.`,
        time: 'Active now',
        type: 'warning',
      });
    }

    const expiredUsers = evaluatedUsers.filter(u => u.status === 'Expired');
    if (expiredUsers.length > 0) {
      items.push({
        id: 'notif-expired',
        title: `${expiredUsers.length} Expired Accounts`,
        desc: `${expiredUsers.map(u => u.username).slice(0, 3).join(', ')} require renewal to restore access.`,
        time: 'Immediate',
        type: 'urgent',
      });
    }

    const offlineNas = state.nasList.filter(n => n.status !== 'Online');
    if (offlineNas.length > 0 && hasPermission(state.authMe, 'nas.view')) {
      items.push({
        id: 'notif-nas',
        title: `NAS Router Offline: ${offlineNas[0].name}`,
        desc: `IP: ${offlineNas[0].ip}. Check ping or interface gateway.`,
        time: 'Just now',
        type: 'urgent',
      });
    }

    if (state.payments.length > 0 && hasPermission(state.authMe, 'revenue.view')) {
      items.push({
        id: 'notif-recent-pay',
        title: 'Recent Ledger Collection',
        desc: `${state.payments[0].username} Rs. ${state.payments[0].amount.toLocaleString()} (${state.payments[0].method})`,
        time: 'Recent',
        type: 'info',
      });
    }

    return items;
  }, [evaluatedUsers, state.nasList, state.payments, state.settings?.expiryReminderDays, state.authMe]);

  const totalBalancePKR = useMemo(() => {
    if (state.authMe?.radiusRole === 'Dealer' || state.authMe?.radiusRole === 'DealerStaff') {
      if (typeof state.authMe.balance === 'number') return state.authMe.balance;
      const myDealer = state.dealers.find(d => d.uid === (state.authMe?.dealerUid || state.authMe?.sub));
      if (myDealer) return myDealer.wallet_balance;
    }
    if (typeof state.serverStats?.balancePKR === 'number') {
      return state.serverStats.balancePKR;
    }
    let balance = 0;
    for (const p of state.payments) {
      if (p.type === 'Transfer') balance -= p.amount || 0;
      else balance += p.amount || 0;
    }
    return balance;
  }, [state.authMe, state.dealers, state.serverStats, state.payments]);

  const totalBalanceUSD = useMemo(() => totalBalancePKR / 280, [totalBalancePKR]);

  return {
    state,
    authMe: state.authMe,
    authLoading: state.authLoading,
    authError: state.authError,
    isLoading: state.isLoading,
    apiError: state.apiError,
    serviceUnavailable: state.serviceUnavailable,
    serviceUnavailableReason: state.serviceUnavailableReason,
    needsPasswordVerify: state.needsPasswordVerify,
    accessDenied: state.accessDenied,
    activeLineId: state.activeLineId,
    setActiveLineId,
    can,
    refreshAll,
    fetchDealerPrices,
    lines: state.lines,
    dealers: state.dealers,
    teamMembers: state.teamMembers,
    vlans: state.vlans,
    dealerPrices: state.dealerPrices,
    mainUsers: state.mainUsers,
    serverStats: state.serverStats,
    users: evaluatedUsers,
    packages: state.packages,
    vouchers: state.vouchers,
    payments: state.payments,
    managers: state.managers,
    nasList: state.nasList,
    logs: state.logs,
    settings: state.settings,
    packageUserCounts,
    stats,
    realNotifications,
    totalBalanceUSD,
    totalBalancePKR,
    // Actions
    createUserAsync,
    renewSubscriberAsync,
    addUser,
    updateUser,
    deleteUser,
    renewUser,
    renewSubscriber,
    toggleUserStatus,
    disconnectUser,
    toggleUserOnline,
    bulkRenew,
    bulkDisable,
    bulkDelete,
    addPackage,
    updatePackage,
    deletePackage,
    generateVouchers,
    deleteVouchers,
    redeemVoucher,
    addPayment,
    addManager,
    updateManager,
    deleteManager,
    addManagerBalance,
    addNas,
    updateNas,
    deleteNas,
    pingNas,
    addLog,
    clearLogs,
    resetDemoData,
    markAllNotificationsRead,
    updateSettings,
    exportData,
    importData,
  };
}
