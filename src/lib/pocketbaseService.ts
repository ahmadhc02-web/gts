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
    createdAt: 'created_at'
  },
  branding_config: {
    id: 'config_id',
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
        const hasDealerIdCol = !['branding_config', 'ledger_folders', 'ledger_sheets'].includes(tableName);
        if (hasDealerIdCol) {
          filter = `dealer_id = "${dealerId}"`;
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
  } catch (e) {
    console.error(`upsertPB error for ${collectionName}:`, e);
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
      for (const ex of existing) {
        await pb.collection(collection).delete(ex.id).catch(() => {});
      }
      for (const item of items) {
        await pb.collection(collection).create({ value: item, label: item, tenant_id: tenantId }).catch(() => {});
      }
    } catch (e) {
      console.error(`PB: Failed to save to ${collection}`, e);
    }
  },

  async syncAppConfig(config: any, tenantId: string = 'main') {
    if (config.categories) await this.saveConfigItems('categories_config', config.categories, tenantId);
    if (config.statuses) await this.saveConfigItems('statuses_config', config.statuses, tenantId);
    if (config.priorities) await this.saveConfigItems('priority_config', config.priorities, tenantId);
    if (config.zones) await this.saveConfigItems('zone_config', config.zones, tenantId);
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

  async createBillingMonth(monthId: string, rows: any[], createdBy: string, dealerId?: string) {
    await this.saveBillingMonth(monthId, rows, createdBy, dealerId || 'main');
  },

  async saveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main') {
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

      // Always sync rows to billing_rows and users_data
      await this.syncBillingRows(monthId, dealerId, rows);
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
      const mappedRows = rows.map(r => ({
        month_id: monthId,
        dealer_id: dealerId,
        client_id: r.clientId || r.id || '',
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
        device_price: r.devicePrice || r.device_price || '',
        abl: r.abl || '',
        network: r.network || '',
        updated_at: Date.now()
      }));

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
            ext.device_price !== newRow.device_price ||
            ext.abl !== newRow.abl ||
            ext.network !== newRow.network;
            
          if (isChanged) {
            updates.push({ id: ext.id, data: newRow });
          }
        }
      }

      const deletes = existingRows.filter(r => !keptIds.has(r.client_id)).map(r => r.id);

      let billingRowsSuccessCount = existingRows.length - deletes.length + creates.length;
      let billingRowsErrors: string[] = [];

      const runInBatches = async (items: any[], op: (item: any) => Promise<void>) => {
        const batchSize = 20;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          try {
            await Promise.all(batch.map(item => op(item).catch((err) => {
              billingRowsErrors.push(err.message || String(err));
              console.error(`PB: Failed operation in billing_rows:`, err.message);
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
      await upsertPB('users', 'uid', uid, { status });
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
      await upsertPB('users', 'uid', uid, { password: newPass });
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
      await upsertPB('users', 'uid', uid, { last_active: Date.now() });
    } catch (error) {}
  },

  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      let currentConfig: any = null;
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_id = "${docId}"`);
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
        currentConfig.categories = cat;
        if (stat.length) currentConfig.statuses = stat;
        if (prio.length) currentConfig.priorities = prio;
        if (zone.length) currentConfig.zones = zone;
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

  deleteComplaint: async (id: string, customerName: string, authorName: string) => {
    try {
      try {
        await pocketbaseService.saveToRecycleBin('complaints', id, authorName);
      } catch (err) {}
      
      let recordId = '';
      try {
        const record = await pb.collection('complaints').getOne(id);
        recordId = record.id;
      } catch (e) {
        try {
          const record = await pb.collection('complaints').getFirstListItem(`complaint_id = "${id}"`);
          recordId = record.id;
        } catch (e2) {
          try {
            const record = await pb.collection('complaints').getFirstListItem(`id = "${id}"`);
            recordId = record.id;
          } catch (e3) {}
        }
      }

      if (recordId) {
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
    }
  },

  updateComplaintRemarks: async (id: string, remarks: string, customerName: string, authorName: string, authorId: string) => {
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
        message: `Protocol remarks revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaintRemarks error:', error);
    }
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, customerName: string, authorName: string) => {
    try {
      const dbRow = toDb('complaints', data);
      await upsertPB('complaints', 'complaint_id', id, dbRow);
      
      await pocketbaseService.createNotification({
        type: 'complaint_updated',
        message: `Registry modified: Data revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateComplaint error:', error);
    }
  },

  saveComplaint: async (complaint: Complaint, dealerId: string = 'main') => {
    try {
      const dbRow = toDb('complaints', complaint);
      await upsertPB('complaints', 'complaint_id', complaint.id, dbRow);
    } catch (error) {
      console.error('PB: saveComplaint error:', error);
    }
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void, dealerId?: string) => {
    return subscribeTable(
      'complaints',
      (complaints) => {
        callback(complaints.sort((a, b) => b.createdAt - a.createdAt));
      },
      (row) => fromDb('complaints', row),
      dealerId
    );
  },

  // --- Settings / Config ---
  getSettings: async () => {
    try {
      const data = await pocketbaseService.getAppConfig();
      return data;
    } catch (error) {
      return null;
    }
  },

  subscribeConfig: (callback: (config: any) => void, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    const fetchConfig = async () => {
      try {
        let currentConfig: any = null;
        try {
          const record = await pb.collection('branding_config').getFirstListItem(`config_id = "${docId}"`);
          if (record && record.dashboard_subtext) {
            currentConfig = JSON.parse(record.dashboard_subtext);
          }
        } catch (e) {}
        
        if (!currentConfig) {
          const cached = localStorage.getItem(`gts_config_${tenantId}`);
          if (cached) {
            try { currentConfig = JSON.parse(cached); } catch (e) {}
          }
        }
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
          currentConfig.categories = cat;
          if (stat.length) currentConfig.statuses = stat;
          if (prio.length) currentConfig.priorities = prio;
          if (zone.length) currentConfig.zones = zone;
        } catch (e) {}

        callback(currentConfig);
      } catch (e) {
        callback(null);
      }
    };
    
    fetchConfig();
    pb.collection('branding_config').subscribe('*', () => fetchConfig()).catch(() => {});
    pb.collection('categories_config').subscribe('*', () => fetchConfig()).catch(() => {});
    
    return () => {
      pb.collection('branding_config').unsubscribe('*').catch(() => {});
      pb.collection('categories_config').unsubscribe('*').catch(() => {});
    };
  },

  updateConfig: async (config: any, authorName: string, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      const cleanConfig = sanitize(config);
      localStorage.setItem(`gts_config_${tenantId}`, JSON.stringify(cleanConfig));
      const payload = {
        config_id: docId,
        dashboard_subtext: JSON.stringify(cleanConfig),
        updated_at: Date.now(),
        updated_by: authorName
      };
      await upsertPB('branding_config', 'config_id', docId, payload);
      await pocketbaseService.syncAppConfig(config, tenantId);
      
      await pocketbaseService.createNotification({
        type: 'config_updated',
        message: `System matrix configuration updated`,
        authorName,
        dealerId: tenantId === 'main' ? undefined : tenantId
      });
    } catch (error) {
      console.error("PB: updateConfig error:", error);
    }
  },

  // --- Branding ---
  subscribeBranding: (callback: (branding: BrandingConfig | null) => void) => {
    const fetchBranding = async () => {
      try {
        const record = await pb.collection('branding_config').getFirstListItem(`config_id = "branding"`);
        if (record) {
          callback(fromDb('branding_config', record));
        } else {
          callback(null);
        }
      } catch (e) {
        callback(null);
      }
    };
    fetchBranding();
    pb.collection('branding_config').subscribe('*', (e) => {
      if (e.record.config_id === 'branding') fetchBranding();
    }).catch(() => {});
    
    return () => {
      pb.collection('branding_config').unsubscribe('*').catch(() => {});
    };
  },

  updateBranding: async (branding: BrandingConfig, authorName: string) => {
    try {
      const cleanBranding = sanitize(branding);
      localStorage.setItem('gts_branding_v3', JSON.stringify(cleanBranding));
      const dbRow = toDb('branding_config', cleanBranding);
      await upsertPB('branding_config', 'config_id', 'branding', dbRow);
      
      await pocketbaseService.createNotification({
        type: 'config_updated',
        message: `Visual grid updated with premium design patterns`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateBranding error:', error);
    }
  },

  // --- Chat and Messages ---
  sendMessage: async (sender: UserProfile, text: string, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const tenantId = pocketbaseService.getTenantId(sender);
    const clientMsg: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text,
      type: 'text',
      recipientId: recipientId || '',
      isGroup: !!isGroup,
      replyTo: replyTo || null,
      createdAt: Date.now(),
      seenBy: {
        [sender.uid]: {
          username: sender.username || sender.fullName || 'User',
          time: Date.now()
        }
      },
      dealerId: tenantId
    };
    try {
      const dbRow = toDb('chat_messages', clientMsg);
      await pb.collection('chat_messages').create(dbRow);
      return clientMsg;
    } catch (error) {
      console.error('PB: sendMessage error:', error);
      throw error;
    }
  },

  sendVoiceMessage: async (sender: UserProfile, audioBase64: string, duration: number, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const tenantId = pocketbaseService.getTenantId(sender);
    const clientMsg: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text: '🎤 Voice Note',
      audioUrl: audioBase64,
      type: 'voice',
      recipientId: recipientId || '',
      isGroup: !!isGroup,
      duration,
      replyTo: replyTo || null,
      createdAt: Date.now(),
      seenBy: {
        [sender.uid]: {
          username: sender.username || sender.fullName || 'User',
          time: Date.now()
        }
      },
      dealerId: tenantId
    };
    try {
      const dbRow = toDb('chat_messages', clientMsg);
      await pb.collection('chat_messages').create(dbRow);
      return clientMsg;
    } catch (error) {
      console.error('PB: sendVoiceMessage error:', error);
      throw error;
    }
  },

  createGroup: async (name: string, members: string[], creator: UserProfile): Promise<ChatGroup> => {
    const id = `group_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = pocketbaseService.getTenantId(creator);
    const clientGroup: ChatGroup = {
      id,
      name,
      members,
      createdBy: creator.uid,
      createdAt: Date.now(),
      dealerId: tenantId
    };
    try {
      const dbRow = toDb('chat_groups', clientGroup);
      await pb.collection('chat_groups').create(dbRow);
      return clientGroup;
    } catch (error) {
      console.error('PB: createGroup error:', error);
      throw error;
    }
  },

  markAsSeen: async (messageId: string, uid: string, name: string) => {
    try {
      let record;
      try {
        record = await pb.collection('chat_messages').getFirstListItem(`message_id = "${messageId}"`);
      } catch (e) {
        record = await pb.collection('chat_messages').getFirstListItem(`id = "${messageId}"`);
      }
      const existingSeen = record.seen_by || [];
      if (!existingSeen.includes(uid)) {
        await pb.collection('chat_messages').update(record.id, {
          seen_by: [...existingSeen, uid]
        });
      }
    } catch (e) {}
  },

  deleteMessage: async (messageId: string) => {
    try {
      let record;
      try {
        record = await pb.collection('chat_messages').getFirstListItem(`message_id = "${messageId}"`);
      } catch (e) {
        record = await pb.collection('chat_messages').getFirstListItem(`id = "${messageId}"`);
      }
      await pb.collection('chat_messages').delete(record.id);
    } catch (e) {}
  },

  clearAllMessages: async (dealerId?: string) => {
    try {
      const filter = dealerId ? `dealer_id = "${dealerId}"` : '';
      const records = await pb.collection('chat_messages').getFullList({ filter });
      for (const r of records) {
        await pb.collection('chat_messages').delete(r.id).catch(() => {});
      }
    } catch (error) {
      console.error('PB: clearAllMessages error:', error);
    }
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    try {
      let record;
      try {
        record = await pb.collection('chat_groups').getFirstListItem(`group_id = "${groupId}"`);
      } catch (e) {
        record = await pb.collection('chat_groups').getFirstListItem(`id = "${groupId}"`);
      }
      await pb.collection('chat_groups').delete(record.id);
    } catch (e) {}
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    try {
      let filter = '';
      if (isGroup) {
        filter = `recipient_id = "${scopeId}" && is_group = true`;
      } else {
        filter = `((sender_id = "${userId}" && recipient_id = "${scopeId}") || (sender_id = "${scopeId}" && recipient_id = "${userId}")) && is_group = false`;
      }
      const records = await pb.collection('chat_messages').getFullList({ filter });
      for (const r of records) {
        await pb.collection('chat_messages').delete(r.id).catch(() => {});
      }
    } catch (e) {
      console.error('PB: clearMessagesByScope error:', e);
    }
  },

  subscribeGroups: (callback: (groups: ChatGroup[]) => void, dealerId?: string) => {
    return subscribeTable('chat_groups', callback, (row) => fromDb('chat_groups', row), dealerId);
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void, dealerId?: string) => {
    return subscribeTable('chat_messages', callback, (row) => fromDb('chat_messages', row), dealerId);
  },

  // --- Clients ---
  getClients: async (dealerId?: string): Promise<Client[]> => {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'all') {
        filter = `dealer_id = "${dealerId}"`;
      }
      const records = await pb.collection('clients').getFullList({ filter });
      return records.map(row => fromDb('clients', row)).sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main'): Promise<Client> => {
    const clientClient: any = {
      ...data,
      createdAt: Date.now(),
      createdBy: authorName,
      dealerId
    };
    try {
      const dbRow = toDb('clients', clientClient);
      const createdRecord = await pb.collection('clients').create(dbRow);
      const persistedClient = fromDb('clients', createdRecord);
      
      await pocketbaseService.createNotification({
        type: 'client_added',
        message: `New subscriber registered: "${data.name}" added by ${authorName}`,
        authorName,
        dealerId
      });
      return persistedClient;
    } catch (error) {
      console.error('PB: createClient error:', error);
      throw error;
    }
  },

  updateClient: async (id: string, data: Partial<Client>, clientName: string, authorName: string) => {
    try {
      const dbRow = toDb('clients', data);
      await upsertPB('clients', 'client_id', id, dbRow);
      await pocketbaseService.createNotification({
        type: 'client_updated',
        message: `Client details updated: "${clientName}" revised by ${authorName}`,
        authorName
      });
    } catch (error) {
      console.error('PB: updateClient error:', error);
    }
  },

  updateClientComplaints: async (originalUsername: string, updatedData: any) => {
    try {
      const filter = `customer_username = "${originalUsername}"`;
      const records = await pb.collection('complaints').getFullList({ filter });
      for (const r of records) {
        await pb.collection('complaints').update(r.id, {
          customer_name: updatedData.name,
          customer_username: updatedData.username,
          phone_number: updatedData.number || updatedData.mobileNumber || r.phone_number,
          pkg_details: updatedData.pkgDetails || r.pkg_details,
          user_nearby: updatedData.userNearby || r.user_nearby,
          panel_details: updatedData.panelDetails || r.panel_details,
          area: updatedData.area || r.area
        }).catch(() => {});
      }
    } catch (e) {
      console.error('PB: updateClientComplaints error:', e);
    }
  },

  deleteClient: async (id: string, clientName: string, authorName: string) => {
    try {
      try {
        await pocketbaseService.saveToRecycleBin('clients', id, authorName);
      } catch (err) {}

      let recordId = '';
      try {
        const record = await pb.collection('clients').getOne(id);
        recordId = record.id;
      } catch (e) {
        try {
          const record = await pb.collection('clients').getFirstListItem(`client_id = "${id}"`);
          recordId = record.id;
        } catch (e2) {
          try {
            const record = await pb.collection('clients').getFirstListItem(`id = "${id}"`);
            recordId = record.id;
          } catch (e3) {}
        }
      }

      if (recordId) {
        await pb.collection('clients').delete(recordId);
      }

      // Delete from billing_months collection
      try {
        const months = await pb.collection('billing_months').getFullList();
        for (const m of months) {
          const rows = m.rows_data;
          if (Array.isArray(rows)) {
            const initialLen = rows.length;
            const filteredRows = rows.filter((r: any) => r.clientId !== id && r.id !== id);
            if (filteredRows.length < initialLen) {
              await pb.collection('billing_months').update(m.id, {
                rows_data: filteredRows,
                updated_by: authorName || 'admin'
              });
            }
          }
        }
      } catch (err: any) {
        console.warn("PB: Failed to delete client rows from billing_months:", err.message);
      }

      // Delete from billing_rows collection
      try {
        const rows = await pb.collection('billing_rows').getFullList({
          filter: `client_id = "${id}"`
        });
        for (const r of rows) {
          await pb.collection('billing_rows').delete(r.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn("PB: Failed to delete from billing_rows:", err.message);
      }

      // Delete from users_data collection
      try {
        const uds = await pb.collection('users_data').getFullList({
          filter: `client_id = "${id}"`
        });
        for (const u of uds) {
          await pb.collection('users_data').delete(u.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn("PB: Failed to delete from users_data:", err.message);
      }

      try {
        const docs = await pb.collection('branding_config').getFullList({
          filter: `config_id ~ "billing_month_"`
        });
        for (const doc of docs) {
          if (doc.dashboard_subtext) {
            try {
              let rows = JSON.parse(doc.dashboard_subtext);
              if (Array.isArray(rows)) {
                const initialLength = rows.length;
                const filteredRows = rows.filter((r: any) => r.clientId !== id && r.id !== id);
                if (filteredRows.length < initialLength) {
                  await pb.collection('branding_config').update(doc.id, {
                    dashboard_subtext: JSON.stringify(filteredRows),
                    updated_at: Date.now(),
                    updated_by: authorName || 'admin'
                  });
                }
              }
            } catch (err) {}
          }
        }
      } catch (e) {}

      try {
        const sheets = await pb.collection('ledger_sheets').getFullList();
        for (const sh of sheets) {
          let updated = false;
          let table1 = sh.table1_rows;
          let table2 = sh.table2_rows;
          if (typeof table1 === 'string') {
            try { table1 = JSON.parse(table1); } catch (e) {}
          }
          if (typeof table2 === 'string') {
            try { table2 = JSON.parse(table2); } catch (e) {}
          }
          if (Array.isArray(table1)) {
            const initialLen = table1.length;
            table1 = table1.filter((r: any) => r.clientId !== id && r.id !== id);
            if (table1.length < initialLen) updated = true;
          }
          if (Array.isArray(table2)) {
            const initialLen = table2.length;
            table2 = table2.filter((r: any) => r.clientId !== id && r.id !== id);
            if (table2.length < initialLen) updated = true;
          }
          if (updated) {
            await pb.collection('ledger_sheets').update(sh.id, {
              table1_rows: JSON.stringify(table1),
              table2_rows: JSON.stringify(table2)
            });
          }
        }
      } catch (e) {}

      await pocketbaseService.createNotification({
        type: 'client_deleted',
        message: `Client record removed: "${clientName}" purged from database completely`,
        authorName
      });
    } catch (error) {
      console.error('PB: deleteClient error:', error);
    }
  },

  subscribeClients: (callback: (clients: Client[]) => void, dealerId?: string) => {
    return subscribeTable('clients', callback, (row) => fromDb('clients', row), dealerId);
  },

  // --- Service Monitor ---
  createMonitorTarget: async (domain: string, creator: UserProfile, label?: string, lat?: number, lng?: number): Promise<MonitorTarget> => {
    const tenantId = pocketbaseService.getTenantId(creator);
    const newTarget: any = {
      domain,
      createdBy: creator.uid,
      createdAt: Date.now(),
      dealerId: tenantId,
      ...(label ? { label } : {}),
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {})
    };
    try {
      const dbRow = toDb('monitor_targets', newTarget);
      const createdRecord = await pb.collection('monitor_targets').create(dbRow);
      return fromDb('monitor_targets', createdRecord);
    } catch (error) {
      console.error('PB: createMonitorTarget error:', error);
      throw error;
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
    const fetchBillingMonths = async () => {
      try {
        const data = await pocketbaseService.getBillingMonths(dealerId || 'main');
        callback(data);
      } catch (e) {
        callback([]);
      }
    };

    fetchBillingMonths();

    // Subscribe to billing_rows to get real-time updates when billing records change
    try {
      pb.collection('billing_rows').subscribe('*', () => {
        fetchBillingMonths();
      }).catch((e) => {
        console.warn("PB: billing_rows subscription error", e);
      });
    } catch (err) {}

    // Subscribe to users_data to get real-time updates when billing records change
    try {
      pb.collection('users_data').subscribe('*', () => {
        fetchBillingMonths();
      }).catch((e) => {
        console.warn("PB: users_data subscription error", e);
      });
    } catch (err) {}

    // Also subscribe to billing_months as fallback
    try {
      pb.collection('billing_months').subscribe('*', () => {
        fetchBillingMonths();
      }).catch((e) => {
        console.warn("PB: billing_months subscription error", e);
      });
    } catch (err) {}

    return () => {
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
        const record = await pb.collection('branding_config').getFirstListItem('config_id = "translations"');
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
      if (e.record.config_id === 'translations') fetchTranslations();
    }).catch(() => {});
    return () => {
      pb.collection('branding_config').unsubscribe('*').catch(() => {});
    };
  },

  updateTranslations: async (translations: any) => {
    try {
      const payload = {
        config_id: 'translations',
        dashboard_subtext: JSON.stringify(translations),
        updated_at: Date.now()
      };
      await upsertPB('branding_config', 'config_id', 'translations', payload);
    } catch (e) {
      console.error("PB: updateTranslations error:", e);
    }
  },

  // --- Ledger Folders ---
  subscribeLedgerFolders: (callback: (folders: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_folders', callback, (row) => ({
      id: row.folder_id || row.id,
      name: row.name,
      createdAt: row.created ? new Date(row.created).getTime() : Date.now()
    }), dealerId);
  },

  subscribeLedgerSheetFolderMap: (callback: (map: any) => void, dealerId?: string) => {
    const fetchMap = async () => {
      try {
        const records = await pb.collection('ledger_folders').getFullList({ filter: dealerId ? `tenant_id = "${dealerId}"` : '' });
        const map: any = {};
        records.forEach((r: any) => {
          map[r.folder_id] = r.name;
        });
        callback(map);
      } catch (e) {
        callback({});
      }
    };
    fetchMap();
    pb.collection('ledger_folders').subscribe('*', () => fetchMap()).catch(() => {});
    return () => {
      pb.collection('ledger_folders').unsubscribe('*').catch(() => {});
    };
  },

  getLedgerFolders: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_folders').getFullList({ filter: `tenant_id = "${tenantId}"` });
      const map: any = {};
      records.forEach((r: any) => { map[r.folder_id] = r.name; });
      return map;
    } catch (e) {
      return {};
    }
  },

  saveLedgerFolders: async (map: any, tenantId: string = 'main') => {
    try {
      const existing = await pb.collection('ledger_folders').getFullList({ filter: `tenant_id = "${tenantId}"` });
      for (const ex of existing) {
        await pb.collection('ledger_folders').delete(ex.id).catch(() => {});
      }
      for (const key in map) {
        await pb.collection('ledger_folders').create({ folder_id: key, name: map[key], tenant_id: tenantId }).catch(() => {});
      }
    } catch (e) {}
  },

  updateLedgerFolders: async (folders: any[], tenantId: string = 'main') => {
    const map: any = {};
    folders.forEach(f => {
      map[f.id] = f.name;
    });
    await pocketbaseService.saveLedgerFolders(map, tenantId);
  },

  updateLedgerSheetFolderMap: async (map: any, tenantId: string = 'main') => {
    // No-op to prevent overwriting the 'ledger_folders' collection.
    // Sheet folder associations are now saved directly inside individual sheets.
  },

  // --- Ledger Sheets ---
  getLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: `tenant_id = "${tenantId}"` });
      return records.map((r: any) => ({
        id: r.sheet_id,
        name: r.name,
        folderId: r.folder_id,
        rows: typeof r.rows_data === 'string' ? JSON.parse(r.rows_data) : r.rows_data,
        createdAt: new Date(r.created).getTime(),
        updatedAt: new Date(r.updated).getTime()
      }));
    } catch (e) {
      return [];
    }
  },

  subscribeLedgerSheets: (callback: (sheets: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_sheets', callback, (r: any) => ({
      id: r.sheet_id,
      name: r.name,
      folderId: r.folder_id,
      rows: typeof r.rows_data === 'string' ? JSON.parse(r.rows_data) : r.rows_data || [],
      createdAt: new Date(r.created).getTime(),
      updatedAt: new Date(r.updated).getTime()
    }), dealerId);
  },

  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    try {
      const filter = `sheet_id = "${sheet.id}" && tenant_id = "${tenantId}"`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      const payload = {
        sheet_id: sheet.id,
        name: sheet.name,
        folder_id: sheet.folderId,
        rows_data: JSON.stringify(sheet.rows),
        tenant_id: tenantId
      };
      if (existing.items.length > 0) {
        await pb.collection('ledger_sheets').update(existing.items[0].id, payload);
      } else {
        await pb.collection('ledger_sheets').create(payload);
      }
      return { id: sheet.id };
    } catch (e) {
      console.error("PB: saveLedgerSheet error:", e);
      return null;
    }
  },

  terminateAllLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const records = await pb.collection('ledger_sheets').getFullList({ filter: `tenant_id = "${tenantId}"` });
      for (const r of records) {
        await pb.collection('ledger_sheets').delete(r.id).catch(() => {});
      }
    } catch (e) {
      console.error("PB: terminateAllLedgerSheets error:", e);
    }
  },

  deleteLedgerSheet: async (sheetId: string, tenantId: string = 'main') => {
    try {
      const filter = `sheet_id = "${sheetId}" && tenant_id = "${tenantId}"`;
      const existing = await pb.collection('ledger_sheets').getList(1, 1, { filter });
      if (existing.items.length > 0) {
        await pb.collection('ledger_sheets').delete(existing.items[0].id);
      }
    } catch (e) {}
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
  
  restoreFromRecycleBin: async (recycleBinItemId: string) => {},
  permanentlyDeleteFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      await pb.collection('recycle_bin').delete(recycleBinItemId);
    } catch (e) {}
  },
  cleanOldRecycleBinItems: async () => {}
};
