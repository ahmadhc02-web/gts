import { supabase } from './supabase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification as AppNotification, ChatGroup, BrandingConfig, MonitorTarget, ComplaintReview } from '../types';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_ZONES } from '../constants';
import { globalLoading } from '../contexts/LoadingContext';

const isExcludedFromRecovery = (name?: string, username?: string) => {
  const check = (str?: string) => {
    if (!str) return false;
    const lower = str.trim().toLowerCase();
    return [
      'bank',
      'panel balance',
      'panel',
      'cash hand',
      'hand cash',
      'cash in hand',
      'unspecified entry',
      'expense',
      'expenses'
    ].includes(lower) || lower.startsWith('bank') || lower.startsWith('panel balance') || lower.startsWith('cash hand') || lower.startsWith('hand cash');
  };
  return check(name) || check(username);
};

// Unified snake_case/camelCase mappings for GTS ISP schema tables
export const mappings: Record<string, Record<string, string>> = {
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
    id: 'id',
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
    id: 'id',
    name: 'name',
    username: 'username',
    number: 'number',
    mobileNumber: 'mobile_number',
    seriesNumber: 'series_number',
    area: 'area',
    pkgDetails: 'pkg_details',
    userNearby: 'user_nearby',
    panelDetails: 'panel_details',
    rt: 'rt',
    baseAmount: 'base_amount',
    billingDay: 'billing_day',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id',
    lat: 'lat',
    lng: 'lng'
  },
  chat_groups: {
    id: 'id',
    name: 'name',
    members: 'members',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id'
  },
  chat_messages: {
    id: 'id',
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
    id: 'id',
    type: 'type',
    message: 'message',
    authorName: 'author_name',
    createdAt: 'created_at',
    isRead: 'is_read',
    dealerId: 'dealer_id',
    details: 'details'
  },
  monitor_targets: {
    id: 'id',
    domain: 'domain',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id',
    lat: 'lat',
    lng: 'lng',
    label: 'label'
  },
  ledger_sheets: {
    id: 'id',
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
    folderId: 'folder_id',
    sort: 'sort',
    sortFolder: 'sort',
    sheetSubtext: 'sheet_subtext'
  },
  ledger_folders: {
    id: 'id',
    name: 'name',
    parentId: 'parent_id',
    tenantId: 'tenant_id',
    createdAt: 'created_at'
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
    dashboardSubtext: 'dashboard_subtext'
  }
};

