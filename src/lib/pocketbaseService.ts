import { pb } from './pocketbase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification as AppNotification, ChatGroup, BrandingConfig, MonitorTarget, ComplaintReview } from '../types';
import { safeStringify } from './utils';

// Unified snake_case/camelCase mappings for GTS ISP schema tables in PocketBase
const mappings: Record<string, Record<string, string>> = {
  users: {
    uid: 'uid',
    username: 'username',
    password: 'password',
    role: 'role',
    fullName: 'full_name',
    createdAt: 'created_at',
    lastActive: 'last_active',
    dealerId: 'dealer_id',
    lineCode: 'line_code',
    createdBy: 'created_by',
    createdByName: 'created_by_name',
    companyName: 'company_name',
    status: 'status',
    profilePicture: 'profile_picture',
    email: 'email'
  },
  complaints: {
    id: 'complaint_id',
    memberId: 'member_id',
    memberName: 'member_name',
    customerName: 'customer_name',
    customerUsername: 'customer_username',
    area: 'area',
    description: 'description',
    number: 'phone_number',
    status: 'status',
    category: 'category',
    priority: 'priority',
    pkgDetails: 'pkg_details',
    userNearby: 'user_nearby',
    panelDetails: 'panel_details',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    remarks: 'remarks',
    remarkAuthorId: 'remark_author_id',
    remarkAuthorName: 'remark_author_name',
    customerReview: 'customer_review',
    reviews: 'customer_review',
    dealerId: 'dealer_id',
    scheduledAt: 'scheduled_at'
  },
  clients: {
    id: 'client_id',
    name: 'name',
    username: 'username',
    number: 'number',
    mobileNumber: 'mobile_number',
    seriesNumber: 'series_number',
    area: 'area',
    pkgDetails: 'pkg_details',
    userNearby: 'user_nearby',
    panelDetails: 'panel_details',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id',
    lat: 'lat',
    lng: 'lng'
  },
  chat_groups: {
    id: 'group_id',
    name: 'name',
    members: 'members',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id'
  },
  chat_messages: {
    id: 'message_id',
    senderId: 'sender_id',
    senderName: 'sender_name',
    text: 'text',
    audioUrl: 'audio_url',
    type: 'type',
    recipientId: 'recipient_id',
    isGroup: 'is_group',
    duration: 'duration',
    replyTo: 'reply_to',
    createdAt: 'created_at',
    seenBy: 'seen_by',
    dealerId: 'dealer_id'
  },
  notifications: {
    id: 'notification_id',
    type: 'type',
    message: 'message',
    authorName: 'author_name',
    createdAt: 'created_at',
    isRead: 'is_read',
    dealerId: 'dealer_id',
    details: 'details'
  },
  monitor_targets: {
    id: 'target_id',
    domain: 'domain',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id',
    lat: 'lat',
    lng: 'lng',
    label: 'label'
  },
  ledger_sheets: {
    id: 'sheet_id',
    recOfficer: 'rec_officer',
    recOfficerLabel: 'rec_officer_label',
    area: 'area',
    areaLabel: 'area_label',
    sheetDate: 'sheet_date',
    dateLabel: 'date_label',
    table1Rows: 'table1_rows',
    table2Rows: 'table2_rows',
    cashReceived: 'cash_received',
    sign: 'sign',
    submitted: 'submitted',
    cashReceivedLabel: 'cash_received_label',
    signLabel: 'sign_label',
    submittedLabel: 'submitted_label',
    footnoteLeft: 'footnote_left',
    footnoteRight: 'footnote_right',
    dealerId: 'dealer_id',
    createdAt: 'created_at',
    folderId: 'folder_id'
  },
  branding_config: {
    id: 'config_type',
    projectName: 'project_name',
    accentColor: 'accent_color',
    secondaryColor: 'secondary_color',
    themeColor: 'theme_color',
    fontFamily: 'font_family',
    borderRadius: 'border_radius',
    cardStyle: 'card_style',
    glassOpacity: 'glass_opacity',
    enableAnimations: 'enable_animations',
    logoUrl: 'logo_url',
    sidebarTheme: 'sidebar_theme',
    mascotPos: 'mascot_pos',
    hideBot: 'hide_bot',
    chatWelcomeMsg: 'chat_welcome_msg',
    dashboardSubtext: 'dashboard_subtext',
    updatedAt: 'updated_at',
    updatedBy: 'updated_by'
  }
};

function toDb(table: string, obj: any): any {
  if (!obj) return obj;
  const tableMapping = mappings[table];
  if (!tableMapping) return obj;
  const result: any = {};
  for (const [clientKey, dbKey] of Object.entries(tableMapping)) {
    if (obj[clientKey] !== undefined) {
      if (table === 'users' && clientKey === 'password' && (!obj[clientKey] || String(obj[clientKey]).trim() === '')) {
        continue;
      }
      if (table === 'users' && clientKey === 'email' && (!obj[clientKey] || String(obj[clientKey]).trim() === '')) {
        continue;
      }
      if (table === 'complaints' && clientKey === 'reviews') {
        result[dbKey] = Array.isArray(obj[clientKey]) ? JSON.stringify(obj[clientKey]) : obj[clientKey];
      } else {
        result[dbKey] = obj[clientKey];
      }
    }
  }

  if (table === 'chat_messages' && obj.seenBy) {
    if (typeof obj.seenBy === 'object' && !Array.isArray(obj.seenBy)) {
      result['seen_by'] = Object.keys(obj.seenBy);
    } else {
      result['seen_by'] = obj.seenBy;
    }
  }

  if (table === 'branding_config') {
    const rawPos = obj.mascotPos || { x: 0, y: 0 };
    result['mascot_pos'] = {
      x: typeof rawPos.x === 'number' ? rawPos.x : 0,
      y: typeof rawPos.y === 'number' ? rawPos.y : 0,
      customNames: obj.customNames || {},
      tabNames: obj.tabNames || {},
      hiddenTabs: obj.hiddenTabs || [],
      dashboardStats: obj.dashboardStats || [],
      homeSections: obj.homeSections || []
    };
  } else {
    for (const [key, val] of Object.entries(obj)) {
      const dbKey = tableMapping[key];
      if (!dbKey) {
        if (key !== 'reviews') {
          result[key] = val;
        }
      }
    }
  }
  return result;
}

export function fromDb(table: string, obj: any): any {
  if (!obj) return obj;
  const tableMapping = mappings[table];
  if (!tableMapping) return obj;
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val;
  }
  for (const [clientKey, dbKey] of Object.entries(tableMapping)) {
    if (obj[dbKey] !== undefined && obj[dbKey] !== null) {
      result[clientKey] = obj[dbKey];
    }
  }

  if (table === 'chat_messages') {
    const rawSeen = obj.seen_by || [];
    const seenByRecord: Record<string, { username: string; time: number }> = {};
    if (Array.isArray(rawSeen)) {
      rawSeen.forEach(uid => {
        seenByRecord[uid] = {
          username: uid,
          time: obj.created_at || Date.now()
        };
      });
    } else if (rawSeen && typeof rawSeen === 'object') {
      Object.assign(seenByRecord, rawSeen);
    }
    result.seenBy = seenByRecord;
  }

  if (table === 'complaints') {
    if (obj.customer_review) {
      const cr = String(obj.customer_review).trim();
      if (cr.startsWith('[')) {
        try {
          result.reviews = JSON.parse(cr);
        } catch (e) {
          result.reviews = [{
            id: 'legacy-err',
            text: String(obj.customer_review),
            createdAt: obj.created_at || Date.now()
          }];
        }
      } else {
        result.reviews = [{
          id: 'legacy-1',
          text: String(obj.customer_review),
          createdAt: obj.created_at || Date.now()
        }];
      }
    } else {
      result.reviews = [];
    }
  }

  if (table === 'branding_config') {
    const rawMascotPos = obj.mascot_pos || {};
    result['mascotPos'] = {
      x: typeof rawMascotPos.x === 'number' ? rawMascotPos.x : 4,
      y: typeof rawMascotPos.y === 'number' ? rawMascotPos.y : 88
    };
    result['customNames'] = rawMascotPos.customNames || {};
    result['tabNames'] = rawMascotPos.tabNames || {};
    result['hiddenTabs'] = rawMascotPos.hiddenTabs || [];
    result['dashboardStats'] = rawMascotPos.dashboardStats || [];
    result['homeSections'] = rawMascotPos.homeSections || [];
  }
  return result;
}

const globalTableSubscribers: Record<string, Set<(data: any[]) => void>> = {};
const globalTableCaches: Record<string, any[]> = {};

function subscribeTable(
  tableName: string,
  callback: (data: any[]) => void,
  mapRow: (row: any) => any = (row) => row,
  dealerId?: string
) {
  const syncKey = `${tableName}_${dealerId || 'all'}`;
  const pk = tableName === 'users' ? 'uid' : 'id';

  try {
    const cachedData = localStorage.getItem(`gts_cache_v3_${tableName}`);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed);
      }
    }
  } catch (e) {}

  const fetchInitial = async () => {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'all') {
        if (tableName === 'ledger_folders') {
          filter = `tenant_id = "${dealerId}"`;
        } else if (tableName === 'ledger_sheets') {
          filter = `dealer_id = "${dealerId}"`;
        } else {
          const hasDealerIdCol = !['branding_config'].includes(tableName);
          if (hasDealerIdCol) {
            filter = `dealer_id = "${dealerId}"`;
          }
        }
      }
      const records = await pb.collection(tableName).getFullList({ filter, sort: '-created' });
      const mapped = records.map(mapRow);
      try {
        localStorage.setItem(`gts_cache_v3_${tableName}`, JSON.stringify(mapped));
      } catch (e) {}
      globalTableCaches[syncKey] = mapped;
      callback(mapped);
    } catch (err) {
      console.warn(`Exception loading table ${tableName} from PB:`, err);
    }
  };

  fetchInitial();

  if (!globalTableSubscribers[syncKey]) {
    globalTableSubscribers[syncKey] = new Set();
  }
  globalTableSubscribers[syncKey].add(callback);

  pb.collection(tableName).subscribe('*', (e) => {
    let nextCache = globalTableCaches[syncKey] || [];
    const mappedRecord = mapRow(e.record);

    if (e.action === 'create') {
      if (!nextCache.find((r: any) => r[pk] === mappedRecord[pk])) {
        nextCache = [mappedRecord, ...nextCache];
      }
    } else if (e.action === 'update') {
      nextCache = nextCache.map((r: any) => r[pk] === mappedRecord[pk] ? mappedRecord : r);
    } else if (e.action === 'delete') {
      nextCache = nextCache.filter((r: any) => r[pk] !== mappedRecord[pk]);
    }

    globalTableCaches[syncKey] = nextCache;
    try {
      localStorage.setItem(`gts_cache_v3_${tableName}`, JSON.stringify(nextCache));
    } catch (err) {}
    globalTableSubscribers[syncKey].forEach(cb => cb(nextCache));
  }).catch(e => console.warn("PB Subscribe error:", e));

  return () => {
    globalTableSubscribers[syncKey]?.delete(callback);
    if (globalTableSubscribers[syncKey]?.size === 0) {
      pb.collection(tableName).unsubscribe('*').catch(() => {});
      delete globalTableSubscribers[syncKey];
      delete globalTableCaches[syncKey];
    }
  };
}

async function upsertPB(collectionName: string, idField: string, idValue: string, data: any) {
  try {
    let existingId: string | null = null;
    
    // 1. Try finding by PocketBase primary key 'id' if idValue looks like a valid 15-char PB id
    const isPbId = typeof idValue === 'string' && /^[a-z0-9]{15}$/.test(idValue);
    if (isPbId) {
      try {
        const record = await pb.collection(collectionName).getOne(idValue);
        if (record) {
          existingId = record.id;
        }
      } catch (err) {}
    }
    
    // 2. If not found by PB id, try finding by custom idField (fallback)
    if (!existingId && idField && idField !== 'id') {
      try {
        const record = await pb.collection(collectionName).getFirstListItem(`${idField} = "${idValue}"`);
        if (record) {
          existingId = record.id;
        }
      } catch (err) {}
    }
    
    // 3. Update or Create
    if (existingId) {
      return await pb.collection(collectionName).update(existingId, data);
    } else {
      const payload = { ...data };
      if (idField && idField !== 'id' && idField !== 'complaint_id' && idField !== 'client_id' && idField !== 'target_id' && idField !== 'notification_id') {
        payload[idField] = idValue;
      }
      if (isPbId) {
        payload.id = idValue;
      }
      return await pb.collection(collectionName).create(payload);
    }
  } catch (e: any) {
    let details = '';
    if (e.data && typeof e.data === 'object') {
      details = ` (Details: ${JSON.stringify(e.data)})`;
    }
    console.error(`upsertPB error for ${collectionName}:${details}`, e);
    throw e;
  }
}