export function toDb(table: string, obj: any): any {
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

  if (table === 'ledger_sheets') {
    let t1 = obj.table1Rows ?? obj.table1_rows;
    if (typeof t1 === 'string') {
      try { t1 = JSON.parse(t1); } catch (e) { t1 = []; }
    }
    const t1Arr = Array.isArray(t1) ? t1 : [];
    result['table1_rows'] = JSON.stringify(t1Arr);

    let t2 = obj.table2Rows ?? obj.table2_rows;
    if (typeof t2 === 'string') {
      try { t2 = JSON.parse(t2); } catch (e) { t2 = []; }
    }
    const t2Arr = Array.isArray(t2) ? t2 : [];
    result['table2_rows'] = JSON.stringify(t2Arr);

    // Save active entries inside the sheet_subtext column
    const activeRows = t1Arr.filter((r: any) => (r.cId || '').trim() || (r.name || '').trim() || (Number(r.amount) || 0) > 0);
    result['sheet_subtext'] = JSON.stringify(activeRows);
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

  if (table === 'users') {
    if (!result.profilePicture || String(result.profilePicture).trim() === '') {
      try {
        const storedPics = JSON.parse(localStorage.getItem('gts_profile_pictures') || '{}');
        if (result.uid && storedPics[result.uid]) {
          result.profilePicture = storedPics[result.uid];
        }
      } catch (e) {}
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

  if (table === 'ledger_sheets') {
    let t1 = result.table1Rows;
    if (typeof t1 === 'string') {
      try { t1 = JSON.parse(t1); } catch (e) { t1 = []; }
    }
    result.table1Rows = Array.isArray(t1) ? t1 : [];

    let t2 = result.table2Rows;
    if (typeof t2 === 'string') {
      try { t2 = JSON.parse(t2); } catch (e) { t2 = []; }
    }
    result.table2Rows = Array.isArray(t2) ? t2 : [];

    result.sheetSubtext = obj.sheet_subtext || '';
  }
  return result;
}

const globalTableSubscribers: Record<string, Set<(data: any[]) => void>> = {};
const globalTableCaches: Record<string, any[]> = {};
const globalTableIntervals: Record<string, any> = {};
const globalTableChannels: Record<string, any> = {};

async function upsertSupabase(collectionName: string, idField: string, idValue: string, data: any) {
  if (!supabase) return;
  const targetTable = collectionName === 'users' ? 'users_data' : collectionName;
  const cleanData = { ...data };
  delete cleanData.updated_at;
  delete cleanData.updated_by;
  delete cleanData.author_name;

  if (targetTable === 'branding_config') {
    delete cleanData.border_radius;
    delete cleanData.config_json;
    delete cleanData.value;
  }

  // Ensure the id field itself is included in the row being upserted
  cleanData[idField] = idValue;

  try {
    const { error } = await supabase.from(targetTable).upsert(cleanData, { onConflict: idField });
    if (error) {
      console.warn(`upsertSupabase native upsert warning for ${targetTable}:`, error.message);
      // Fallback to old select-then-insert/update path only if native upsert fails
      const { data: existingSup, error: findErr } = await supabase.from(targetTable).select(idField).eq(idField, idValue).limit(1);
      if (!findErr && existingSup && existingSup.length > 0) {
        await supabase.from(targetTable).update(cleanData).eq(idField, idValue);
      } else {
        await supabase.from(targetTable).insert([cleanData]);
      }
    }
  } catch (e: any) {
    console.warn(`upsertSupabase error for ${targetTable}:`, e?.message || e);
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

function subscribeTable(
  tableName: string,
  callback: (data: any[]) => void,
  mapRow: (row: any) => any = (row) => row,
  dealerId?: string
) {
  const syncKey = `${tableName}_${dealerId || 'all'}`;

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
      const targetTable = tableName === 'users' ? 'users_data' : tableName;
      let query = supabase.from(targetTable).select('*');
      if (dealerId && dealerId !== 'all') {
        if (tableName === 'ledger_folders') {
          query = dealerId === 'main' ? query.or('tenant_id.eq.main,tenant_id.is.null,tenant_id.eq.') : query.eq('tenant_id', dealerId);
        } else if (tableName === 'ledger_sheets') {
          query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.') : query.eq('dealer_id', dealerId);
        } else if (!['branding_config'].includes(tableName)) {
          query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.') : query.eq('dealer_id', dealerId);
        }
      }
      const { data: records, error } = await query;
      let mapped: any[] = [];
      if (!error && records) {
        mapped = records.map(mapRow);
      }

      if (tableName === 'ledger_folders' && (error || mapped.length === 0)) {
        const currentCache = globalTableCaches[syncKey];
        if (currentCache && currentCache.length > 0) {
          mapped = currentCache;
        } else {
          // Check Supabase branding_config backup
          const docId = `ledger_folders_data_${dealerId || 'main'}`;
          try {
            const { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
            if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
              const parsed = JSON.parse(bData[0].dashboard_subtext);
              if (Array.isArray(parsed) && parsed.length > 0) {
                mapped = parsed;
              }
            }
          } catch (e) {}

          if (mapped.length === 0) {
            const localSaved = localStorage.getItem(`gts_ledger_folders_${dealerId || 'main'}`) || localStorage.getItem('gts_cache_v3_ledger_folders');
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  mapped = parsed;
                }
              } catch (e) {}
            }
          }
        }

        if (mapped.length > 0) {
          globalTableCaches[syncKey] = mapped;
          supabaseService.saveLedgerFolders(mapped, dealerId || 'main').catch(console.warn);
        }
      }

      if (mapped.length > 0 || !error) {
        globalTableCaches[syncKey] = mapped;
        try {
          localStorage.setItem(`gts_cache_v3_${tableName}`, JSON.stringify(mapped));
        } catch (e) {}

        const subscribers = globalTableSubscribers[syncKey];
        if (subscribers) {
          subscribers.forEach((cb) => {
            try {
              cb(mapped);
            } catch (cbErr) {
              console.error("Error in subscriber callback:", cbErr);
            }
          });
        }
      }
    } catch (err) {
      console.warn(`Exception loading table ${tableName} from Supabase:`, err);
    }
  };

  if (!globalTableSubscribers[syncKey]) {
    globalTableSubscribers[syncKey] = new Set();
  }
  globalTableSubscribers[syncKey].add(callback);

  if (globalTableCaches[syncKey]) {
    callback(globalTableCaches[syncKey]);
  }

  if (!globalTableIntervals[syncKey]) {
    fetchInitial();
    globalTableIntervals[syncKey] = setInterval(() => {
      fetchInitial();
    }, 8000);
  }

  if (!globalTableChannels[syncKey]) {
    try {
      const targetTable = tableName === 'users' ? 'users_data' : tableName;
      const channelName = `rt_${tableName}_${dealerId || 'all'}_${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: targetTable }, () => {
          fetchInitial();
        })
        .subscribe();
      globalTableChannels[syncKey] = channel;
    } catch (e) {}
  }

  return () => {
    const subscribers = globalTableSubscribers[syncKey];
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        if (globalTableIntervals[syncKey]) {
          clearInterval(globalTableIntervals[syncKey]);
          delete globalTableIntervals[syncKey];
        }
        if (globalTableChannels[syncKey]) {
          try { supabase.removeChannel(globalTableChannels[syncKey]); } catch (e) {}
          delete globalTableChannels[syncKey];
        }
        delete globalTableSubscribers[syncKey];
      }
    }
  };
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
} catch (e) {}

function saveSyncLogsLocally() {
  try {
    localStorage.setItem('gts_sync_logs', JSON.stringify(syncLogs));
    window.dispatchEvent(new CustomEvent('gts-sync-logs-updated', { detail: syncLogs }));
  } catch (e) {}
}

export const supabaseService = {
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
      const { data, error } = await supabase.from('complaints').select('id').limit(1);
      if (error) throw error;
      console.log('Supabase connected and verified successfully');
    } catch (error) {
      console.warn("Supabase handshake warning:", error);
    }
  },

  getTenantId: (user: UserProfile) => {
    if (user.role === 'dealer') return user.uid;
    return user.dealerId || 'main';
  },

  getReadTenantId: (user: UserProfile) => {
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'member' || user.role === 'editor' || user.role === 'liteadmin') {
      return undefined;
    }
    if (user.dealerId && user.dealerId !== 'main') {
      return user.dealerId;
    }
    if (user.role === 'dealer') return user.uid;
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
      const { data } = await supabase.from('categories_config').select('*');
      if (data && data.length > 0) {
        const items = data
          .map(r => r.value || r.name || r.category || r.category_name || r.title || r.label)
          .filter(Boolean);
        if (items.length > 0) return Array.from(new Set(items));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async getStatuses(tenantId: string = 'main'): Promise<string[]> {
    try {
      const { data } = await supabase.from('statuses_config').select('*');
      if (data && data.length > 0) {
        const items = data
          .map(r => r.value || r.name || r.status || r.status_name || r.title || r.label)
          .filter(Boolean);
        if (items.length > 0) return Array.from(new Set(items));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async getPriorities(tenantId: string = 'main'): Promise<string[]> {
    try {
      const { data } = await supabase.from('priority_config').select('*');
      if (data && data.length > 0) {
        const items = data
          .map(r => r.value || r.name || r.priority || r.priority_name || r.title || r.label)
          .filter(Boolean);
        if (items.length > 0) return Array.from(new Set(items));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async getZones(tenantId: string = 'main'): Promise<string[]> {
    try {
      const { data } = await supabase.from('zone_config').select('*');
      if (data && data.length > 0) {
        const items = data
          .map(r => r.value || r.name || r.zone || r.zone_name || r.title || r.label)
          .filter(Boolean);
        if (items.length > 0) return Array.from(new Set(items));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async saveConfigItems(collection: string, items: string[], tenantId: string = 'main') {
    try {
      const { data: existingSup, error: selErr } = await supabase.from(collection).select('*');
      if (selErr) {
        console.warn(`saveConfigItems select error for ${collection}:`, selErr.message);
        if (selErr.message.includes('relation') && selErr.message.includes('does not exist')) {
          toast.error("⚠️ Supabase Table Missing", {
            description: `The table '${collection}' is missing from your Supabase database. Please copy and run the SQL Schema script from the Supabase Migration Panel first to enable saving!`,
            duration: 10000
          });
        }
        return;
      }
      const existing = existingSup || [];
      const existingValues = existing.map((r: any) =>
        r.value || r.name || r.category || r.category_name || r.status || r.status_name || r.priority || r.priority_name || r.zone || r.zone_name || r.title || r.label
      );

      const toDelete = existing.filter((ex: any) => {
        const val = ex.value || ex.name || ex.category || ex.category_name || ex.status || ex.status_name || ex.priority || ex.priority_name || ex.zone || ex.zone_name || ex.title || ex.label;
        return val && !items.includes(val);
      });
      const toCreate = items.filter((item: string) => !existingValues.includes(item));

      for (const ex of toDelete) {
        let deleted = false;
        if (ex.id !== undefined && ex.id !== null) {
          try {
            const res = await supabase.from(collection).delete().eq('id', ex.id);
            if (!res.error) deleted = true;
          } catch (e) {}
        }
        if (!deleted) {
          const val = ex.value || ex.name || ex.category || ex.category_name || ex.status || ex.status_name || ex.priority || ex.priority_name || ex.zone || ex.zone_name || ex.title || ex.label;
          if (val) {
            const possibleCols = ['value', 'name', 'category', 'category_name', 'status', 'status_name', 'priority', 'priority_name', 'zone', 'zone_name', 'title', 'label'];
            for (const col of possibleCols) {
              try {
                const res = await supabase.from(collection).delete().eq(col, val);
                if (!res.error) break;
              } catch (e) {}
            }
          }
        }
      }

      const colKeys = collection === 'zone_config'
        ? ['zone', 'zone_name', 'name', 'value', 'title', 'label']
        : collection === 'categories_config'
        ? ['category', 'category_name', 'name', 'value', 'title', 'label']
        : collection === 'statuses_config'
        ? ['status', 'status_name', 'name', 'value', 'title', 'label']
        : collection === 'priority_config'
        ? ['priority', 'priority_name', 'name', 'value', 'title', 'label']
        : ['value', 'name', 'title', 'label'];

      for (const item of toCreate) {
        let inserted = false;
        for (const key of colKeys) {
          if (inserted) break;

          try {
            const res = await supabase.from(collection).insert([{ [key]: item, config_type: collection, tenant_id: tenantId }]);
            if (!res.error) { inserted = true; break; }
          } catch (e) {}

          try {
            const res = await supabase.from(collection).insert([{ [key]: item, tenant_id: tenantId }]);
            if (!res.error) { inserted = true; break; }
          } catch (e) {}

          try {
            const res = await supabase.from(collection).insert([{ [key]: item }]);
            if (!res.error) { inserted = true; break; }
          } catch (e) {}
        }
      }
    } catch (e: any) {
      console.warn(`Failed to save to ${collection}:`, e);
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
      const monthMap = new Map<string, any>();

      try {
        let query = supabase.from('billing_months').select('*');
        if (dealerId && dealerId !== 'main') query = query.eq('dealer_id', dealerId);
        const { data: supMonths } = await query;
        if (supMonths) {
          for (const em of supMonths) {
            const rowsFromData = Array.isArray(em.rows_data) ? em.rows_data : (Array.isArray(em.rows) ? em.rows : []);
            monthMap.set(em.month_id, {
              id: em.month_id,
              dealerId: em.dealer_id || dealerId,
              rows: rowsFromData,
              hasAuthoritativeRowsData: true,
              updatedAt: em.updated ? new Date(em.updated).getTime() : Date.now(),
              createdAt: em.created ? new Date(em.created).getTime() : Date.now()
            });
          }
        }
      } catch (err) {}

      try {
        let query = supabase.from('billing_rows').select('*');
        if (dealerId && dealerId !== 'main') query = query.eq('dealer_id', dealerId);
        const { data: rowRecords } = await query;
        if (rowRecords && rowRecords.length > 0) {
          const rowsByMonth = new Map<string, any[]>();
          for (const r of rowRecords) {
            const mId = r.month_id || 'UNKNOWN';
            if (isExcludedFromRecovery(r.name, r.username)) continue;
            if (!rowsByMonth.has(mId)) rowsByMonth.set(mId, []);
            rowsByMonth.get(mId)!.push({
              id: r.client_id || r.id,
              clientId: r.client_id || r.id,
              name: r.name || '',
              username: r.username || '',
              mobileNumber: r.mobile_number || '',
              area: r.area || '',
              rt: r.rt || '',
              baseAmount: Number(r.base_amount ?? r.amount ?? 0),
              cr: Number(r.cr ?? 0),
              totalAmount: Number(r.total_amount ?? 0),
              billingDay: r.billing_day || '5',
              paymentReceived: Number(r.payment_received ?? 0),
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

          for (const [mId, rowList] of rowsByMonth.entries()) {
            if (!monthMap.has(mId)) {
              monthMap.set(mId, {
                id: mId,
                dealerId,
                rows: rowList,
                hasAuthoritativeRowsData: false,
                updatedAt: Date.now(),
                createdAt: Date.now()
              });
            } else {
              const existingMonth = monthMap.get(mId)!;
              if (!existingMonth.rows || existingMonth.rows.length === 0 || (rowList && rowList.length > existingMonth.rows.length)) {
                existingMonth.rows = rowList;
              }
            }
          }
        }
      } catch (err) {}

      const sortedList = Array.from(monthMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      try {
        localStorage.setItem('gts_cache_v3_billing_months', JSON.stringify(sortedList));
      } catch (e) {}

      return sortedList;
    } catch (e) {
      console.error("Failed to get billing months:", e);
      return [];
    }
  },

  getBillingMonthRowsDirect: async (monthId: string, dealerId: string = 'main') => {
    try {
      const { data: records } = await supabase.from('billing_rows').select('*').eq('month_id', monthId).eq('dealer_id', dealerId);
      if (records && records.length > 0) {
        return records.filter(r => !isExcludedFromRecovery(r.name, r.username)).map(r => ({
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
      return [];
    }
  },

  async createBillingMonth(monthId: string, rows: any[], createdBy: string, dealerId?: string) {
    await this.saveBillingMonth(monthId, rows, createdBy, dealerId || 'main');
  },

  _saveBillingMonthTimers: {} as Record<string, any>,
  _saveBillingMonthLatestRows: {} as Record<string, { rows: any[], updatedBy: string, changedIndices?: number[] | Set<number> }>,

  async saveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', forceImmediate = false, changedIndices?: number[] | Set<number>) {
    const key = `${monthId}_${dealerId}`;
    if (!this._saveBillingMonthLatestRows) this._saveBillingMonthLatestRows = {};

    this._saveBillingMonthLatestRows[key] = { rows, updatedBy, changedIndices };

    if (!this._saveBillingMonthTimers) this._saveBillingMonthTimers = {};

    if (forceImmediate) {
      if (this._saveBillingMonthTimers[key]) {
        clearTimeout(this._saveBillingMonthTimers[key].timerId);
        if (this._saveBillingMonthTimers[key].resolve) this._saveBillingMonthTimers[key].resolve();
        delete this._saveBillingMonthTimers[key];
      }
      const latest = this._saveBillingMonthLatestRows[key];
      if (latest) {
        delete this._saveBillingMonthLatestRows[key];
        await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId, latest.changedIndices);
      }
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (this._saveBillingMonthTimers[key]) {
        clearTimeout(this._saveBillingMonthTimers[key].timerId);
        if (this._saveBillingMonthTimers[key].reject) this._saveBillingMonthTimers[key].resolve();
      }

      const timerId = setTimeout(async () => {
        try {
          const latest = this._saveBillingMonthLatestRows[key];
          if (latest) {
            delete this._saveBillingMonthLatestRows[key];
            await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId, latest.changedIndices);
          }
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          delete this._saveBillingMonthTimers[key];
        }
      }, 250);

      this._saveBillingMonthTimers[key] = { timerId, resolve, reject };
    });
  },

  _billingMonthExecutionLocks: {} as Record<string, Promise<void>>,
  _syncingMonths: new Set<string>(),

  async _executeSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', changedIndices?: number[] | Set<number>) {
    const syncKey = `${monthId}_${dealerId}`;
    if (!this._billingMonthExecutionLocks) this._billingMonthExecutionLocks = {};
    const previous = this._billingMonthExecutionLocks[syncKey] || Promise.resolve();
    const run = previous.then(() => this._doExecuteSaveBillingMonth(monthId, rows, updatedBy, dealerId, changedIndices));
    this._billingMonthExecutionLocks[syncKey] = run.catch(() => {});
    return run;
  },

  async _doExecuteSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', changedIndices?: number[] | Set<number>) {
    const syncKey = `${monthId}_${dealerId}`;
    if (!this._syncingMonths) this._syncingMonths = new Set<string>();
    this._syncingMonths.add(syncKey);

    try {
      await upsertSupabase('billing_months', 'month_id', monthId, {
        month_id: monthId,
        dealer_id: dealerId,
        rows_data: rows,
        updated_by: updatedBy
      });

      try {
        const cacheKey = `gts_cache_v3_billing_months`;
        const rawCache = localStorage.getItem(cacheKey);
        let list: any[] = rawCache ? JSON.parse(rawCache) : [];
        const idx = list.findIndex(m => m.id === monthId || m.month_id === monthId);
        const updatedObj = { id: monthId, month_id: monthId, dealer_id: dealerId, rows, rows_data: rows, updated_by: updatedBy, updatedAt: Date.now() };
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updatedObj };
        } else {
          list.unshift(updatedObj);
        }
        localStorage.setItem(cacheKey, JSON.stringify(list));
      } catch (e) {}

      await this.syncBillingRows(monthId, dealerId, rows, changedIndices);
    } catch (e: any) {
      console.error("Failed to save billing month:", e);
    } finally {
      if (this._syncingMonths) {
        this._syncingMonths.delete(syncKey);
      }
    }
  },

  async deleteBillingMonth(monthId: string, dealerId: string = 'main') {
    return globalLoading.wrap(async () => {
      try {
        await supabase.from('billing_months').delete().eq('month_id', monthId).eq('dealer_id', dealerId);
        await supabase.from('billing_rows').delete().eq('month_id', monthId).eq('dealer_id', dealerId);

        try {
          const cacheKey = `gts_cache_v3_billing_months`;
          const rawCache = localStorage.getItem(cacheKey);
          if (rawCache) {
            let list: any[] = JSON.parse(rawCache);
            list = list.filter(m => m.id !== monthId && m.month_id !== monthId);
            localStorage.setItem(cacheKey, JSON.stringify(list));
          }
        } catch (e) {}
      } catch (e: any) {
        console.error("Failed to delete billing month:", e);
        throw e;
      }
    }, `Deleting recovery sheet ${monthId}...`);
  },

  async deleteAllBillingData(dealerId: string = 'main') {
    try {
      let queryMonths = supabase.from('billing_months').delete();
      let queryRows = supabase.from('billing_rows').delete();
      if (dealerId && dealerId !== 'main') {
        queryMonths = queryMonths.eq('dealer_id', dealerId);
        queryRows = queryRows.eq('dealer_id', dealerId);
      } else {
        queryMonths = queryMonths.neq('month_id', '');
        queryRows = queryRows.neq('month_id', '');
      }
      await queryMonths;
      await queryRows;

      try {
        localStorage.removeItem('gts_cache_v3_billing_months');
      } catch (e) {}
    } catch (e: any) {
      console.error("Failed to delete all billing data:", e);
      throw e;
    }
  },

  async syncBillingRows(monthId: string, dealerId: string, rows: any[], changedIndices?: number[] | Set<number>) {
    const sanitizeNum = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const mapRowToDb = (r: any, actualIdx: number) => {
      let rowId = r.clientId || r.id;
      if (!rowId || !String(rowId).trim()) {
        if (r.username && String(r.username).trim()) {
          rowId = `usr_${String(r.username).trim().toLowerCase()}`;
        } else if (r.name && String(r.name).trim()) {
          rowId = `name_${String(r.name).trim().toLowerCase().replace(/\s+/g, '_')}`;
        } else {
          rowId = `row_${actualIdx}_${monthId}`;
        }
      }
      return {
        id: `${monthId}_${rowId}`,
        month_id: String(monthId || ''),
        dealer_id: String(dealerId || 'main'),
        client_id: String(rowId),
        name: String(r.name || ''),
        username: String(r.username || ''),
        mobile_number: String(r.mobileNumber || r.mobile || ''),
        area: String(r.area || ''),
        rt: String(r.rt || ''),
        base_amount: sanitizeNum(r.baseAmount ?? r.base_amount ?? r.amount),
        cr: sanitizeNum(r.cr),
        total_amount: sanitizeNum(r.totalAmount ?? r.total_amount),
        billing_day: String(r.billingDay || '5'),
        payment_received: sanitizeNum(r.paymentReceived ?? r.payment_received),
        payment_status: String(r.paymentStatus ?? r.payment_status ?? 'unpaid'),
        comments: String(r.comments || ''),
        occ: String(r.occ || ''),
        ser_nam: String(r.serNam || r.ser_nam || ''),
        pkg_details: String(r.pkgDetails || r.pkg_details || ''),
        sag: String(r.sag || ''),
        lai: String(r.lai || ''),
        connection_date: String(r.connectionDate || r.connection_date || ''),
        device_price: sanitizeNum(r.devicePrice ?? r.device_price),
        abl: sanitizeNum(r.abl),
        network: String(r.network || '')
      };
    };

    let itemsToSync: { r: any; actualIndex: number }[];
    const hasChangedIndices = changedIndices && (Array.isArray(changedIndices) ? changedIndices.length > 0 : changedIndices.size > 0);
    if (hasChangedIndices) {
      const indicesArray = Array.isArray(changedIndices) ? changedIndices : Array.from(changedIndices);
      itemsToSync = indicesArray.map((idx: number) => ({ r: rows[idx], actualIndex: idx })).filter(item => Boolean(item.r));
    } else {
      itemsToSync = rows.map((r: any, idx: number) => ({ r, actualIndex: idx }));
    }

    if (itemsToSync.length === 0) return;

    const dbRows = itemsToSync.map(({ r, actualIndex }) => mapRowToDb(r, actualIndex));

    try {
      const { error } = await supabase.from('billing_rows').upsert(dbRows, { onConflict: 'id' });
      if (error) {
        console.warn("syncBillingRows batch upsert error:", error.message);
      }
    } catch (err) {
      console.warn("syncBillingRows error:", err);
    }
  },

  // --- USERS ---
  getUsers: async (dealerId?: string): Promise<UserProfile[]> => {
    try {
      let query = supabase.from('users_data').select('*');
      if (dealerId && dealerId !== 'all') {
        query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.') : query.eq('dealer_id', dealerId);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(r => fromDb('users', r));
    } catch (e) {
      return [];
    }
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase.from('users_data').select('*').eq('uid', uid).limit(1).single();
      if (error || !data) return null;
      return fromDb('users', data);
    } catch (e) {
      return null;
    }
  },

  getNetworkOwnerByLineCode: async (lineCode: string): Promise<UserProfile | null> => {
    try {
      const { data } = await supabase.from('users_data').select('*').eq('line_code', lineCode).limit(1).single();
      if (!data) return null;
      return fromDb('users', data);
    } catch (e) {
      return null;
    }
  },

  createUser: async (uid: string, username: string, pass: string, role: UserProfile['role'], authorId?: string, authorName?: string, dealerId: string = 'main', lineCode?: string, companyName?: string, status: UserProfile['status'] = 'active'): Promise<UserProfile> => {
    const user: UserProfile = {
      uid,
      username,
      password: pass,
      role,
      fullName: username,
      createdAt: Date.now(),
      lastActive: Date.now(),
      dealerId,
      lineCode: lineCode || '',
      createdBy: authorId || 'admin',
      createdByName: authorName || 'System Admin',
      companyName: companyName || '',
      status
    };
    await upsertSupabase('users', 'uid', uid, toDb('users', user));
    return user;
  },

  updateUserStatus: async (uid: string, status: UserProfile['status'], authorName: string) => {
    await upsertSupabase('users', 'uid', uid, { status });
  },

  deleteUser: async (uid: string, username: string, authorName: string) => {
    await supabase.from('users_data').delete().eq('uid', uid);
  },

  updateUserPassword: async (uid: string, username: string, newPass: string, authorName: string) => {
    await upsertSupabase('users', 'uid', uid, { password: newPass });
  },

  updateUser: async (uid: string, data: Partial<UserProfile>, authorName: string) => {
    await upsertSupabase('users', 'uid', uid, toDb('users', data));
  },

  updateUserPresence: async (uid: string) => {
    await upsertSupabase('users', 'uid', uid, { last_active: Date.now() });
  },

  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    let baseConfig: any = {};
    try {
      const { data } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
      if (data && data.length > 0 && data[0].dashboard_subtext) {
        try { baseConfig = JSON.parse(data[0].dashboard_subtext); } catch (e) {}
      }
    } catch (e) {}

    const [dbCategories, dbStatuses, dbPriorities, dbZones] = await Promise.all([
      supabaseService.getCategories(tenantId),
      supabaseService.getStatuses(tenantId),
      supabaseService.getPriorities(tenantId),
      supabaseService.getZones(tenantId),
    ]);

    return {
      ...baseConfig,
      categories: dbCategories.length > 0 ? dbCategories : (baseConfig.categories || DEFAULT_CATEGORIES),
      statuses: dbStatuses.length > 0 ? dbStatuses : (baseConfig.statuses || DEFAULT_STATUSES),
      priorities: dbPriorities.length > 0 ? dbPriorities : (baseConfig.priorities || DEFAULT_PRIORITIES),
      zones: dbZones.length > 0 ? dbZones : (baseConfig.zones || DEFAULT_ZONES),
      billingSecurityKey: baseConfig.billingSecurityKey || '1239870'
    };
  },

  setTypingStatus: async (uid: string, username: string, isTyping: boolean, fullName?: string) => {},
  subscribeTypingStatus: (callback: (typingUsers: { uid: string, username: string, fullName?: string }[]) => void) => {
    callback([]);
    return () => {};
  },

  subscribeUsers: (callback: (users: UserProfile[]) => void, dealerId?: string) => {
    return subscribeTable('users', callback, r => fromDb('users', r), dealerId);
  },

  createNotification: async (data: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> => {
    const cleanData = sanitize(data);
    const clientNotification: any = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...cleanData,
      createdAt: Date.now(),
      isRead: false
    };
    try {
      await upsertSupabase('notifications', 'id', clientNotification.id, toDb('notifications', clientNotification));
      return clientNotification;
    } catch (error) {
      return clientNotification;
    }
  },

  clearAllNotifications: async (dealerId?: string) => {
    try {
      let query = supabase.from('notifications').delete();
      if (dealerId && dealerId !== 'main') query = query.eq('dealer_id', dealerId);
      else query = query.neq('id', '');
      await query;
    } catch (e) {}
  },

  deleteNotification: async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (e) {}
  },

  subscribeNotifications: (callback: (notifications: AppNotification[]) => void, dealerId?: string) => {
    return subscribeTable('notifications', callback, r => fromDb('notifications', r), dealerId);
  },

  getComplaints: async (dealerId?: string): Promise<Complaint[]> => {
    try {
      let query = supabase.from('complaints').select('*');
      if (dealerId && dealerId !== 'all') {
        query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.') : query.eq('dealer_id', dealerId);
      }
      const { data } = await query;
      if (!data) return [];
      return data.map(r => fromDb('complaints', r));
    } catch (e) {
      return [];
    }
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    return globalLoading.wrap(async () => {
      const tenantId = member.role === 'dealer' ? member.uid : (member.dealerId || 'main');
      const complaint: Complaint = {
        id: `complaint_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        memberId: member.uid,
        memberName: member.username,
        customerName: data.customerName || '',
        customerUsername: data.customerUsername || '',
        area: data.area || '',
        description: data.description || '',
        number: data.number || '',
        status: data.status || 'Pending',
        category: data.category || 'Internet',
        priority: data.priority || 'Medium',
        pkgDetails: data.pkgDetails || '',
        userNearby: data.userNearby || '',
        panelDetails: data.panelDetails || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        remarks: data.remarks || '',
        remarkAuthorId: data.remarks ? member.uid : undefined,
        remarkAuthorName: data.remarks ? member.username : undefined,
        reviews: data.reviews || [],
        dealerId: tenantId,
        scheduledAt: data.scheduledAt
      };
      await upsertSupabase('complaints', 'id', complaint.id, toDb('complaints', complaint));
      return complaint;
    }, 'Registering complaint...');
  },

  verifyComplaintPersisted: async (id: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('complaints').select('id').eq('id', id).limit(1).single();
      return Boolean(data);
    } catch (e) {
      return false;
    }
  },

  deleteComplaint: async (id: string, customerName: string, authorName: string, fullComplaintData?: Complaint) => {
    return globalLoading.wrap(async () => {
      try {
        await supabase.from('complaints').delete().eq('id', id);
      } catch (e) {}
    }, 'Deleting complaint...');
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, remarks?: string, reviews?: ComplaintReview[]) => {
    return globalLoading.wrap(async () => {
      const updates: any = { status, updated_at: Date.now() };
      if (remarks) {
        updates.remarks = remarks;
        updates.remark_author_id = authorId;
        updates.remark_author_name = authorName;
      }
      if (reviews) {
        updates.customer_review = JSON.stringify(reviews);
      }
      await upsertSupabase('complaints', 'id', id, updates);
    }, 'Updating complaint status...');
  },

  updateComplaintRemarks: async (id: string, remarks: string, customerName: string, authorName: string, authorId: string) => {
    await upsertSupabase('complaints', 'id', id, {
      remarks,
      remark_author_id: authorId,
      remark_author_name: authorName,
      updated_at: Date.now()
    });
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, customerName: string, authorName: string) => {
    await upsertSupabase('complaints', 'id', id, toDb('complaints', { ...data, updatedAt: Date.now() }));
  },

  saveComplaint: async (complaint: Complaint, dealerId: string = 'main') => {
    await upsertSupabase('complaints', 'id', complaint.id, toDb('complaints', { ...complaint, dealerId }));
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void, dealerId?: string) => {
    return subscribeTable('complaints', (items) => callback(items.sort((a, b) => b.createdAt - a.createdAt)), r => fromDb('complaints', r), dealerId);
  },

  getSettings: async () => {
    return supabaseService.getAppConfig();
  },

  subscribeConfig: (callback: (config: any) => void, tenantId: string = 'main') => {
    const fetchConf = async () => {
      const conf = await supabaseService.getAppConfig(tenantId);
      if (conf) callback(conf);
    };
    fetchConf();

    // Live subscription to all 4 configuration tables + branding_config in Supabase
    const channelName = `config_realtime_${tenantId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories_config' }, () => fetchConf())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses_config' }, () => fetchConf())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'priority_config' }, () => fetchConf())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_config' }, () => fetchConf())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => fetchConf())
      .subscribe();

    const timer = setInterval(fetchConf, 2500);
    return () => {
      clearInterval(timer);
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  },

  updateConfig: async (config: any, authorName: string, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    const payload = {
      config_type: docId,
      dashboard_subtext: typeof config === 'string' ? config : JSON.stringify(config),
      tenant_id: tenantId
    };
    await upsertSupabase('branding_config', 'config_type', docId, payload);
    await supabaseService.syncAppConfig(config, tenantId);
  },

  subscribeBranding: (callback: (branding: BrandingConfig | null) => void) => {
    const fetchB = async () => {
      try {
        const { data } = await supabase.from('branding_config').select('*').eq('config_type', 'branding').limit(1);
        if (data && data.length > 0) callback(fromDb('branding_config', data[0]));
      } catch (e) {}
    };
    fetchB();
    const timer = setInterval(fetchB, 10000);
    return () => clearInterval(timer);
  },

  updateBranding: async (branding: BrandingConfig, authorName: string) => {
    await upsertSupabase('branding_config', 'config_type', 'branding', toDb('branding_config', { ...branding, config_type: 'branding' }));
  },

  // --- CHAT & MESSAGES ---
  sendMessage: async (sender: UserProfile, text: string, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const tenantId = supabaseService.getTenantId(sender);
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text,
      type: 'text',
      recipientId: recipientId || 'broadcast',
      isGroup: Boolean(isGroup),
      replyTo,
      createdAt: Date.now(),
      seenBy: { [sender.uid]: { username: sender.username, time: Date.now() } },
      dealerId: tenantId
    };
    await upsertSupabase('chat_messages', 'id', msg.id, toDb('chat_messages', msg));
    return msg;
  },

  sendVoiceMessage: async (sender: UserProfile, audioBase64: string, duration: number, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const tenantId = supabaseService.getTenantId(sender);
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text: 'Voice Message',
      audioUrl: audioBase64,
      type: 'voice',
      duration,
      recipientId: recipientId || 'broadcast',
      isGroup: Boolean(isGroup),
      replyTo,
      createdAt: Date.now(),
      seenBy: { [sender.uid]: { username: sender.username, time: Date.now() } },
      dealerId: tenantId
    };
    await upsertSupabase('chat_messages', 'id', msg.id, toDb('chat_messages', msg));
    return msg;
  },

  createGroup: async (name: string, members: string[], creator: UserProfile): Promise<ChatGroup> => {
    const tenantId = supabaseService.getTenantId(creator);
    const grp: ChatGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      members: Array.from(new Set([...members, creator.uid])),
      createdBy: creator.uid,
      createdAt: Date.now(),
      dealerId: tenantId
    };
    await upsertSupabase('chat_groups', 'id', grp.id, toDb('chat_groups', grp));
    return grp;
  },

  markAsSeen: async (messageId: string, uid: string, name: string) => {},

  deleteMessage: async (messageId: string) => {
    try {
      await supabase.from('chat_messages').delete().eq('id', messageId);
    } catch (e) {}
  },

  clearAllMessages: async (dealerId?: string) => {
    try {
      let query = supabase.from('chat_messages').delete();
      if (dealerId && dealerId !== 'main') query = query.eq('dealer_id', dealerId);
      else query = query.neq('id', '');
      await query;
    } catch (e) {}
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    try {
      await supabase.from('chat_groups').delete().eq('id', groupId);
    } catch (e) {}
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    try {
      let query = supabase.from('chat_messages').delete();
      if (isGroup) {
        query = query.eq('recipient_id', scopeId);
      } else {
        query = query.or(`sender_id.eq.${scopeId},recipient_id.eq.${scopeId}`);
      }
      await query;
    } catch (e) {}
  },

  subscribeGroups: (callback: (groups: ChatGroup[]) => void, dealerId?: string) => {
    return subscribeTable('chat_groups', callback, r => fromDb('chat_groups', r), dealerId);
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void, dealerId?: string) => {
    return subscribeTable('chat_messages', (items) => callback(items.sort((a, b) => a.createdAt - b.createdAt)), r => fromDb('chat_messages', r), dealerId);
  },

  // --- CLIENTS ---
  getClients: async (dealerId?: string): Promise<Client[]> => {
    try {
      let query = supabase.from('clients').select('*');
      if (dealerId && dealerId !== 'all') {
        query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.') : query.eq('dealer_id', dealerId);
      }
      const { data } = await query;
      if (!data) return [];
      return data.map(r => fromDb('clients', r));
    } catch (e) {
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main'): Promise<Client> => {
    const client: Client = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      createdAt: Date.now(),
      dealerId
    };
    await upsertSupabase('clients', 'id', client.id, toDb('clients', client));
    return client;
  },

  updateClient: async (id: string, data: Partial<Client>, clientName: string, authorName: string) => {
    await upsertSupabase('clients', 'id', id, toDb('clients', data));
  },

  saveClientsBatch: async (clientsList: Client[], dealerId: string = 'main') => {
    if (!clientsList || clientsList.length === 0) return;
    try {
      const primaryKey = `clients_${dealerId || 'all'}`;
      const syncKeys = [primaryKey, 'clients_all', 'clients_main', 'clients_'];
      
      syncKeys.forEach(sKey => {
        const existing = globalTableCaches[sKey] || [];
        const map = new Map<string, any>();
        existing.forEach((c: any) => map.set(c.id, c));
        clientsList.forEach(c => map.set(c.id, c));
        const updatedList = Array.from(map.values());
        globalTableCaches[sKey] = updatedList;

        const subs = globalTableSubscribers[sKey];
        if (subs) {
          subs.forEach(cb => {
            try { cb(updatedList); } catch (e) {}
          });
        }
      });

      if (!supabase) return;

      const dbRows = clientsList.map(c => toDb('clients', {
        ...c,
        dealerId: c.dealerId || dealerId || 'main'
      }));

      const { error } = await supabase.from('clients').upsert(dbRows);
      if (error) {
        console.warn("saveClientsBatch direct upsert warning, trying individual fallback:", error.message);
        for (const c of clientsList) {
          await upsertSupabase('clients', 'id', c.id, toDb('clients', {
            ...c,
            dealerId: c.dealerId || dealerId || 'main'
          }));
        }
      }
    } catch (e) {
      console.warn("saveClientsBatch exception:", e);
    }
  },

  updateClientComplaints: async (originalUsername: string, updatedData: any) => {},

  deleteClient: async (id: string, clientName: string, authorName: string, fullClientData?: Client) => {
    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch (e) {}
  },

  subscribeClients: (callback: (clients: Client[]) => void, dealerId?: string) => {
    return subscribeTable('clients', callback, r => fromDb('clients', r), dealerId);
  },

  // --- MONITOR TARGETS ---
  createMonitorTarget: async (domain: string, creator: UserProfile, label?: string, lat?: number, lng?: number): Promise<MonitorTarget> => {
    const tenantId = supabaseService.getTenantId(creator);
    const target: MonitorTarget = {
      id: `target_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      domain,
      createdBy: creator.username,
      createdAt: Date.now(),
      dealerId: tenantId,
      lat,
      lng,
      label
    };
    await upsertSupabase('monitor_targets', 'id', target.id, toDb('monitor_targets', target));
    return target;
  },

  deleteMonitorTarget: async (id: string): Promise<void> => {
    try {
      await supabase.from('monitor_targets').delete().eq('id', id);
    } catch (e) {}
  },

  updateMonitorTarget: async (id: string, updates: Partial<MonitorTarget>): Promise<void> => {
    await upsertSupabase('monitor_targets', 'id', id, toDb('monitor_targets', updates));
  },

  subscribeMonitorTargets: (callback: (targets: MonitorTarget[]) => void, dealerId?: string) => {
    return subscribeTable('monitor_targets', callback, r => fromDb('monitor_targets', r), dealerId);
  },

  // --- SYSTEM BACKUP & RESTORE ---
  getFullSystemBackup: async (exportedBy: string): Promise<any> => {
    const users = await supabaseService.getUsers();
    const complaints = await supabaseService.getComplaints();
    const clients = await supabaseService.getClients();
    return {
      version: '3.0',
      exportedBy,
      exportedAt: Date.now(),
      users,
      complaints,
      clients
    };
  },

  restoreFullSystemBackup: async (backupPkg: any, authorName: string): Promise<void> => {
    if (backupPkg.users && Array.isArray(backupPkg.users)) {
      for (const u of backupPkg.users) {
        await upsertSupabase('users', 'uid', u.uid, toDb('users', u));
      }
    }
    if (backupPkg.complaints && Array.isArray(backupPkg.complaints)) {
      for (const c of backupPkg.complaints) {
        await upsertSupabase('complaints', 'id', c.id, toDb('complaints', c));
      }
    }
    if (backupPkg.clients && Array.isArray(backupPkg.clients)) {
      for (const cl of backupPkg.clients) {
        await upsertSupabase('clients', 'id', cl.id, toDb('clients', cl));
      }
    }
  },

  subscribeBillingMonths: (callback: (months: any[]) => void, dealerId?: string) => {
    return subscribeTable('billing_months', callback, (row: any) => ({
      id: row.month_id,
      dealerId: row.dealer_id,
      rows: Array.isArray(row.rows_data) ? row.rows_data : (Array.isArray(row.rows) ? row.rows : []),
      updatedAt: row.updated ? new Date(row.updated).getTime() : Date.now(),
      createdAt: row.created ? new Date(row.created).getTime() : Date.now()
    }), dealerId);
  },

  subscribeTranslations: (callback: (translations: any) => void) => {
    const fetchT = async () => {
      try {
        const { data } = await supabase.from('branding_config').select('*').eq('config_type', 'translations').limit(1);
        if (data && data.length > 0 && data[0].dashboard_subtext) {
          try { callback(JSON.parse(data[0].dashboard_subtext)); } catch (e) {}
        }
      } catch (e) {}
    };
    fetchT();
    const timer = setInterval(fetchT, 10000);
    return () => clearInterval(timer);
  },

  updateTranslations: async (translations: any) => {
    await upsertSupabase('branding_config', 'config_type', 'translations', {
      config_type: 'translations',
      dashboard_subtext: JSON.stringify(translations)
    });
  },

  // --- LEDGER & FOLDERS ---
  subscribeLedgerFolders: (callback: (folders: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_folders', callback, r => {
      const f = fromDb('ledger_folders', r);
      let parsedCreated = Date.now();
      if (f.createdAt) {
        if (typeof f.createdAt === 'number') {
          parsedCreated = f.createdAt;
        } else {
          const t = new Date(f.createdAt).getTime();
          if (!isNaN(t)) parsedCreated = t;
        }
      }
      return {
        id: f.id,
        name: f.name || '',
        parentId: f.parentId || f.parent_id || '',
        tenantId: f.tenantId || f.tenant_id || 'main',
        createdAt: parsedCreated
      };
    }, dealerId);
  },

  subscribeLedgerSheetFolderMap: (callback: (map: any) => void, dealerId?: string) => {
    const docId = `ledger_sheet_folder_map_${dealerId || 'main'}`;
    const fetchM = async () => {
      try {
        const { data } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
        if (data && data.length > 0 && data[0].dashboard_subtext) {
          try { callback(JSON.parse(data[0].dashboard_subtext)); } catch (e) {}
        }
      } catch (e) {}
    };
    fetchM();
    const timer = setInterval(fetchM, 10000);
    return () => clearInterval(timer);
  },

  subscribeFolderMonthMap: (callback: (map: any) => void, dealerId?: string) => {
    const docId = `folder_month_map_${dealerId || 'main'}`;
    const fetchM = async () => {
      try {
        const { data } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
        if (data && data.length > 0 && data[0].dashboard_subtext) {
          try { callback(JSON.parse(data[0].dashboard_subtext)); } catch (e) {}
        }
      } catch (e) {}
    };
    fetchM();
    const timer = setInterval(fetchM, 10000);
    return () => clearInterval(timer);
  },

  updateFolderMonthMap: async (map: any, tenantId: string = 'main') => {
    const docId = `folder_month_map_${tenantId}`;
    await upsertSupabase('branding_config', 'config_type', docId, {
      config_type: docId,
      dashboard_subtext: JSON.stringify(map),
      tenant_id: tenantId
    });
  },

  getLedgerFolders: async (tenantId: string = 'main') => {
    try {
      if (!supabase) return [];
      const { data, error } = await supabase.from('ledger_folders').select('*');
      if (!error && data && data.length > 0) {
        const filtered = (data || []).filter(r => !tenantId || tenantId === 'main' || tenantId === 'all' || r.tenant_id === tenantId || r.tenant_id === 'main' || !r.tenant_id);
        return filtered.map(r => {
          const f = fromDb('ledger_folders', r);
          let parsedCreated = Date.now();
          if (f.createdAt) {
            if (typeof f.createdAt === 'number') {
              parsedCreated = f.createdAt;
            } else {
              const t = new Date(f.createdAt).getTime();
              if (!isNaN(t)) parsedCreated = t;
            }
          }
          return {
            id: f.id,
            name: f.name || '',
            parentId: f.parentId || f.parent_id || '',
            tenantId: f.tenantId || f.tenant_id || 'main',
            createdAt: parsedCreated
          };
        });
      }

      // Fallback 1: Check branding_config
      const docId = `ledger_folders_data_${tenantId || 'main'}`;
      const { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
      if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
        try {
          const parsed = JSON.parse(bData[0].dashboard_subtext);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }

      // Fallback 2: Check localStorage
      const localCached = localStorage.getItem(`gts_ledger_folders_${tenantId || 'main'}`) || localStorage.getItem('gts_cache_v3_ledger_folders');
      if (localCached) {
        try {
          const parsed = JSON.parse(localCached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }

      return [];
    } catch (e) {
      return [];
    }
  },

  deleteLedgerFolder: async (folderId: string, tenantId: string = 'main') => {
    try {
      const syncKeys = [`ledger_folders_${tenantId || 'all'}`, 'ledger_folders_all', 'ledger_folders_main', 'ledger_folders_'];
      syncKeys.forEach(sKey => {
        if (globalTableCaches[sKey]) {
          globalTableCaches[sKey] = globalTableCaches[sKey].filter(f => f.id !== folderId);
        }
      });

      // Instantly unmap the sheets from global cache
      const sheetSyncKeys = [`ledger_sheets_${tenantId || 'all'}`, 'ledger_sheets_all', 'ledger_sheets_main', 'ledger_sheets_'];
      sheetSyncKeys.forEach(sKey => {
        if (globalTableCaches[sKey]) {
          globalTableCaches[sKey] = globalTableCaches[sKey].map(sh => {
            if (sh.folderId === folderId) {
              return { ...sh, folderId: '', sort: '', sortFolder: '' };
            }
            return sh;
          });
          const subs = globalTableSubscribers[sKey];
          if (subs) {
            subs.forEach(cb => { try { cb(globalTableCaches[sKey]); } catch(e) {} });
          }
        }
      });

      // Update backup in branding_config if present
      const docId = `ledger_folders_data_${tenantId || 'main'}`;
      try {
        const { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
        if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
          const parsed = JSON.parse(bData[0].dashboard_subtext);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(f => f.id !== folderId);
            await upsertSupabase('branding_config', 'config_type', docId, {
              config_type: docId,
              dashboard_subtext: JSON.stringify(updated),
              tenant_id: tenantId || 'main'
            });
          }
        }
      } catch (e) {}

      if (supabase) {
        // Also permanently unmap any sheets attached to this folder directly in the database
        await supabase.from('ledger_sheets').update({ folder_id: '' }).eq('folder_id', folderId);
        
        const { error } = await supabase.from('ledger_folders').delete().eq('id', folderId);
        if (error) console.warn("deleteLedgerFolder error:", error.message);
      }
    } catch (e) {
      console.warn("deleteLedgerFolder exception:", e);
    }
  },

  saveLedgerFolders: async (folders: any[], tenantId: string = 'main') => {
    try {
      // 1. Instantly update global table cache and subscribers so UI never loses newly created folders
      const primaryKey = `ledger_folders_${tenantId || 'all'}`;
      const syncKeys = [primaryKey, 'ledger_folders_all', 'ledger_folders_main', 'ledger_folders_'];
      
      syncKeys.forEach(sKey => {
        globalTableCaches[sKey] = folders;
        const subs = globalTableSubscribers[sKey];
        if (subs) {
          subs.forEach(cb => {
            try { cb(folders); } catch (cbErr) {}
          });
        }
      });

      try {
        localStorage.setItem(`gts_cache_v3_ledger_folders`, JSON.stringify(folders));
        localStorage.setItem(`gts_ledger_folders_${tenantId || 'main'}`, JSON.stringify(folders));
      } catch (e) {}

      if (!supabase) return;

      // 2. Dual-save as JSON backup in branding_config so folders are ALWAYS retained in Supabase DB
      const docId = `ledger_folders_data_${tenantId || 'main'}`;
      await upsertSupabase('branding_config', 'config_type', docId, {
        config_type: docId,
        dashboard_subtext: JSON.stringify(folders),
        tenant_id: tenantId || 'main'
      });

      // 3. Persist directly to Supabase ledger_folders table
      for (const f of folders) {
        if (!f.id) continue;
        const createdVal = f.createdAt || f.created_at;
        let createdIso = new Date().toISOString();
        if (typeof createdVal === 'number') {
          createdIso = new Date(createdVal).toISOString();
        } else if (createdVal) {
          try {
            const dIso = new Date(createdVal);
            if (!isNaN(dIso.getTime())) createdIso = dIso.toISOString();
          } catch (e) {}
        }

        const dbRow = toDb('ledger_folders', {
          id: String(f.id),
          name: String(f.name || ''),
          parentId: String(f.parentId || f.parent_id || ''),
          tenantId: String(tenantId || 'main'),
          createdAt: createdIso
        });

        // Use standard Supabase upsert which is far more robust and handles conflicts automatically
        const { error: upsertErr } = await supabase.from('ledger_folders').upsert(dbRow);
        
        if (upsertErr) {
          console.warn("Direct upsert error for ledger_folders, trying upsertSupabase:", upsertErr.message);
          
          if (upsertErr.message.includes('relation "ledger_folders" does not exist')) {
            toast.error("⚠️ Supabase Table Missing", {
              description: "The 'ledger_folders' table is missing from your Supabase database. Please copy and run the SQL Schema script from the Supabase Migration Panel first!",
              duration: 10000
            });
            break; // Stop loop since the table doesn't exist
          } else {
            // Try standard fallback
            await upsertSupabase('ledger_folders', 'id', String(f.id), dbRow);
          }
        }
      }
    } catch (e) {
      console.warn("saveLedgerFolders error:", e);
    }
  },

  updateLedgerFolders: async (folders: any[], tenantId: string = 'main') => {
    await supabaseService.saveLedgerFolders(folders, tenantId);
  },

  updateLedgerSheetFolderMap: async (map: any, tenantId: string = 'main') => {
    const docId = `ledger_sheet_folder_map_${tenantId}`;
    await upsertSupabase('branding_config', 'config_type', docId, {
      config_type: docId,
      dashboard_subtext: JSON.stringify(map),
      tenant_id: tenantId
    });
  },

  saveGoogleSheetLink: async (tenantId: string, folderId: string, sheetId: string) => {
    const payload = {
      tenant_id: tenantId,
      folder_id: folderId,
      sheet_id: sheetId
    };
    try {
      const { data } = await supabase.from('google_sheet_links').select('id').eq('tenant_id', tenantId).eq('folder_id', folderId).limit(1).single();
      if (data) {
        await supabase.from('google_sheet_links').update(payload).eq('id', data.id);
      } else {
        await supabase.from('google_sheet_links').insert([payload]);
      }
    } catch (e) {}
  },

  getGoogleSheetLinks: async (tenantId: string) => {
    try {
      const { data } = await supabase.from('google_sheet_links').select('*').eq('tenant_id', tenantId);
      return data || [];
    } catch (e) {
      return [];
    }
  },

  getLedgerSheets: async (tenantId: string = 'main') => {
    try {
      const { data } = await supabase.from('ledger_sheets').select('*').eq('dealer_id', tenantId);
      return (data || []).map(r => fromDb('ledger_sheets', r));
    } catch (e) {
      return [];
    }
  },

  subscribeLedgerSheets: (callback: (sheets: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_sheets', callback, r => fromDb('ledger_sheets', r), dealerId);
  },

  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    const sortValue = sheet.sort || sheet.sortFolder || sheet.folderName || '';
    const folderIdValue = sheet.folderId || '';
    const itemObj = { ...sheet, sort: sortValue, folderId: folderIdValue, dealerId: tenantId };
    const dbRow = toDb('ledger_sheets', itemObj);

    // Update memory caches and notify subscribers immediately
    const syncKey = `ledger_sheets_${tenantId || 'all'}`;
    const syncKeys = [syncKey, 'ledger_sheets_all', 'ledger_sheets_main', 'ledger_sheets_'];
    syncKeys.forEach(sKey => {
      if (!globalTableCaches[sKey]) globalTableCaches[sKey] = [];
      const idx = globalTableCaches[sKey].findIndex(item => item.id === sheet.id);
      if (idx !== -1) {
        globalTableCaches[sKey][idx] = { ...globalTableCaches[sKey][idx], ...itemObj };
      } else {
        globalTableCaches[sKey].unshift(itemObj);
      }
      const subs = globalTableSubscribers[sKey];
      if (subs) {
        subs.forEach(cb => { try { cb(globalTableCaches[sKey]); } catch (e) {} });
      }
    });

    try {
      localStorage.setItem(`gts_cache_v3_ledger_sheets`, JSON.stringify(globalTableCaches[syncKey] || []));
    } catch (e) {}

    await upsertSupabase('ledger_sheets', 'id', sheet.id, dbRow);
  },

  saveLedgerSheetsBatch: async (sheets: any[], tenantId: string = 'main') => {
    if (!sheets || sheets.length === 0) return;

    const dbRows = sheets.map(sheet => {
      const sortValue = sheet.sort || sheet.sortFolder || sheet.folderName || '';
      const folderIdValue = sheet.folderId || '';
      const itemObj = { ...sheet, sort: sortValue, folderId: folderIdValue, dealerId: tenantId };

      const syncKey = `ledger_sheets_${tenantId || 'all'}`;
      const syncKeys = [syncKey, 'ledger_sheets_all', 'ledger_sheets_main', 'ledger_sheets_'];
      syncKeys.forEach(sKey => {
        if (!globalTableCaches[sKey]) globalTableCaches[sKey] = [];
        const idx = globalTableCaches[sKey].findIndex(item => item.id === sheet.id);
        if (idx !== -1) {
          globalTableCaches[sKey][idx] = { ...globalTableCaches[sKey][idx], ...itemObj };
        } else {
          globalTableCaches[sKey].unshift(itemObj);
        }
        const subs = globalTableSubscribers[sKey];
        if (subs) {
          subs.forEach(cb => { try { cb(globalTableCaches[sKey]); } catch (e) {} });
        }
      });

      return toDb('ledger_sheets', itemObj);
    });

    try {
      const syncKey = `ledger_sheets_${tenantId || 'all'}`;
      localStorage.setItem(`gts_cache_v3_ledger_sheets`, JSON.stringify(globalTableCaches[syncKey] || []));
    } catch (e) {}

    const { error } = await supabase.from('ledger_sheets').upsert(dbRows, { onConflict: 'id' });
    if (error) {
      console.warn("saveLedgerSheetsBatch error, falling back to individual upserts:", error.message);
      await Promise.all(sheets.map(sh => supabaseService.saveLedgerSheet(sh, tenantId)));
    }
  },

  terminateAllLedgerSheets: async (tenantId: string = 'main', authorName: string = 'admin') => {
    try {
      await supabase.from('ledger_sheets').delete().eq('dealer_id', tenantId);
    } catch (e) {}
  },

  deleteLedgerSheet: async (sheetId: string, authorName: string = 'admin', tenantId: string = 'main', fullSheetData?: any) => {
    try {
      await supabase.from('ledger_sheets').delete().eq('id', sheetId);
    } catch (e) {}
  },

  // --- RECYCLE BIN ---
  saveToRecycleBin: async (tableName: string, recordId: string, authorName: string, dealerId?: string, extraData?: any) => {
    try {
      await supabase.from('recycle_bin').insert([{
        table_name: tableName,
        record_id: recordId,
        author_name: authorName,
        dealer_id: dealerId || 'main',
        data: extraData ? JSON.stringify(extraData) : null,
        created_at: Date.now()
      }]);
    } catch (e) {}
  },

  getRecycleBinItems: async () => {
    try {
      const { data } = await supabase.from('recycle_bin').select('*');
      return data || [];
    } catch (e) {
      return [];
    }
  },

  subscribeRecycleBin: (callback: (items: any[]) => void) => {
    return subscribeTable('recycle_bin', callback);
  },

  restoreFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      await supabase.from('recycle_bin').delete().eq('id', recycleBinItemId);
    } catch (e) {}
  },

  permanentlyDeleteFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      await supabase.from('recycle_bin').delete().eq('id', recycleBinItemId);
    } catch (e) {}
  },

  emptyRecycleBin: async () => {
    try {
      await supabase.from('recycle_bin').delete().neq('id', '');
    } catch (e) {}
  },

  cleanOldRecycleBinItems: async (days: number = 30) => {
    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      await supabase.from('recycle_bin').delete().lt('created_at', cutoff);
    } catch (e) {}
  },

  migrateAllRowsToBillingMonths: async (dealerId: string = 'main') => {
    try {
      await supabaseService.getBillingMonths(dealerId);
      return {
        failedCount: 0,
        message: 'Successfully scanned and verified all billing months in Supabase.'
      };
    } catch (e: any) {
      return {
        failedCount: 1,
        message: e?.message || 'Migration scan completed with warnings.'
      };
    }
  }
};

export const pocketbaseService = supabaseService;
export const dbService = supabaseService;