function sanitize<T>(obj: T): T {
  const result: any = {};
  if (!obj) return obj;
  Object.keys(obj as any).forEach((key) => {
    const value = (obj as any)[key];
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
}

export interface SyncLog {
  id: string;
  timestamp: number;
  collection: string;
  action: 'create' | 'update' | 'delete' | 'sync' | 'migration';
  status: 'pending' | 'success' | 'failed';
  recordDetails?: string;
  errorMessage?: string;
}

let syncLogs: SyncLog[] = [];
try {
  const cached = localStorage.getItem('gts_sync_logs');
  if (cached) {
    syncLogs = JSON.parse(cached);
  }
} catch (e) {
  console.warn("Failed to read sync logs from localStorage", e);
}

function saveSyncLogsLocally() {
  try {
    localStorage.setItem('gts_sync_logs', JSON.stringify(syncLogs));
    window.dispatchEvent(new CustomEvent('gts-sync-logs-updated', { detail: syncLogs }));
  } catch (e) {
    console.warn("Failed to write sync logs to localStorage", e);
  }
}

export const pocketbaseService = {
  getSyncLogs(): SyncLog[] {
    return syncLogs;
  },

  clearSyncLogs() {
    syncLogs = [];
    saveSyncLogsLocally();
  },

  addSyncLog(collection: string, action: SyncLog['action'], status: SyncLog['status'], recordDetails?: string, errorMessage?: string): SyncLog {
    const log: SyncLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      collection,
      action,
      status,
      recordDetails,
      errorMessage
    };
    syncLogs.unshift(log);
    if (syncLogs.length > 200) {
      syncLogs = syncLogs.slice(0, 200);
    }
    saveSyncLogsLocally();
    return log;
  },

  saveSyncLogsLocally() {
    saveSyncLogsLocally();
  },

  testConnection: async () => {
    try {
      await pb.collection('complaints').getList(1, 1);
      console.log('PocketBase API client connected and verified successfully');
    } catch (error) {
      console.warn("PocketBase handshake failed or restricted:", error);
    }
  },

  getTenantId: (user: UserProfile) => {
    if (user.role === 'dealer') return user.uid;
    return user.dealerId || 'main';
  },
  
  getReadTenantId: (user: UserProfile) => {
    if (user.dealerId && user.dealerId !== 'main') {
      return user.dealerId;
    }
    if (user.role === 'dealer') return user.uid;
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'member' || user.role === 'editor' || user.role === 'liteadmin') return undefined;
    return user.dealerId || 'main';
  },

  waitForAuth: async (): Promise<any> => {
    return { uid: 'local_anon_user' };
  },

  compareTimestamps: (a: any, b: any, descending: boolean = true) => {
    const getTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
      if (val instanceof Date) return val.getTime();
      return 0;
    };
    const timeA = getTime(a);
    const timeB = getTime(b);
    if (timeA === 0 && descending) return -1;
    if (timeB === 0 && descending) return 1;
    return descending ? timeB - timeA : timeA - timeB;
  },

  parseTimestampToMillis: (val: any): number => {
    if (!val) return Date.now();
    if (typeof val === 'number') return val;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  },

  // --- CONFIG COLLECTIONS ---
  async getCategories(tenantId: string = 'main'): Promise<string[]> {
    try {
      const records = await pb.collection('categories_config').getFullList({ filter: `tenant_id = "${tenantId}"`, sort: 'value' });
      return records.map(r => r.value);
    } catch (e) {
      return [];
    }
  },

  async getStatuses(tenantId: string = 'main'): Promise<string[]> {
    try {
      const records = await pb.collection('statuses_config').getFullList({ filter: `tenant_id = "${tenantId}"`, sort: 'value' });
      return records.map(r => r.value);
    } catch (e) {
      return [];
    }
  },

  async getPriorities(tenantId: string = 'main'): Promise<string[]> {
    try {
      const records = await pb.collection('priority_config').getFullList({ filter: `tenant_id = "${tenantId}"`, sort: 'value' });
      return records.map(r => r.value);
    } catch (e) {
      return [];
    }
  },

  async getZones(tenantId: string = 'main'): Promise<string[]> {
    try {
      const records = await pb.collection('zone_config').getFullList({ filter: `tenant_id = "${tenantId}"`, sort: 'value' });
      return records.map(r => r.value);
    } catch (e) {
      return [];
    }
  },

  async saveConfigItems(collection: string, items: string[], tenantId: string = 'main') {
    try {
      const existing = await pb.collection(collection).getFullList({ filter: `tenant_id = "${tenantId}"` });
      const existingValues = existing.map(r => r.value);
      
      const toDelete = existing.filter(ex => !items.includes(ex.value));
      const toCreate = items.filter(item => !existingValues.includes(item));

      // Perform deletions and creations in parallel
      await Promise.all([
        ...toDelete.map(ex => pb.collection(collection).delete(ex.id).catch(() => {})),
        ...toCreate.map(item => pb.collection(collection).create({ value: item, label: item, tenant_id: tenantId }).catch(() => {}))
      ]);
    } catch (e: any) {
      if (e.message && e.message.includes('Missing collection context')) {
        console.warn(`PB: Collection "${collection}" does not exist. Relying on JSON configuration fallback in branding_config.`);
      } else {
        console.error(`PB: Failed to save to ${collection}`, e);
      }
    }
  },

  async syncAppConfig(config: any, tenantId: string = 'main') {
    const promises: Promise<any>[] = [];
    if (config.categories) promises.push(this.saveConfigItems('categories_config', config.categories, tenantId));
    if (config.statuses) promises.push(this.saveConfigItems('statuses_config', config.statuses, tenantId));
    if (config.priorities) promises.push(this.saveConfigItems('priority_config', config.priorities, tenantId));
    if (config.zones) promises.push(this.saveConfigItems('zone_config', config.zones, tenantId));
    await Promise.all(promises);
  },

  // --- BILLING CONFIG & RECOVERY SHEETS ---
  async getBillingMonths(dealerId: string = 'main') {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'main') {
        filter = `dealer_id = "${dealerId}"`;
      }
      
      // 1. Fetch from billing_rows (PRIMARY SOURCE since it bypasses the 403 on billing_months JSON cache)

      // 2. Fallback to billing_rows if billing_months was empty or failed
      let rowRecords: any[] = [];
      try {
        rowRecords = await pb.collection('billing_rows').getFullList({
          filter
        });
      } catch (err) {
        console.warn("PB: Failed to fetch billing from billing_rows:", err);
      }

      // 3. Fallback to users_data
      if (!rowRecords || rowRecords.length === 0) {
        try {
          rowRecords = await pb.collection('users_data').getFullList({
            filter
          });
        } catch (err) {
          console.warn("PB: Failed to fetch billing from users_data:", err);
        }
      }

      const monthMap = new Map<string, any>();
      if (rowRecords && rowRecords.length > 0) {
        // Group by month_id
        for (const r of rowRecords) {
          const monthId = r.month_id || 'UNKNOWN';
          if (!monthMap.has(monthId)) {
            monthMap.set(monthId, {
              id: monthId,
              dealerId: r.dealer_id || dealerId,
              rows: [],
              updatedAt: r.updated ? new Date(r.updated).getTime() : Date.now(),
              createdAt: r.created ? new Date(r.created).getTime() : Date.now()
            });
          }
          monthMap.get(monthId).rows.push({
            id: r.client_id || r.id,
            clientId: r.client_id || r.id,
            name: r.name || '',
            username: r.username || '',
            mobileNumber: r.mobile_number || '',
            area: r.area || '',
            rt: r.rt || '',
            baseAmount: Number(r.base_amount) || Number(r.base_amount === 0 ? 0 : (r.amount || 0)) || 0,
            cr: Number(r.cr) || 0,
            totalAmount: Number(r.total_amount) || 0,
            billingDay: r.billing_day || '5',
            paymentReceived: Number(r.payment_received) || 0,
            paymentStatus: r.payment_status || 'unpaid',
            comments: r.comments || '',
            occ: r.occ || '',
            serNam: r.ser_nam || '',
            pkgDetails: r.pkg_details || '',
            sag: r.sag || '',
            lai: r.lai || '',
            connectionDate: r.connection_date || '',
            devicePrice: r.device_price || '',
            abl: r.abl || '',
            network: r.network || ''
          });
        }
      }

      // Also fetch from billing_months to ensure empty months are included
      try {
        const emptyMonths = await pb.collection('billing_months').getFullList({ filter, sort: '-created' });
        for (const em of emptyMonths) {
          if (!monthMap.has(em.month_id)) {
            monthMap.set(em.month_id, {
              id: em.month_id,
              dealerId: em.dealer_id,
              rows: [],
              updatedAt: em.updated ? new Date(em.updated).getTime() : Date.now(),
              createdAt: em.created ? new Date(em.created).getTime() : Date.now()
            });
          }
        }
      } catch (e) {}

      return Array.from(monthMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error("PB: Failed to get billing months:", e);
      return [];
    }
  },

  getBillingMonthRowsDirect: async (monthId: string, dealerId: string = 'main') => {
    try {
      const filter = `month_id = "${monthId}" && dealer_id = "${dealerId}"`;
      const records = await pb.collection('billing_rows').getFullList({ filter });
      if (records && records.length > 0) {
        return records.map(r => ({
          id: r.client_id || r.id,
          clientId: r.client_id || r.id,
          name: r.name || '',
          username: r.username || '',
          mobileNumber: r.mobile_number || '',
          area: r.area || '',
          rt: r.rt || '',
          baseAmount: Number(r.base_amount) || Number(r.base_amount === 0 ? 0 : (r.amount || 0)) || 0,
          cr: Number(r.cr) || 0,
          totalAmount: Number(r.total_amount) || 0,
          billingDay: r.billing_day || '5',
          paymentReceived: Number(r.payment_received) || 0,
          paymentStatus: r.payment_status || 'unpaid',
          comments: r.comments || '',
          occ: r.occ || '',
          serNam: r.ser_nam || '',
          pkgDetails: r.pkg_details || '',
          sag: r.sag || '',
          lai: r.lai || '',
          connectionDate: r.connection_date || '',
          devicePrice: r.device_price || '',
          abl: r.abl || '',
          network: r.network || ''
        }));
      }
      return [];
    } catch (e) {
      console.warn("PB: Failed to fetch billing month rows directly:", e);
      return [];
    }
  },

  async createBillingMonth(monthId: string, rows: any[], createdBy: string, dealerId?: string) {
    await this.saveBillingMonth(monthId, rows, createdBy, dealerId || 'main');
  },

  _saveBillingMonthTimers: {} as Record<string, any>,
  _saveBillingMonthLatestRows: {} as Record<string, { rows: any[], updatedBy: string }>,

  async saveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', forceImmediate = false) {
    const key = `${monthId}_${dealerId}`;
    if (!this._saveBillingMonthLatestRows) {
      this._saveBillingMonthLatestRows = {};
    }
    this._saveBillingMonthLatestRows[key] = { rows, updatedBy };

    if (!this._saveBillingMonthTimers) {
      this._saveBillingMonthTimers = {};
    }

    if (forceImmediate) {
      if (this._saveBillingMonthTimers[key]) {
        clearTimeout(this._saveBillingMonthTimers[key]);
        delete this._saveBillingMonthTimers[key];
      }
      const latest = this._saveBillingMonthLatestRows[key];
      if (latest) {
        delete this._saveBillingMonthLatestRows[key];
        await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId);
      }
      return;
    }

    // Debounce the actual save to the cloud database by 1 second.
    // This provides instant UI feedback to the user on the page, while ensuring
    // that rapid sequential edits do not cause overlapping database locks or network congestion.
    return new Promise<void>((resolve, reject) => {
      if (this._saveBillingMonthTimers[key]) {
        clearTimeout(this._saveBillingMonthTimers[key]);
      }

      this._saveBillingMonthTimers[key] = setTimeout(async () => {
        try {
          const latest = this._saveBillingMonthLatestRows[key];
          if (latest) {
            delete this._saveBillingMonthLatestRows[key];
            await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId);
          }
          resolve();
        } catch (err) {
          console.error("PB: Debounced save failed:", err);
          reject(err);
        } finally {
          delete this._saveBillingMonthTimers[key];
        }
      }, 1000);
    });
  },

  async _executeSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main') {
    const logEntry = this.addSyncLog('billing_months', 'sync', 'pending', `Month: ${monthId}, Dealer: ${dealerId}, Rows count: ${rows.length}`);
    try {
      const filter = `month_id = "${monthId}" && dealer_id = "${dealerId}"`;
      
      let success = false;
      let errorMsg = '';
      // Try to save to billing_months, but wrap in try-catch so permission errors don't crash the save
      try {
        const existing = await pb.collection('billing_months').getList(1, 1, { filter });
        if (existing.items.length > 0) {
          await pb.collection('billing_months').update(existing.items[0].id, {
            rows_data: rows,
            updated_by: updatedBy
          });
        } else {
          await pb.collection('billing_months').create({
            month_id: monthId,
            dealer_id: dealerId,
            rows_data: rows,
            updated_by: updatedBy
          });
        }
        success = true;
        console.log("PB: Successfully saved to billing_months");
      } catch (err: any) {
        errorMsg = err.message || String(err);
        console.warn("PB: Failed to save to billing_months (expected due to security policies). Proceeding with rows sync. Detail:", err.message);
      }

      if (success) {
        logEntry.status = 'success';
        logEntry.recordDetails = `Saved sheet ${monthId} for Dealer ${dealerId} with ${rows.length} rows to billing_months collection.`;
        this.saveSyncLogsLocally();
      } else {
        logEntry.status = 'failed';
        logEntry.errorMessage = `Saved to individual rows, but failed on billing_months: ${errorMsg}`;
        this.saveSyncLogsLocally();
      }

      // Sync rows to billing_rows (fully await to ensure absolute persistence before returning)
      await this.syncBillingRows(monthId, dealerId, rows);
      console.log("PB: Sync of billing_rows completed successfully.");
    } catch (e: any) {
      console.error("PB: Failed to save billing month", e);
      logEntry.status = 'failed';
      logEntry.errorMessage = e.message || String(e);
      this.saveSyncLogsLocally();
    }
  },

  async deleteBillingMonth(monthId: string, dealerId: string = 'main') {
    const logEntry = this.addSyncLog('billing_months', 'delete', 'pending', `Deleting sheet Month: ${monthId}, Dealer: ${dealerId}`);
    try {
      const filter = `month_id = "${monthId}" && dealer_id = "${dealerId}"`;
      
      // Try to delete from billing_months
      try {
        const existing = await pb.collection('billing_months').getList(1, 1, { filter });
        if (existing.items.length > 0) {
          await pb.collection('billing_months').delete(existing.items[0].id);
        }
      } catch (err) {}

      // Delete from billing_rows
      const rowExisting = await pb.collection('billing_rows').getFullList({ filter });
      const deletePromises = rowExisting.map(row => pb.collection('billing_rows').delete(row.id).catch(() => {}));
      await Promise.all(deletePromises);

      // Delete from users_data (try/catch to avoid crashes since it is a Supabase table, not PocketBase)
      try {
        const udExisting = await pb.collection('users_data').getFullList({ filter });
        for (const row of udExisting) {
          await pb.collection('users_data').delete(row.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn("PB: Skipping delete from users_data collection (not present on this server).");
      }
      logEntry.status = 'success';
      logEntry.recordDetails = `Deleted sheet and all related rows from billing_rows.`;
      this.saveSyncLogsLocally();
    } catch (e: any) {
      console.error("PB: Failed to delete billing month", e);
      logEntry.status = 'failed';
      logEntry.errorMessage = e.message || String(e);
      this.saveSyncLogsLocally();
    }
  },

  async deleteAllBillingData(dealerId: string = 'main') {
    const logEntry = this.addSyncLog('billing_months', 'delete_all', 'pending', `Deleting all billing data for Dealer: ${dealerId}`);
    try {
      let filter = '';
      if (dealerId && dealerId !== 'main') {
        filter = `dealer_id = "${dealerId}"`;
      }

      const months = await pb.collection('billing_months').getFullList({ filter });
      for (const m of months) {
        await pb.collection('billing_months').delete(m.id).catch(() => {});
      }

      const rows = await pb.collection('billing_rows').getFullList({ filter });
      const rowPromises = rows.map(r => pb.collection('billing_rows').delete(r.id).catch(() => {}));
      await Promise.all(rowPromises);

      try {
        const uds = await pb.collection('users_data').getFullList({ filter });
        for (const u of uds) {
          await pb.collection('users_data').delete(u.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn("PB: Skipping delete all from users_data collection (not present on this server).");
      }

      logEntry.status = 'success';
      logEntry.recordDetails = `Deleted all billing sheets and individual rows from billing_rows for dealer: ${dealerId}`;
      this.saveSyncLogsLocally();
    } catch (e: any) {
      console.error("PB: Failed to delete all billing data", e);
      logEntry.status = 'failed';
      logEntry.errorMessage = e.message || String(e);
      this.saveSyncLogsLocally();
      throw e;
    }
  },

  async syncBillingRows(monthId: string, dealerId: string, rows: any[]) {
    const logRowsEntry = this.addSyncLog('billing_rows', 'sync', 'pending', `Syncing ${rows.length} rows for Month: ${monthId}`);
    const logUserDataEntry = this.addSyncLog('users_data', 'sync', 'pending', `Syncing ${rows.length} rows for Month: ${monthId}`);
    try {
      const filter = `month_id = "${monthId}" && dealer_id = "${dealerId}"`;
      
      let existingRows: any[] = [];
      try {
        existingRows = await pb.collection('billing_rows').getFullList({ filter });
      } catch (err: any) {
        console.warn("PB: Failed to fetch from billing_rows:", err.message);
      }

      // Map rows to PocketBase format
      const rawMappedRows = rows.map(r => {
        const rowId = r.clientId || r.id || `gen_${Math.random().toString(36).substring(2, 11)}`;
        return {
          month_id: monthId,
          dealer_id: dealerId,
          client_id: rowId,
          name: r.name || '',
          username: r.username || '',
          mobile_number: r.mobileNumber || r.mobile || '',
          area: r.area || '',
          rt: r.rt || '',
          base_amount: Number(r.baseAmount) || Number(r.amount) || 0,
          cr: Number(r.cr) || 0,
          total_amount: Number(r.totalAmount) || Number(r.total_amount) || 0,
          billing_day: r.billingDay || '5',
          payment_received: Number(r.paymentReceived) || Number(r.payment_received) || 0,
          payment_status: r.paymentStatus || 'unpaid',
          comments: r.comments || '',
          occ: r.occ || '',
          ser_nam: r.serNam || r.ser_nam || '',
          pkg_details: r.pkgDetails || r.pkg_details || '',
          sag: r.sag || '',
          lai: r.lai || '',
          connection_date: r.connectionDate || r.connection_date || '',
          device_price: (r.devicePrice !== undefined && r.devicePrice !== null && r.devicePrice !== '') ? Number(r.devicePrice) : ((r.device_price !== undefined && r.device_price !== null && r.device_price !== '') ? Number(r.device_price) : 0),
          abl: (r.abl !== undefined && r.abl !== null && r.abl !== '') ? Number(r.abl) : 0,
          network: r.network || '',
          updated_at: Date.now()
        };
      });

      // Deduplicate by client_id to prevent duplicate database constraints
      const uniqueMappedRowsMap = new Map<string, any>();
      for (const row of rawMappedRows) {
        if (row.client_id) {
          uniqueMappedRowsMap.set(row.client_id, row);
        }
      }
      const mappedRows = Array.from(uniqueMappedRowsMap.values());

      const existingMap = new Map();
      existingRows.forEach(r => existingMap.set(r.client_id, r));

      const creates: any[] = [];
      const updates: any[] = [];
      const keptIds = new Set();

      for (const newRow of mappedRows) {
        const ext = existingMap.get(newRow.client_id);
        keptIds.add(newRow.client_id);
        if (!ext) {
          creates.push(newRow);
        } else {
          // Compare relevant fields to see if update is needed
          const isChanged = 
            ext.payment_received !== newRow.payment_received ||
            ext.payment_status !== newRow.payment_status ||
            ext.cr !== newRow.cr ||
            ext.base_amount !== newRow.base_amount ||
            ext.total_amount !== newRow.total_amount ||
            ext.billing_day !== newRow.billing_day ||
            ext.comments !== newRow.comments ||
            ext.name !== newRow.name ||
            ext.username !== newRow.username ||
            ext.mobile_number !== newRow.mobile_number ||
            ext.area !== newRow.area ||
            ext.rt !== newRow.rt ||
            ext.occ !== newRow.occ ||
            ext.ser_nam !== newRow.ser_nam ||
            ext.pkg_details !== newRow.pkg_details ||
            ext.sag !== newRow.sag ||
            ext.lai !== newRow.lai ||
            ext.connection_date !== newRow.connection_date ||
            Number(ext.device_price) !== Number(newRow.device_price) ||
            Number(ext.abl) !== Number(newRow.abl) ||
            ext.network !== newRow.network;
            
          if (isChanged) {
            updates.push({ id: ext.id, data: newRow });
          }
        }
      }

      // Safeguard against destructive deletes from partial syncs (e.g., saving a single page of an A4 sheet)
      let deletes: string[] = [];
      if (existingRows.length > 30 && rows.length < existingRows.length * 0.4) {
        console.warn(`[SyncBillingRows] Safeguard triggered: incoming rows count (${rows.length}) is suspiciously low compared to existing rows (${existingRows.length}). Skipping deletes to protect against data loss.`);
      } else {
        deletes = existingRows.filter(r => !keptIds.has(r.client_id)).map(r => r.id);
      }

      let billingRowsSuccessCount = existingRows.length - deletes.length + creates.length;
      let billingRowsErrors: string[] = [];

      const runInBatches = async (items: any[], op: (item: any) => Promise<void>) => {
        const batchSize = 50;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          try {
            await Promise.all(batch.map(item => op(item).catch((err) => {
              let errorMsg = err.message || String(err);
              if (err.data && typeof err.data === 'object') {
                errorMsg += ` (Details: ${JSON.stringify(err.data)})`;
              }
              billingRowsErrors.push(errorMsg);
              console.error(`PB: Failed operation in billing_rows:`, errorMsg, err);
            })));
          } catch (batchErr: any) {
            billingRowsErrors.push(batchErr.message || String(batchErr));
          }
        }
      };

      await runInBatches(creates, (row) => pb.collection('billing_rows').create(row).then(() => {}));
      await runInBatches(updates, ({ id, data }) => pb.collection('billing_rows').update(id, data).then(() => {}));
      await runInBatches(deletes, (id) => pb.collection('billing_rows').delete(id).then(() => {}));

      if (billingRowsErrors.length === 0) {
        logRowsEntry.status = 'success';
        logRowsEntry.recordDetails = `Successfully synced changes to billing_rows. Created: ${creates.length}, Updated: ${updates.length}, Deleted: ${deletes.length}`;
      } else {
        logRowsEntry.status = 'failed';
        logRowsEntry.recordDetails = `Synced with errors. Created: ${creates.length}, Updated: ${updates.length}, Deleted: ${deletes.length}`;
        logRowsEntry.errorMessage = `Errors: ${billingRowsErrors.slice(0, 3).join(', ')}`;
      }

      logUserDataEntry.status = 'success';
      logUserDataEntry.recordDetails = `Synced billing records (users_data skipped as redundant).`;
      this.saveSyncLogsLocally();
      console.log(`PB: Successfully synced billing rows with smart diffing.`);

    } catch (e: any) {
      console.error("PB: Failed to sync billing rows", e);
      logRowsEntry.status = 'failed';
      logRowsEntry.errorMessage = e.message || String(e);
      logUserDataEntry.status = 'success';
      this.saveSyncLogsLocally();
    }
  },

  async migrateAllRowsToBillingMonths(): Promise<{ successCount: number; failedCount: number; message: string }> {
    const migrationLog = this.addSyncLog('billing_months', 'migration', 'pending', 'Scanning and migrating all existing billing_rows and users_data into billing_months collection...');
    try {
      // 1. Fetch all records from billing_rows
      let rowRecords: any[] = [];
      try {
        rowRecords = await pb.collection('billing_rows').getFullList({
          sort: '-created'
        });
      } catch (err: any) {
        console.warn("PB Migration: Failed to load from billing_rows:", err.message);
      }

      // 2. Fetch all records from users_data as fallback/secondary
      let udRecords: any[] = [];
      try {
        udRecords = await pb.collection('users_data').getFullList({
          sort: '-created'
        });
      } catch (err: any) {
        console.warn("PB Migration: Failed to load from users_data:", err.message);
      }

      // Combine them, avoiding duplicates
      const uniqueRowsMap = new Map<string, any>();
      const addRowToMap = (r: any) => {
        const monthId = r.month_id || 'UNKNOWN';
        const dealerId = r.dealer_id || 'main';
        const clientId = r.client_id || r.username || Math.random().toString(36).substring(2, 7);
        const key = `${monthId}_${dealerId}_${clientId}`;
        if (!uniqueRowsMap.has(key)) {
          uniqueRowsMap.set(key, r);
        }
      };

      rowRecords.forEach(addRowToMap);
      udRecords.forEach(addRowToMap);

      if (uniqueRowsMap.size === 0) {
        migrationLog.status = 'success';
        migrationLog.recordDetails = 'Migration complete: No existing rows found in billing_rows or users_data to migrate.';
        this.saveSyncLogsLocally();
        return { successCount: 0, failedCount: 0, message: 'No records found to migrate.' };
      }

      // Group by month_id + dealer_id
      const groups = new Map<string, { monthId: string; dealerId: string; rows: any[] }>();
      for (const r of uniqueRowsMap.values()) {
        const monthId = r.month_id || 'UNKNOWN';
        const dealerId = r.dealer_id || 'main';
        const groupKey = `${monthId}_${dealerId}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, { monthId, dealerId, rows: [] });
        }
        
        groups.get(groupKey)!.rows.push({
          id: r.client_id || r.username || '',
          clientId: r.client_id || '',
          name: r.name || '',
          username: r.username || '',
          mobileNumber: r.mobile_number || r.mobile || '',
          area: r.area || '',
          rt: r.rt || '',
          baseAmount: Number(r.base_amount) || Number(r.baseAmount) || Number(r.amount) || 0,
          cr: Number(r.cr) || 0,
          totalAmount: Number(r.total_amount) || Number(r.totalAmount) || 0,
          billingDay: r.billing_day || '5',
          paymentReceived: Number(r.payment_received) || Number(r.paymentReceived) || 0,
          paymentStatus: r.payment_status || 'unpaid',
          comments: r.comments || '',
          occ: r.occ || '',
          serNam: r.ser_nam || r.serNam || '',
          pkgDetails: r.pkg_details || r.pkgDetails || '',
          sag: r.sag || '',
          lai: r.lai || '',
          connectionDate: r.connection_date || r.connectionDate || '',
          devicePrice: r.device_price || r.devicePrice || '',
          abl: r.abl || '',
          network: r.network || ''
        });
      }

      let successCount = 0;
      let failedCount = 0;
      const failures: string[] = [];

      for (const group of groups.values()) {
        try {
          const filter = `month_id = "${group.monthId}" && dealer_id = "${group.dealerId}"`;
          const existing = await pb.collection('billing_months').getList(1, 1, { filter });
          if (existing.items.length > 0) {
            await pb.collection('billing_months').update(existing.items[0].id, {
              rows_data: group.rows,
              updated_by: 'Bulk Migration Agent'
            });
          } else {
            await pb.collection('billing_months').create({
              month_id: group.monthId,
              dealer_id: group.dealerId,
              rows_data: group.rows,
              updated_by: 'Bulk Migration Agent'
            });
          }
          successCount++;
          this.addSyncLog('billing_months', 'migration', 'success', `Migrated sheet: ${group.monthId} (Dealer: ${group.dealerId}) with ${group.rows.length} rows.`);
        } catch (err: any) {
          failedCount++;
          failures.push(`${group.monthId} (${err.message})`);
          this.addSyncLog('billing_months', 'migration', 'failed', `Failed migrating sheet: ${group.monthId} (Dealer: ${group.dealerId})`, err.message);
        }
      }

      migrationLog.status = failedCount === 0 ? 'success' : 'failed';
      migrationLog.recordDetails = `Migration finished. Migrated ${successCount} sheets successfully, failed ${failedCount}. Total rows consolidated: ${uniqueRowsMap.size}.`;
      if (failedCount > 0) {
        migrationLog.errorMessage = `Failed sheets: ${failures.join(', ')}`;
      }
      this.saveSyncLogsLocally();

      return {
        successCount,
        failedCount,
        message: `Successfully migrated ${successCount} sheets. Failed ${failedCount}. Consolidated ${uniqueRowsMap.size} rows.`
      };
    } catch (e: any) {
      console.error("PB Migration: Fatal error", e);
      migrationLog.status = 'failed';
      migrationLog.errorMessage = e.message || String(e);
      this.saveSyncLogsLocally();
      return { successCount: 0, failedCount: 0, message: `Fatal: ${e.message}` };
    }
  },

  // --- Users ---
  getUsers: async (dealerId?: string): Promise<UserProfile[]> => {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'all') {
        filter = `dealer_id = "${dealerId}"`;
      }
      const records = await pb.collection('users').getFullList({ filter });
      return records.map(row => fromDb('users', row));
    } catch (error) {
      return [];
    }
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    try {
      const record = await pb.collection('users').getFirstListItem(`uid = "${uid}"`);
      return record ? fromDb('users', record) : null;
    } catch (error) {
      return null;
    }
  },

  getNetworkOwnerByLineCode: async (lineCode: string): Promise<UserProfile | null> => {
    try {
      const record = await pb.collection('users').getFirstListItem(`line_code = "${lineCode}"`);
      return record ? fromDb('users', record) : null;
    } catch (error) {
      return null;
    }
  },

  createUser: async (uid: string, username: string, pass: string, role: UserProfile['role'], authorId?: string, authorName?: string, dealerId: string = 'main', lineCode?: string, companyName?: string, status: UserProfile['status'] = 'active'): Promise<UserProfile> => {
    const newUser: any = {
      uid,
      username,
      password: pass,
      role,
      createdAt: Date.now(),
      dealerId,
      createdBy: authorId,
      createdByName: authorName,
      status,
      ...(lineCode && { lineCode }),
      ...(companyName && { companyName })
    };
    try {
      const dbRow = toDb('users', newUser);
      await upsertPB('users', 'uid', uid, dbRow);
      
      if (authorName) {
        await pocketbaseService.createNotification({
          type: 'user_created',
          message: status === 'pending' 
            ? `New access request: ${username} via Google Identity (PENDING)`
            : `New identity registered: ${username} (${role.toUpperCase()})`,
          authorName,
          dealerId
        });
      }
      return newUser;
    } catch (error) {
      console.error('PB: createUser error:', error);
      throw error;
    }
  },

  updateUserStatus: async (uid: string, status: UserProfile['status'], authorName: string) => {
    try {
      const dbRow = toDb('users', { status });
      await upsertPB('users', 'uid', uid, dbRow);
      await pocketbaseService.createNotification({
        type: 'user_updated',
        message: `Identity status updated to ${status?.toUpperCase()} for UID: ${uid}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateUserStatus error:', error);
    }
  },

  deleteUser: async (uid: string, username: string, authorName: string) => {
    try {
      try {
        await pocketbaseService.saveToRecycleBin('users', uid, authorName);
      } catch (err) {}

      const user = await pocketbaseService.getUser(uid);
      if (user && user.role === 'dealer') {
        const dealerId = uid;
        const tablesToDelete = ['users', 'complaints', 'clients', 'chat_groups', 'chat_messages', 'notifications'];
        for (const tbl of tablesToDelete) {
          try {
            const records = await pb.collection(tbl).getFullList({ filter: `dealer_id = "${dealerId}"` });
            for (const r of records) {
              await pb.collection(tbl).delete(r.id).catch(() => {});
            }
          } catch (e) {}
        }
      }
      
      try {
        const record = await pb.collection('users').getFirstListItem(`uid = "${uid}"`);
        await pb.collection('users').delete(record.id);
      } catch (e) {}

      await pocketbaseService.createNotification({
        type: 'user_deleted',
        message: `Identity revoked: Access node for "${username}" purged`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteUser error:', error);
    }
  },

  updateUserPassword: async (uid: string, username: string, newPass: string, authorName: string) => {
    try {
      const dbRow = toDb('users', { password: newPass });
      await upsertPB('users', 'uid', uid, dbRow);
      await pocketbaseService.createNotification({
        type: 'user_updated',
        message: `Security credentials updated for user: ${username}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateUserPassword error:', error);
    }
  },

  updateUser: async (uid: string, data: Partial<UserProfile>, authorName: string) => {
    try {
      const dbRow = toDb('users', { ...data, uid });
      await upsertPB('users', 'uid', uid, dbRow);
      await pocketbaseService.createNotification({
        type: 'user_created',
        message: `User Profile updated: ${data.username || uid}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateUser error:', error);
    }
  },

  updateUserPresence: async (uid: string) => {
    try {
      const record = await pb.collection('users').getFirstListItem(`uid = "${uid}"`);
      if (record) {
        await pb.collection('users').update(record.id, { last_active: Date.now() });
      }
    } catch (error) {}
  },

  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      let currentConfig: any = null;
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
        if (record && record.dashboard_subtext) {
          currentConfig = JSON.parse(record.dashboard_subtext);
        }
      } catch (e) {}

      if (!currentConfig) {
        currentConfig = {};
      }

      try {
        const [cat, stat, prio, zone] = await Promise.all([
          pocketbaseService.getCategories(tenantId),
          pocketbaseService.getStatuses(tenantId),
          pocketbaseService.getPriorities(tenantId),
          pocketbaseService.getZones(tenantId)
        ]);
        if (cat && cat.length) currentConfig.categories = cat;
        if (stat && stat.length) currentConfig.statuses = stat;
        if (prio && prio.length) currentConfig.priorities = prio;
        if (zone && zone.length) currentConfig.zones = zone;
      } catch (e) {}

      return currentConfig;
    } catch (e) {
      return null;
    }
  },

  setTypingStatus: async (uid: string, username: string, isTyping: boolean, fullName?: string) => {
    // quiet bypass
  },

  subscribeTypingStatus: (callback: (typingUsers: { uid: string, username: string, fullName?: string }[]) => void) => {
    return () => {};
  },

  subscribeUsers: (callback: (users: UserProfile[]) => void, dealerId?: string) => {
    return subscribeTable('users', callback, (row) => fromDb('users', row), dealerId);
  },

  // --- Notifications ---
  createNotification: async (data: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> => {
    const cleanData = sanitize(data);
    const clientNotification: any = {
      ...cleanData,
      createdAt: Date.now(),
      isRead: false,
      dealerId: data.dealerId || 'main'
    };
    try {
      const dbRow = toDb('notifications', clientNotification);
      const createdRecord = await pb.collection('notifications').create(dbRow);
      return fromDb('notifications', createdRecord);
    } catch (error) {
      console.error('PB: createNotification error:', error);
      throw error;
    }
  },

  clearAllNotifications: async (dealerId?: string) => {
    try {
      const filter = dealerId ? `dealer_id = "${dealerId}"` : '';
      const records = await pb.collection('notifications').getFullList({ filter });
      for (const r of records) {
        await pb.collection('notifications').delete(r.id).catch(() => {});
      }
    } catch (error) {
      console.error('PB: clearAllNotifications error:', error);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      try {
        const record = await pb.collection('notifications').getFirstListItem(`notification_id = "${id}"`);
        await pb.collection('notifications').delete(record.id);
      } catch (e) {
        const record = await pb.collection('notifications').getFirstListItem(`id = "${id}"`);
        await pb.collection('notifications').delete(record.id);
      }
    } catch (error) {}
  },

  subscribeNotifications: (callback: (notifications: AppNotification[]) => void, dealerId?: string) => {
    return subscribeTable(
      'notifications',
      (notifications) => {
        let filtered = notifications;
        if (dealerId && dealerId !== 'main') {
          filtered = notifications.filter(n => n.dealerId === dealerId);
        } else if (dealerId === 'main') {
          filtered = notifications.filter(n => !n.dealerId || n.dealerId === 'main');
        }
        callback(filtered.sort((a, b) => b.createdAt - a.createdAt));
      },
      (row) => fromDb('notifications', row),
      dealerId
    );
  },

  // --- Complaints ---
  getComplaints: async (dealerId?: string): Promise<Complaint[]> => {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'all') {
        filter = `dealer_id = "${dealerId}"`;
      }
      const records = await pb.collection('complaints').getFullList({ filter });
      return records.map(row => fromDb('complaints', row)).sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      return [];
    }
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    const tenantId = pocketbaseService.getTenantId(member);
    const clientComplaint: any = {
      ...data,
      memberId: member.uid,
      memberName: member.fullName || member.username,
      createdAt: Date.now(),
      dealerId: tenantId
    };
    try {
      const dbRow = toDb('complaints', clientComplaint);
      const createdRecord = await pb.collection('complaints').create(dbRow);
      const persistedComplaint = fromDb('complaints', createdRecord);

      await pocketbaseService.createNotification({
        type: 'complaint_created',
        message: `New registry: ${persistedComplaint.customerName} - ${persistedComplaint.category}`,
        authorName: member.fullName || member.username,
        details: persistedComplaint,
        dealerId: tenantId || undefined
      });
      return persistedComplaint;
    } catch (error) {
      console.error('PB: createComplaint error:', error);
      throw error;
    }
  },

  verifyComplaintPersisted: async (id: string): Promise<boolean> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let record = null;
        try {
          record = await pb.collection('complaints').getOne(id);
        } catch (e) {
          record = await pb.collection('complaints').getFirstListItem(`id = "${id}"`);
        }
        if (record) {
          console.log(`[Verification] Successfully verified persistence of complaint ${id} in DB (attempt ${attempt})`);
          return true;
        }
      } catch (err) {
        console.warn(`[Verification] Attempt ${attempt} failed to verify complaint ${id} existence:`, err);
      }
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    return false;
  },

  deleteComplaint: async (id: string, customerName: string, authorName: string, dealerId: string = 'main') => {
    try {
      let recordId = '';
      let recordData = null;
      try {
        const record = await pb.collection('complaints').getOne(id);
        recordId = record.id;
        recordData = record;
      } catch (e) {
        try {
          const record = await pb.collection('complaints').getFirstListItem(`complaint_id = "${id}"`);
          recordId = record.id;
          recordData = record;
        } catch (e2) {
          try {
            const record = await pb.collection('complaints').getFirstListItem(`id = "${id}"`);
            recordId = record.id;
            recordData = record;
          } catch (e3) {}
        }
      }

      if (recordId) {
        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('complaints', id, authorName, dealerId, recordData);
          } catch (err) {}
        }
        await pb.collection('complaints').delete(recordId);
      } else {
        throw new Error(`Complaint record not found for ID: ${id}`);
      }

      await pocketbaseService.createNotification({
        type: 'complaint_deleted',
        message: `Registry removed: "${customerName}" protocol terminated`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteComplaint error:', error);
      throw error;
    }
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, remarks?: string, reviews?: ComplaintReview[]) => {
    try {
      const updateData: any = { 
        status, 
        updatedAt: Date.now(),
        ...(remarks && { remarks, remarkAuthorId: authorId, remarkAuthorName: authorName }),
        ...(reviews !== undefined && { reviews })
      };
      const dbRow = toDb('complaints', updateData);
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: `Status updated to ${status.toUpperCase()} for "${customerName}"${remarks ? ` - Remarks: ${remarks}` : ''}${reviews && reviews.length > 0 ? ` - Reviews count: ${reviews.length}` : ''}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaintStatus error:', error);
      throw error;
    }
  },

  updateComplaint: async (id: string, data: any, customerName: string, authorName: string) => {
    try {
      const dbRow = toDb('complaints', { ...data, updatedAt: Date.now() });
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: `Complaint details updated for "${data.customerName}"`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaint error:', error);
      throw error;
    }
  },

  updateComplaintRemarks: async (id: string, customerName: string, remarks: string, authorName: string, authorId: string) => {
    try {
      const updateData = { 
        remarks, 
        remarkAuthorId: authorId,
        remarkAuthorName: authorName,
        updatedAt: Date.now() 
      };
      const dbRow = toDb('complaints', updateData);
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: `Remarks updated for "${customerName}": ${remarks}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaintRemarks error:', error);
      throw error;
    }
  },

  syncOfflineComplaints: async (complaints: any[], authorName: string) => {
    try {
      if (!pb.authStore.isValid) return;
      
      for (const complaint of complaints) {
        const { id, ...data } = complaint;
        if (!id || String(id).startsWith('temp_')) {
          const dbRow = toDb('complaints', data);
          await pb.collection('complaints').create(dbRow);
        } else {
          const dbRow = toDb('complaints', data);
          await upsertPB('complaints', 'complaint_id', id, dbRow);
        }
      }
      
      await pocketbaseService.createNotification({
        type: 'complaint_created',
        message: `Synced ${complaints.length} offline registries`,
        authorName
      });
    } catch (error) {
      console.error('PB: syncOfflineComplaints error:', error);
    }
  },

  

  
  
  
  subscribeBranding: (callback: (config: any) => void) => {
    return subscribeTable(
      'branding_config',
      (configs) => {
        if (configs.length > 0) {
          callback(configs[0]);
        }
      },
      (row) => row
    );
  },

  subscribeConfig: (callback: (config: any) => void, dealerId?: string) => {
    return subscribeTable(
      'app_config',
      (configs) => {
        if (configs.length > 0) callback(configs[0]);
        else callback(null);
      },
      (row) => row,
      dealerId
    );
  },

  updateConfig: async (config: any, authorName: string, dealerId: string) => {
    try {
      const configType = dealerId === 'main' ? 'main' : `tenant_${dealerId}`;
      const dbRow = { ...config, config_type: configType, dealer_id: dealerId };
      await upsertPB('app_config', 'config_type', configType, dbRow);
    } catch (e) {
      console.error('updateConfig error:', e);
    }
  },


  subscribeGroups: (callback: (groups: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'chat_groups',
      callback,
      (row) => ({
        id: row.id,
        name: row.name,
        createdBy: row.created_by,
        dealerId: row.dealer_id,
        members: row.members ? JSON.parse(row.members) : []
      }),
      dealerId
    );
  },

  subscribeComplaints: (callback: (complaints: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'complaints',
      callback,
      (row) => fromDb('complaints', row),
      dealerId
    );
  },

  getClients: async (dealerId?: string) => {
    try {
      const filter = dealerId && dealerId !== 'main' ? `dealer_id = "${dealerId}"` : '';
      const records = await pb.collection('clients').getFullList({ filter });
      return records;
    } catch (error) {
      return [];
    }
  },

  subscribeMessages: (callback: (msgs: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'chat_messages',
      callback,
      (row) => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        receiverId: row.receiver_id,
        groupId: row.group_id,
        content: row.content,
        timestamp: row.created,
        seenBy: row.seen_by ? JSON.parse(row.seen_by) : [],
        type: row.type || 'text',
        audioUrl: row.audio_url || undefined
      }),
      dealerId
    );
  },

  saveComplaint: async (complaint: any, authorName: string) => {
    try {
      const dbRow = toDb('complaints', complaint);
      const record = await pb.collection('complaints').create(dbRow);
      return { id: record.id, ...complaint };
    } catch (error) {
      console.error('PB: saveComplaint error:', error);
      throw error;
    }
  },

  
  sendMessage: async (currentUser: any, text: string, replyData: any, recipientId?: string, isGroupChat?: boolean) => {
    try {
      await pb.collection('chat_messages').create({
        sender_id: currentUser.uid,
        sender_name: currentUser.fullName || currentUser.username,
        receiver_id: isGroupChat ? '' : (recipientId || 'global'),
        group_id: isGroupChat ? (recipientId || '') : '',
        content: text,
        type: 'text',
        seen_by: JSON.stringify([currentUser.uid]),
        reply_to: replyData ? JSON.stringify(replyData) : ''
      });
    } catch (error) {
      console.error('PB: sendMessage error:', error);
    }
  },

  sendVoiceMessage: async (currentUser: any, base64: string, duration: number, replyData: any, recipientId?: string, isGroupChat?: boolean) => {
    try {
      // Decode base64 to blob if needed, but here we can just save it as text/base64 in a long text field, 
      // or assuming we can just push it directly depending on schema. 
      // We will just store it in audio_url as base64 string for this fix, 
      // since the signature takes base64.
      await pb.collection('chat_messages').create({
        sender_id: currentUser.uid,
        sender_name: currentUser.fullName || currentUser.username,
        receiver_id: isGroupChat ? '' : (recipientId || 'global'),
        group_id: isGroupChat ? (recipientId || '') : '',
        content: `Voice message (${duration}s)`,
        type: 'voice',
        audio_url: base64,
        seen_by: JSON.stringify([currentUser.uid]),
        reply_to: replyData ? JSON.stringify(replyData) : ''
      });
    } catch (error) {
      console.error('PB: sendVoiceMessage error:', error);
    }
  },


  deleteMessage: async (msgId: string) => {
    try {
      await pb.collection('chat_messages').delete(msgId);
    } catch (error) {
      console.error('PB: deleteMessage error:', error);
    }
  },


  subscribeClients: (callback: (clients: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'clients',
      (clients) => {
        let filtered = clients;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        callback(filtered);
      },
      (row) => row,
      dealerId
    );
  },

  createClient: async (data: any, authorName: string, dealerId: string = 'main') => {
    try {
      const dbRow = toDb('clients', data);
      dbRow.dealer_id = dealerId;
      const record = await pb.collection('clients').create(dbRow);
      
      await pocketbaseService.createNotification({
        type: 'client_added',
        message: `Client directory established for "${data.name}"`,
        authorName
      });
      return { id: record.id, ...data };
    } catch (error) {
      console.error('PB: createClient error:', error);
      throw error;
    }
  },

  updateClient: async (id: string, updatedData: any, clientName: string, authorName: string) => {
    try {
      const dbRow = toDb('clients', updatedData);
      await upsertPB('clients', 'client_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'client_updated',
        message: `Client directory updated for "${clientName}"`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateClient error:', error);
      throw error;
    }
  },

  
  updateClientComplaints: async (clientName: string, updatedData: any) => {
    try {
      const records = await pb.collection('complaints').getFullList({
        filter: `customerName = "${clientName}"`
      });
      
      for (const record of records) {
        await pb.collection('complaints').update(record.id, {
          number: updatedData.number || record.number,
          address: updatedData.address || record.address,
          area: updatedData.area || record.area
        }).catch(() => {});
      }
    } catch (e) {
      console.error('PB: updateClientComplaints error:', e);
    }
  },

  updateBranding: async (branding: any, authorName: string) => {
    try {
      const dbRow = {
        config_type: 'branding',
        dashboard_title: branding.dashboardTitle,
        dashboard_subtext: branding.dashboardSubtext,
        theme_color: branding.themeColor,
        logo_url: branding.logoUrl,
        icon_type: branding.iconType,
        custom_icon_url: branding.customIconUrl,
        sidebar_color: branding.sidebarColor,
        background_style: branding.backgroundStyle,
        card_style: branding.cardStyle,
        font_family: branding.fontFamily,
        chart_style: branding.chartStyle,
        button_style: branding.buttonStyle,
        primary_color_hsl: branding.primaryColorHsl,
        accent_color_hsl: branding.accentColorHsl,
        dark_mode_preference: branding.darkModePreference
      };
      await upsertPB('branding_config', 'config_type', 'branding', dbRow);
      
      await pocketbaseService.createNotification({
        type: 'config_updated',
        message: 'System branding architecture reconfigured',
        authorName
      });
    } catch (error) {
      console.error('PB: updateBranding error:', error);
      throw error;
    }
  },

  createMonitorTarget: async (domain: string, user: any, label: string, lat?: number, lng?: number) => {
    try {
      const dealerId = user.role !== 'super_admin' ? user.dealerId : 'main';
      const record = await pb.collection('monitor_targets').create({
        domain,
        created_by: user.fullName || user.username,
        dealer_id: dealerId || 'main',
        label,
        lat: lat || 0,
        lng: lng || 0
      });
      return {
        id: record.id,
        domain: record.domain,
        createdBy: record.created_by,
        dealerId: record.dealer_id,
        label: record.label,
        lat: record.lat,
        lng: record.lng
      };
    } catch (error) {
      console.error('PB: createMonitorTarget error:', error);
      throw error;
    }
  },

  createGroup: async (name: string, members: string[], currentUser: any) => {
    try {
      const dealerId = currentUser.role !== 'super_admin' ? currentUser.dealerId : 'main';
      const record = await pb.collection('chat_groups').create({
        name,
        created_by: currentUser.uid,
        dealer_id: dealerId || 'main',
        members: JSON.stringify(members)
      });
      return {
        id: record.id,
        name: record.name,
        createdBy: record.created_by,
        dealerId: record.dealer_id,
        members: JSON.parse(record.members)
      };
    } catch (error) {
      console.error('PB: createGroup error:', error);
      throw error;
    }
  },

  deleteGroup: async (groupId: string) => {
    try {
      await pb.collection('chat_groups').delete(groupId);
    } catch (error) {
      console.error('PB: deleteGroup error:', error);
      throw error;
    }
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    try {
      const filter = isGroup 
        ? `group_id = "${scopeId}"`
        : `(sender_id = "${userId}" && receiver_id = "${scopeId}") || (sender_id = "${scopeId}" && receiver_id = "${userId}")`;
      
      const records = await pb.collection('chat_messages').getFullList({ filter });
      for (const record of records) {
        await pb.collection('chat_messages').delete(record.id).catch(() => {});
      }
    } catch (error) {
      console.error('PB: clearMessagesByScope error:', error);
    }
  },

  markAsSeen: async (messageId: string, userId: string, userName: string) => {
    try {
      const record = await pb.collection('chat_messages').getOne(messageId);
      const seenBy = record.seen_by ? JSON.parse(record.seen_by) : [];
      if (!seenBy.includes(userId)) {
        seenBy.push(userId);
        await pb.collection('chat_messages').update(messageId, {
          seen_by: JSON.stringify(seenBy)
        });
      }
    } catch (error) {
      console.error('PB: markAsSeen error:', error);
    }
  },

  deleteClient: async (id: string, clientName: string, authorName: string, dealerId: string = 'main') => {
    try {
      let recordId = '';
      let recordData = null;
      try {
        const record = await pb.collection('clients').getOne(id);
        recordId = record.id;
        recordData = record;
      } catch (e) {
        try {
          const record = await pb.collection('clients').getFirstListItem(`client_id = "${id}"`);
          recordId = record.id;
          recordData = record;
        } catch (e2) {
          try {
            const record = await pb.collection('clients').getFirstListItem(`id = "${id}"`);
            recordId = record.id;
            recordData = record;
          } catch (e3) {}
        }
      }

      if (recordId) {
        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('clients', id, authorName, dealerId, recordData);
          } catch (err) {}
        }
        await pb.collection('clients').delete(recordId);
      } else {
        throw new Error(`Client record not found for ID: ${id}`);
      }

      await pocketbaseService.createNotification({
        type: 'client_deleted',
        message: `Client deleted: "${clientName}"`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteClient error:', error);
      throw error;
    }
  },

  // --- Network Monitor DB endpoints ---
  
  getMonitorTargets: async (dealerId?: string): Promise<MonitorTarget[]> => {
    try {
      const filter = dealerId ? `(dealerId = "${dealerId}" || dealer_id = "${dealerId}")` : `dealer_id = "main"`;
      const records = await pb.collection('monitor_targets').getFullList({ filter });
      return records.map((r: any) => ({
        id: r.id,
        domain: r.domain,
        createdBy: r.created_by,
        createdAt: r.created,
        dealerId: r.dealer_id,
        lat: r.lat,
        lng: r.lng,
        label: r.label
      }));
    } catch (error) {
      return [];
    }
  },

  

  deleteMonitorTarget: async (id: string): Promise<void> => {
    try {
      try {
        await pocketbaseService.saveToRecycleBin('monitor_targets', id, 'admin');
      } catch (err) {}
      let record;
      try {
        record = await pb.collection('monitor_targets').getFirstListItem(`target_id = "${id}"`);
      } catch (e) {
        record = await pb.collection('monitor_targets').getFirstListItem(`id = "${id}"`);
      }
      await pb.collection('monitor_targets').delete(record.id);
    } catch (error) {
      console.error('PB: deleteMonitorTarget error:', error);
    }
  },

  updateMonitorTarget: async (id: string, updates: Partial<MonitorTarget>): Promise<void> => {
    try {
      const dbRow = toDb('monitor_targets', updates);
      await upsertPB('monitor_targets', 'target_id', id, dbRow);
    } catch (error) {
      console.error('PB: updateMonitorTarget error:', error);
    }
  },

  subscribeMonitorTargets: (callback: (targets: MonitorTarget[]) => void, dealerId?: string) => {
    return subscribeTable(
      'monitor_targets',
      (targets) => {
        let filtered = targets;
        if (dealerId) {
          if (dealerId === 'main') {
            filtered = targets.filter(t => !t.dealerId || t.dealerId === 'main');
          } else {
            filtered = targets.filter(t => t.dealerId === dealerId);
          }
        }
        callback(filtered.sort((a, b) => a.createdAt - b.createdAt));
      },
      (row) => fromDb('monitor_targets', row),
      dealerId
    );
  },

  // --- Backup & Restore ---
  getFullSystemBackup: async (exportedBy: string): Promise<any> => {
    try {
      const users = await pb.collection('users').getFullList();
      const complaints = await pb.collection('complaints').getFullList();
      const clients = await pb.collection('clients').getFullList();
      const notifications = await pb.collection('notifications').getFullList();
      
      return {
        version: "2.0-full",
        exportedAt: new Date().toISOString(),
        metadata: {
          system: "GreenTech Premium Wifi Complain Management",
          exportedBy: exportedBy || "Administrator"
        },
        data: {
          users: users.map(r => fromDb('users', r)),
          complaints: complaints.map(r => fromDb('complaints', r)),
          clients: clients.map(r => fromDb('clients', r)),
          notifications: notifications.map(r => fromDb('notifications', r)),
          billing: [],
          config: {},
          branding: {}
        }
      };
    } catch (error) {
      console.error("PB: Failed to generate system backup:", error);
      throw error;
    }
  },

  restoreFullSystemBackup: async (backupPkg: any, authorName: string): Promise<void> => {
    if (!backupPkg || backupPkg.version !== "2.0-full" || !backupPkg.data) {
      throw new Error("Invalid format.");
    }
    const { users = [], complaints = [], clients = [], notifications = [] } = backupPkg.data;
    try {
      for (const u of users) {
        await upsertPB('users', 'uid', u.uid, toDb('users', u));
      }
      for (const c of complaints) {
        await upsertPB('complaints', 'complaint_id', c.id, toDb('complaints', c));
      }
      for (const cl of clients) {
        await upsertPB('clients', 'client_id', cl.id, toDb('clients', cl));
      }
      for (const n of notifications) {
        await upsertPB('notifications', 'notification_id', n.id, toDb('notifications', n));
      }
    } catch (e) {
      console.error("PB: Failed backup restore:", e);
      throw e;
    }
  },

  // --- Billing Months ---
  subscribeBillingMonths: (callback: (months: any[]) => void, dealerId?: string) => {
    let debounceTimer: any = null;
    let cachedMonths: any[] = [];
    const fetchBillingMonths = async () => {
      try {
        const data = await pocketbaseService.getBillingMonths(dealerId || 'main');
        cachedMonths = data;
        callback(data);
      } catch (e) {
        callback([]);
      }
    };

    const triggerFetch = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        fetchBillingMonths();
      }, 1000); // 1-second debounce to absorb rapid successive updates
    };

    fetchBillingMonths();

    // Subscribe to billing_rows to get real-time updates when billing records change
    try {
      pb.collection('billing_rows').subscribe('*', (e) => {
        if (e.record && e.record.month_id && cachedMonths.length > 0) {
          const row = e.record;
          const mappedRow = {
            id: row.client_id || row.id,
            clientId: row.client_id || row.id,
            name: row.name || '',
            username: row.username || '',
            mobileNumber: row.mobile_number || '',
            area: row.area || '',
            rt: row.rt || '',
            baseAmount: Number(row.base_amount) || Number(row.base_amount === 0 ? 0 : (row.amount || 0)) || 0,
            cr: Number(row.cr) || 0,
            totalAmount: Number(row.total_amount) || 0,
            billingDay: row.billing_day || '5',
            paymentReceived: Number(row.payment_received) || 0,
            paymentStatus: row.payment_status || 'unpaid',
            comments: row.comments || '',
            occ: row.occ || '',
            serNam: row.ser_nam || '',
            pkgDetails: row.pkg_details || '',
            sag: row.sag || '',
            lai: row.lai || '',
            connectionDate: row.connection_date || '',
            devicePrice: row.device_price || '',
            abl: row.abl || '',
            network: row.network || ''
          };
          
          let updated = false;
          const newMonths = cachedMonths.map(m => {
            if (m.id === row.month_id) {
              const newRows = [...(m.rows || [])];
              const idx = newRows.findIndex(r => r.clientId === mappedRow.clientId);
              if (e.action === 'delete') {
                if (idx !== -1) {
                  newRows.splice(idx, 1);
                  updated = true;
                }
              } else {
                if (idx !== -1) {
                  newRows[idx] = mappedRow;
                  updated = true;
                } else {
                  newRows.push(mappedRow);
                  updated = true;
                }
              }
              return { ...m, rows: newRows };
            }
            return m;
          });
          
          if (updated) {
            cachedMonths = newMonths;
            callback(JSON.parse(JSON.stringify(newMonths)));
          }
        }
        triggerFetch();
      }).catch((e) => {
        console.warn("PB: billing_rows subscription error", e);
      });
    } catch (err) {}

    // Subscribe to users_data to get real-time updates when billing records change
    try {
      pb.collection('users_data').subscribe('*', () => {
        triggerFetch();
      }).catch((e) => {
        console.warn("PB: users_data subscription error", e);
      });
    } catch (err) {}

    // Also subscribe to billing_months as fallback
    try {
      pb.collection('billing_months').subscribe('*', () => {
        triggerFetch();
      }).catch((e) => {
        console.warn("PB: billing_months subscription error", e);
      });
    } catch (err) {}

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      try {
        pb.collection('billing_rows').unsubscribe('*').catch(() => {});
        pb.collection('users_data').unsubscribe('*').catch(() => {});
        pb.collection('billing_months').unsubscribe('*').catch(() => {});
      } catch (err) {}
    };
  },

  // --- Translations ---
  subscribeTranslations: (callback: (translations: any) => void) => {
    const fetchTranslations = async () => {
      try {
        const record = await pb.collection('branding_config').getFirstListItem('config_type = "translations"');
        if (record && record.dashboard_subtext) {
          callback(JSON.parse(record.dashboard_subtext));
        } else {
          callback({});
        }
      } catch (e) {
        callback({});
      }
    };
    fetchTranslations();
    pb.collection('branding_config').subscribe('*', (e) => {
      if (e.record.config_type === 'translations') fetchTranslations();
    }).catch(() => {});
    return () => {
      pb.collection('branding_config').unsubscribe('*').catch(() => {});
    };
  },

  updateTranslations: async (translations: any) => {
    try {
      const payload = {
        config_type: 'translations',
        dashboard_subtext: JSON.stringify(translations),
        updated_at: Date.now()
      };
      await upsertPB('branding_config', 'config_type', 'translations', payload);
    } catch (e) {
      console.error("PB: updateTranslations error:", e);
    }
  },

  // --- Ledger Folders ---
  subscribeLedgerFolders: (callback: (folders: any[]) => void, dealerId?: string) => {
    const resolvedId = dealerId || 'main';
    return subscribeTable('ledger_folders', callback, (row) => ({
      id: row.folder_id || row.id,
      name: row.name,
      connectedMonthId: row.connected_month_id || row.connectedMonthId || '',
      createdAt: row.created ? new Date(row.created).getTime() : Date.now()
    }), resolvedId);
  },

  subscribeLedgerSheetFolderMap: (callback: (map: any) => void, dealerId?: string) => {
    const resolvedId = dealerId || 'main';
    const docId = `ledger_sheet_map_${resolvedId}`;
    const fetchMap = async () => {
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
        const map = record.dashboard_subtext ? JSON.parse(record.dashboard_subtext) : {};
        callback(map);
      } catch (e) {
        callback({});
      }
    };
    fetchMap();
    
    const promise = pb.collection('branding_config').subscribe('*', (e) => {
      if (e.record.config_type === docId) {
        try {
          const map = e.record.dashboard_subtext ? JSON.parse(e.record.dashboard_subtext) : {};
          callback(map);
        } catch (err) {}
      }
    });

    return () => {
      promise.then(un => un()).catch(() => {});
    };
  },

  subscribeFolderMonthMap: (callback: (map: any) => void, dealerId?: string) => {
    const resolvedId = dealerId || 'main';
    const docId = `folder_month_map_${resolvedId}`;
    const fetchMap = async () => {
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
        const map = record.dashboard_subtext ? JSON.parse(record.dashboard_subtext) : {};
        callback(map);
      } catch (e) {
        callback({});
      }
    };
    fetchMap();

    const promise = pb.collection('branding_config').subscribe('*', (e) => {
      if (e.record.config_type === docId) {
        try {
          const map = e.record.dashboard_subtext ? JSON.parse(e.record.dashboard_subtext) : {};
          callback(map);
        } catch (err) {}
      }
    });

    return () => {
      promise.then(un => un()).catch(() => {});
    };
  },

  updateFolderMonthMap: async (map: any, tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    try {
      const docId = `folder_month_map_${resolvedId}`;
      const payload = {
        config_type: docId,
        dashboard_subtext: JSON.stringify(map)
      };
      await upsertPB('branding_config', 'config_type', docId, payload);
    } catch (e) {
      console.error("PB: updateFolderMonthMap error:", e);
    }
  },

  getLedgerFolders: async (tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    try {
      const records = await pb.collection('ledger_folders').getFullList({ filter: `tenant_id = "${resolvedId}"` });
      const map: any = {};
      records.forEach((r: any) => { map[r.folder_id] = r.name; });
      return map;
    } catch (e) {
      return {};
    }
  },

  saveLedgerFolders: async (folders: any[], tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    try {
      const existing = await pb.collection('ledger_folders').getFullList({ filter: `tenant_id = "${resolvedId}"` });
      const existingMap = new Map(existing.map(ex => [ex.folder_id, ex]));

      // Create or update
      for (const f of folders) {
        const folderId = f.id;
        const name = f.name;
        const connectedMonthId = f.connectedMonthId || '';
        const existRecord = existingMap.get(folderId);

        if (existRecord) {
          const hasChanged = existRecord.name !== name || (existRecord.connected_month_id || '') !== connectedMonthId;
          if (hasChanged) {
            await pb.collection('ledger_folders').update(existRecord.id, {
              name,
              connected_month_id: connectedMonthId
            }).catch(() => {});
          }
        } else {
          await pb.collection('ledger_folders').create({
            folder_id: folderId,
            name,
            connected_month_id: connectedMonthId,
            tenant_id: resolvedId
          }).catch(() => {});
        }
      }

      // Delete folders no longer in the state
      const folderIds = new Set(folders.map(f => f.id));
      for (const ex of existing) {
        if (!folderIds.has(ex.folder_id)) {
          await pb.collection('ledger_folders').delete(ex.id).catch(() => {});
        }
      }
    } catch (e) {
      console.error("PB: saveLedgerFolders error:", e);
    }
  },

  updateLedgerFolders: async (folders: any[], tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    await pocketbaseService.saveLedgerFolders(folders, resolvedId);
  },

  updateLedgerSheetFolderMap: async (map: any, tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    try {
      const docId = `ledger_sheet_map_${resolvedId}`;
      const payload = {
        config_type: docId,
        dashboard_subtext: JSON.stringify(map)
      };
      await upsertPB('branding_config', 'config_type', docId, payload);
    } catch (e) {
      console.error("PB: updateLedgerSheetFolderMap error:", e);
    }
  },

  // --- Google Sheet Links (Durable Persistence for Folder & Sheet Mappings) ---
  saveGoogleSheetLink: async (tenantId: string, folderId: string, sheetId: string) => {
    try {
      // 1. Try writing to google_sheet_links collection if it exists
      try {
        const payload = {
          tenant_id: tenantId,
          user_id: tenantId,
          folder_id: folderId,
          sheet_id: sheetId
        };
        let existingId: string | null = null;
        try {
          const record = await pb.collection('google_sheet_links').getFirstListItem(`tenant_id = "${tenantId}" && folder_id = "${folderId}"`);
          if (record) existingId = record.id;
        } catch (e) {
          try {
            const record = await pb.collection('google_sheet_links').getFirstListItem(`user_id = "${tenantId}" && folder_id = "${folderId}"`);
            if (record) existingId = record.id;
          } catch (e2) {}
        }

        if (existingId) {
          await pb.collection('google_sheet_links').update(existingId, payload);
        } else {
          await pb.collection('google_sheet_links').create(payload);
        }
      } catch (err) {
        console.warn("PocketBase: 'google_sheet_links' collection not found/available, falling back to branding_config", err);
      }

      // 2. Fallback / parallel write to folder_month_map in branding_config for total reliability
      const docId = `folder_month_map_${tenantId}`;
      let currentMap: Record<string, string> = {};
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
        currentMap = record.dashboard_subtext ? JSON.parse(record.dashboard_subtext) : {};
      } catch (e) {}

      currentMap[folderId] = sheetId;

      const payload = {
        config_type: docId,
        dashboard_subtext: JSON.stringify(currentMap)
      };
      await upsertPB('branding_config', 'config_type', docId, payload);
    } catch (e) {
      console.error("PB: saveGoogleSheetLink error:", e);
    }
  },

  getGoogleSheetLinks: async (tenantId: string) => {
    try {
      try {
        const records = await pb.collection('google_sheet_links').getFullList({
          filter: `tenant_id = "${tenantId}" || user_id = "${tenantId}"`
        });
        if (records && records.length > 0) {
          return records.map(r => ({
            tenantId: r.tenant_id || r.user_id,
            userId: r.user_id || r.tenant_id,
            folderId: r.folder_id,
            sheetId: r.sheet_id
          }));
        }
      } catch (err) {}

      const docId = `folder_month_map_${tenantId}`;
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
        const map = record.dashboard_subtext ? JSON.parse(record.dashboard_subtext) : {};
        return Object.entries(map).map(([folderId, sheetId]) => ({
          tenantId,
          userId: tenantId,
          folderId,
          sheetId: sheetId as string
        }));
      } catch (e) {
        return [];
      }
    } catch (e) {
      console.error("PB: getGoogleSheetLinks error:", e);
      return [];
    }
  },

  // --- Ledger Sheets ---
  getLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: `dealer_id = "${tenantId}"` });
      return records.map((r: any) => {
        const item = fromDb('ledger_sheets', r);
        item.id = r.id;
        item.createdAt = r.created_at || new Date(r.created).getTime();
        item.updatedAt = new Date(r.updated).getTime();
        return item;
      });
    } catch (e) {
      console.error("PB: getLedgerSheets error:", e);
      return [];
    }
  },

  subscribeLedgerSheets: (callback: (sheets: any[]) => void, dealerId?: string) => {
    const resolvedId = dealerId || 'main';
    return subscribeTable('ledger_sheets', callback, (r: any) => {
      const item = fromDb('ledger_sheets', r);
      item.id = r.id;
      item.createdAt = r.created_at || new Date(r.created).getTime();
      item.updatedAt = new Date(r.updated).getTime();
      return item;
    }, resolvedId);
  },

  saveLedgerSheet: async (sheet: any, tenantId?: string) => {
    const resolvedId = tenantId || 'main';
    try {
      const dbRow = toDb('ledger_sheets', sheet);
      dbRow.dealer_id = resolvedId;

      if (!dbRow.created_at) {
        dbRow.created_at = Date.now();
      }

      // Generate the sheet_subtext summary of all entries
      const summaryParts: string[] = [];
      const table1Rows = Array.isArray(sheet.table1Rows) ? sheet.table1Rows : [];
      table1Rows.forEach((r: any) => {
        const rowName = (r.name || '').trim();
        const comment = (r.comments || r.comment || '').trim();
        const amount = Number(r.amount) || 0;
        if (rowName || comment || amount > 0) {
          let str = `${rowName || 'N/A'}`;
          if (amount > 0) {
            str += ` - Rs. ${amount}`;
          }
          if (comment) {
            str += ` [Comments: ${comment}]`;
          }
          summaryParts.push(str);
        }
      });

      const table2Rows = Array.isArray(sheet.table2Rows) ? sheet.table2Rows : [];
      table2Rows.forEach((r: any) => {
        const rowName = (r.name || '').trim();
        const amount = Number(r.amount) || 0;
        if (rowName || amount > 0) {
          summaryParts.push(`[Total] ${rowName}: Rs. ${amount}`);
        }
      });

      dbRow.sheet_subtext = summaryParts.join('\n');

      let savedRecord: any = null;
      const isValidPbId = typeof sheet.id === 'string' && /^[a-z0-9]{15}$/.test(sheet.id);

      if (isValidPbId) {
        try {
          savedRecord = await pb.collection('ledger_sheets').update(sheet.id, dbRow);
        } catch (e) {
          savedRecord = await pb.collection('ledger_sheets').create(dbRow);
        }
      } else {
        savedRecord = await pb.collection('ledger_sheets').create(dbRow);
      }

      return fromDb('ledger_sheets', savedRecord);
    } catch (e) {
      console.error("PB: saveLedgerSheet error:", e);
      return null;
    }
  },

  terminateAllLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: `dealer_id = "${tenantId}"` });
      for (const r of records) {
        await pb.collection('ledger_sheets').delete(r.id).catch(() => {});
      }
    } catch (e) {
      console.error("PB: terminateAllLedgerSheets error:", e);
    }
  },

  deleteLedgerSheet: async (sheetId: string, authorName: string, tenantId: string = 'main') => {
    try {
      const isPbId = typeof sheetId === 'string' && /^[a-z0-9]{15}$/.test(sheetId);
      if (isPbId) {
        let recordData = null;
        try {
          recordData = await pb.collection('ledger_sheets').getOne(sheetId);
        } catch (e) {}

        if (recordData) {
          try {
            await pocketbaseService.saveToRecycleBin('ledger_sheets', sheetId, authorName, tenantId, recordData);
          } catch (err) {}
        }
        await pb.collection('ledger_sheets').delete(sheetId);
      }
    } catch (e) {
      console.error("PB: deleteLedgerSheet error:", e);
    }
  },

  // --- Recycle Bin ---
  saveToRecycleBin: async (tableName: string, recordId: string, authorName: string, dealerId?: string, extraData?: any) => {
    try {
      await pb.collection('recycle_bin').create({
        table_name: tableName,
        record_id: recordId,
        author_name: authorName || 'admin',
        dealer_id: dealerId || 'main',
        deleted_at: Date.now(),
        extra_data: extraData ? JSON.stringify(extraData) : ''
      });
    } catch (e) {}
  },
  
  restoreFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      const recycleRecord = await pb.collection('recycle_bin').getOne(recycleBinItemId);
      if (!recycleRecord || !recycleRecord.extra_data) {
        throw new Error("No extra data found to restore.");
      }
      
      const extraParsed = JSON.parse(recycleRecord.extra_data);
      const isFolder = recycleRecord.table_name === 'ledger_folder';
      
      if (isFolder) {
        const folder = extraParsed.originalData;
        const tenantId = extraParsed.dealerId || recycleRecord.dealer_id || 'main';
        
        // Fetch current folders
        const docId = `ledger_folders_${tenantId}`;
        let currentFolders = [];
        try {
          const res = await pb.collection('branding_config').getFirstListItem(`config_type = "${docId}"`);
          if (res && res.dashboard_subtext) {
            currentFolders = JSON.parse(res.dashboard_subtext);
          }
        } catch (e) {}
        
        currentFolders.push(folder);
        await pocketbaseService.saveLedgerFolders(currentFolders, tenantId);
        
      } else {
        const data = extraParsed.originalData ? extraParsed.originalData : extraParsed;
        const tableName = recycleRecord.table_name;
        
        try {
          await pb.collection(tableName).create(data);
        } catch (err) {
          const { id, created, updated, collectionId, collectionName, ...rest } = data;
          await pb.collection(tableName).create({ id, ...rest });
        }
      }
      
      // Clean up from recycle bin
      await pb.collection('recycle_bin').delete(recycleBinItemId);
      return true;
    } catch (e) {
      console.error("PB: restoreFromRecycleBin error:", e);
      throw e;
    }
  },
  permanentlyDeleteFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      await pb.collection('recycle_bin').delete(recycleBinItemId);
    } catch (e) {}
  },
  cleanOldRecycleBinItems: async () => {},

  subscribeRecycleBin: (callback: (items: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'recycle_bin',
      (items) => {
        let filtered = items;
        if (dealerId && dealerId !== 'main') {
          filtered = filtered.filter((n: any) => n.dealer_id === dealerId || n.dealerId === dealerId);
        }
        filtered.sort((a, b) => b.deleted_at - a.deleted_at);
        callback(filtered);
      },
      (row) => row, dealerId
    );
  }
};
