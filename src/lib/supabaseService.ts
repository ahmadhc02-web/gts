import { supabase } from './supabase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification as AppNotification, ChatGroup, BrandingConfig, MonitorTarget, ComplaintReview, ReminderLead, ReminderLeadItem } from '../types';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_ZONES, ensurePermanentStatuses } from '../constants';
import { globalLoading } from '../contexts/LoadingContext';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Please check your connection and try again.`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

let activeLineCode: string | undefined = undefined;
let activeLineId: string | undefined = undefined;

function checkWarnEmptyLineCode(type: 'folder' | 'sheet', itemId: string, itemLineCode?: string) {
  try {
    let userLineCode = activeLineCode || '';
    let userId = 'unknown';
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('complaint_app_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u) {
          userId = u.uid || u.id || u.username || 'unknown';
          if (!userLineCode) {
            userLineCode = u.lineCode || u.line_code || '';
          }
        }
      }
    }
    if (userLineCode && (!itemLineCode || !String(itemLineCode).trim())) {
      console.warn(`[VLAN Warning] ${type === 'folder' ? 'Folder' : 'Sheet'} saved with empty line_code while user has lineCode (User ID: ${userId}, ${type === 'folder' ? 'Folder' : 'Sheet'} ID: ${itemId})`);
    }
  } catch (e) {}
}

import { sendMessage, getTemplate, getStatus , sendPushNotification } from '../whatsapp_data/whatsappApi';

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

const parseExcludedKeys = (em: any): string[] => {
  if (!em) return [];
  
  let rowsDataObj = null;
  if (em.rows_data) {
    if (typeof em.rows_data === 'string') {
      try {
        const parsed = JSON.parse(em.rows_data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          rowsDataObj = parsed;
        }
      } catch (e) {}
    } else if (typeof em.rows_data === 'object' && em.rows_data !== null && !Array.isArray(em.rows_data)) {
      rowsDataObj = em.rows_data;
    }
  }
  
  const raw = rowsDataObj?.excludedClientKeys ?? em.excluded_client_keys ?? em.excludedClientKeys;

  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
};

const parseRowsData = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && !Array.isArray(val) && 'rows' in val) {
    if (Array.isArray(val.rows)) return val.rows;
  }
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'rows' in parsed) {
        if (Array.isArray(parsed.rows)) return parsed.rows;
      }
    } catch (e) {}
  }
  return [];
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
    line_code: 'line_code',
    lineId: 'line_id',
    line_id: 'line_id',
    createdBy: 'created_by',
    createdByName: 'created_by_name',
    companyName: 'company_name',
    status: 'status',
    profilePicture: 'profile_picture',
    email: 'email',
    fcmToken: 'fcm_token'
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
    lineCode: 'line_code',
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
    lineCode: 'line_code',
    line_code: 'line_code',
    lineId: 'line_id',
    line_id: 'line_id',
    lat: 'lat',
    lng: 'lng'
  },
  billing: {
    id: 'id',
    clientId: 'client_id',
    monthId: 'month_id',
    name: 'name',
    username: 'username',
    amount: 'amount',
    baseAmount: 'base_amount',
    cr: 'cr',
    totalAmount: 'total_amount',
    paymentStatus: 'payment_status',
    paymentReceived: 'payment_received',
    billingDay: 'billing_day',
    comments: 'comments',
    dealerId: 'dealer_id',
    lineId: 'line_id',
    line_id: 'line_id',
    lineCode: 'line_code',
    line_code: 'line_code',
    reminderSentAt: 'reminder_sent_at',
    reminderSentCount: 'reminder_sent_count',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  invoices: {
    id: 'id',
    clientId: 'client_id',
    invoiceNumber: 'invoice_number',
    monthId: 'month_id',
    clientName: 'client_name',
    clientUsername: 'client_username',
    amount: 'amount',
    baseAmount: 'base_amount',
    status: 'status',
    dueDate: 'due_date',
    dealerId: 'dealer_id',
    lineId: 'line_id',
    line_id: 'line_id',
    lineCode: 'line_code',
    line_code: 'line_code',
    createdAt: 'created_at'
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
    lineCode: 'line_code',
    details: 'details'
  },
  monitor_targets: {
    id: 'id',
    domain: 'domain',
    createdBy: 'created_by',
    createdAt: 'created_at',
    dealerId: 'dealer_id',
    lineCode: 'line_code',
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
    lineCode: 'line_code',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
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
    lineCode: 'line_code',
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
  },
  reminder_leads: {
    id: 'id',
    name: 'name',
    dealerId: 'dealer_id',
    lineCode: 'line_code',
    monthId: 'month_id',
    dueDateStart: 'due_date_start',
    dueDateEnd: 'due_date_end',
    waitSeconds: 'wait_seconds',
    status: 'status',
    totalCount: 'total_count',
    successCount: 'success_count',
    failedCount: 'failed_count',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  reminder_lead_items: {
    id: 'id',
    leadId: 'lead_id',
    clientId: 'client_id',
    username: 'username',
    name: 'name',
    mobileNumber: 'mobile_number',
    message: 'message',
    status: 'status',
    sortOrder: 'sort_order',
    sentAt: 'sent_at',
    errorMessage: 'error_message',
    waitSecondsAfter: 'wait_seconds_after',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
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
      } else if (table === 'complaints' && clientKey === 'protocols') {
        // map protocols to remarks
        result['remarks'] = Array.isArray(obj[clientKey]) ? JSON.stringify(obj[clientKey]) : obj[clientKey];
      } else {
        result[dbKey] = obj[clientKey];
      }
    }
  }

  const validDbKeys = new Set(Object.values(tableMapping));
  for (const [key, val] of Object.entries(obj)) {
    if (validDbKeys.has(key) && result[key] === undefined && val !== undefined) {
      result[key] = val;
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

    if (obj.updatedAt || obj.updated_at) {
      const uVal = obj.updatedAt || obj.updated_at;
      result['updated_at'] = typeof uVal === 'string' && uVal.includes('T') ? uVal : new Date(uVal).toISOString();
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

  if (table === 'reminder_lead_items') {
    result.username = obj.username || (obj.message ? (obj.message.match(/Your Id\.?\s*([^\s,]+)/i)?.[1] || null) : null) || obj.client_id || '';
  }

  if (table === 'users') {
    const responseData = obj;
    const userRole = responseData?.role ? String(responseData.role).trim() : 'user';
    result.role = userRole;
    result.username = responseData?.username ? String(responseData.username).trim() : (result.username ? String(result.username).trim() : '');
    result.lineCode = responseData?.line_code ? String(responseData.line_code).trim() : (result.lineCode ? String(result.lineCode).trim() : '');
    result.lineId = responseData?.line_id ? String(responseData.line_id).trim() : (result.lineId || null);
    result.line_code = result.lineCode;
    result.line_id = result.lineId;
    result.dealerId = responseData?.dealer_id ? String(responseData.dealer_id).trim() : (result.dealerId ? String(result.dealerId).trim() : '');
    result.companyName = responseData?.company_name ? String(responseData.company_name).trim() : (result.companyName ? String(result.companyName).trim() : '');
    result.status = result.status || 'active';
    if (!result.profilePicture || String(result.profilePicture).trim() === '') {
      try {
        const storedPics = JSON.parse(localStorage.getItem('gts_profile_pictures') || '{}');
        if (result.uid && storedPics[result.uid]) {
          result.profilePicture = storedPics[result.uid];
        }
      } catch (e) {}
    }
  }

  if (table === 'clients') {
    result.lineCode = obj?.line_code ? String(obj.line_code).trim() : (result.lineCode ? String(result.lineCode).trim() : null);
    result.lineId = obj?.line_id ? String(obj.line_id).trim() : (result.lineId ? String(result.lineId).trim() : null);
    result.line_code = result.lineCode;
    result.line_id = result.lineId;
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
    
    if (obj.remarks) {
      const rm = String(obj.remarks).trim();
      if (rm.startsWith('[')) {
        try {
          result.protocols = JSON.parse(rm);
        } catch (e) {
          result.protocols = [{
            id: 'legacy-err',
            text: String(obj.remarks),
            createdAt: obj.created_at || Date.now()
          }];
        }
      } else {
        result.protocols = [{
          id: 'legacy-1',
          text: String(obj.remarks),
          createdAt: obj.created_at || Date.now()
        }];
      }
    } else {
      result.protocols = [];
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

    if (obj.updated !== undefined && obj.updated !== null) {
      result.updated = String(obj.updated);
    }
    if (obj.updated_at) {
      const parsedTime = typeof obj.updated_at === 'number' ? obj.updated_at : new Date(obj.updated_at).getTime();
      result.updatedAt = !isNaN(parsedTime) ? parsedTime : obj.updated_at;
    }
  }
  return result;
}

const globalTableSubscribers: Record<string, Set<(data: any[], isFresh?: boolean) => void>> = {};
export const globalTableCaches: Record<string, any[]> = {};
const globalTableIntervals: Record<string, any> = {};
const globalTableChannels: Record<string, any> = {};
const globalPresenceChannels: Record<string, any> = {};
const realtimeFetchTimers: Record<string, NodeJS.Timeout> = {};

async function upsertSupabase(collectionName: string, idField: string, idValue: string, data: any, throwOnError = false) {
  if (!supabase) {
    if (throwOnError) throw new Error("Supabase client not initialized");
    return;
  }
  const targetTable = collectionName === 'users' ? 'users_data' : collectionName;
  const cleanData = { ...data };
  delete cleanData.updated_at;
  delete cleanData.updated_by;
  delete cleanData.author_name;
  if (targetTable === 'ledger_sheets') {
    delete cleanData.updated;
  }

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
      console.warn(`upsertSupabase native upsert warning for ${targetTable}:`, error.message, error.code, error.details, error.hint);
      // Fallback to old select-then-insert/update path only if native upsert fails
      const { data: existingSup, error: findErr } = await supabase.from(targetTable).select(idField).eq(idField, idValue).limit(1);
      if (!findErr && existingSup && existingSup.length > 0) {
        const { error: updateErr } = await supabase.from(targetTable).update(cleanData).eq(idField, idValue);
        if (updateErr) {
          console.warn(`upsertSupabase update fallback error for ${targetTable}:`, updateErr.message, updateErr.code, updateErr.details, updateErr.hint);
          if (throwOnError) throw new Error(`[Supabase Update Error] ${updateErr.message} (Code: ${updateErr.code}) ${updateErr.details || ''} ${updateErr.hint || ''}`);
        }
      } else {
        const { error: insertErr } = await supabase.from(targetTable).insert([cleanData]);
        if (insertErr) {
          console.warn(`upsertSupabase insert fallback error for ${targetTable}:`, insertErr.message, insertErr.code, insertErr.details, insertErr.hint);
          if (throwOnError) throw new Error(`[Supabase Insert Error] ${insertErr.message} (Code: ${insertErr.code}) ${insertErr.details || ''} ${insertErr.hint || ''}`);
        }
      }
    }
  } catch (e: any) {
    console.warn(`upsertSupabase error for ${targetTable}:`, e?.message || e, e?.code, e?.details, e?.hint);
    if (throwOnError) {
      if (e instanceof Error) throw e;
      throw new Error(`[Supabase Error] ${e?.message || e} (Code: ${e?.code}) ${e?.details || ''} ${e?.hint || ''}`);
    }
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

export const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// --- Race Protection, Bad Fetch Retry, Realtime Health, and Window Wake Helpers ---
const fetchSeqCounter: Record<string, number> = {};
const lastRealtimeAppliedAt: Record<string, number> = {};
const lastSafetyRefetchAt: Record<string, number> = {};
const retryFetchTimers: Record<string, NodeJS.Timeout> = {};
const channelReconnectTimers: Record<string, NodeJS.Timeout> = {};
const reconnectBackoff: Record<string, number> = {};
const hasSubscribedOnce: Record<string, boolean> = {};
const badFetchRetryCount: Record<string, number> = {};

const activeFetchInitialFunctions: Record<string, () => void> = {};
const lastWindowRefetchAt: Record<string, number> = {};
let windowRefetchDebounceTimer: NodeJS.Timeout | null = null;

function triggerGlobalRefetch(): void {
  if (windowRefetchDebounceTimer) {
    clearTimeout(windowRefetchDebounceTimer);
  }
  windowRefetchDebounceTimer = setTimeout(() => {
    windowRefetchDebounceTimer = null;
    const now = Date.now();
    for (const [key, fetchFn] of Object.entries(activeFetchInitialFunctions)) {
      if (!globalTableSubscribers[key] || globalTableSubscribers[key].size === 0) continue;
      if (now - (lastWindowRefetchAt[key] || 0) >= 30000) {
        lastWindowRefetchAt[key] = now;
        badFetchRetryCount[key] = 0;
        try {
          fetchFn();
        } catch (e) {
          console.warn(`[triggerGlobalRefetch] Error refetching ${key}:`, e);
        }
      }
    }
  }, 2000);
}

if (typeof window !== 'undefined' && !(window as any).__gtsRealtimeListenersAttached) {
  (window as any).__gtsRealtimeListenersAttached = true;
  const onWakeOrOnline = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    triggerGlobalRefetch();
  };
  window.addEventListener('online', onWakeOrOnline);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onWakeOrOnline);
  }
}

// Helper: Extract unique row key across table schemas
function getRowKey(r: any): string | null {
  if (!r) return null;
  const k = r.id ?? r.month_id ?? r.sheet_id ?? r.folder_id ?? r.uid ?? r.config_type;
  return k !== undefined && k !== null ? String(k) : null;
}

// Helper: Extract valid timestamp from row
function getRowTimestamp(r: any): number {
  if (!r) return 0;
  const val = r.updatedAt ?? r.updated_at ?? r.createdAt ?? r.created_at;
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
}

// Helper: Merge fetched rows by ID with current cache (retaining rows with newer updatedAt/updated_at)
function mergeWithCache(fetchedRows: any[], cacheRows: any[]): any[] {
  if (!cacheRows || cacheRows.length === 0) return fetchedRows;
  
  const cacheMap = new Map<string, any>();
  for (const row of cacheRows) {
    const key = getRowKey(row);
    if (key !== null) {
      cacheMap.set(key, row);
    }
  }

  return fetchedRows.map(fetchedRow => {
    const key = getRowKey(fetchedRow);
    if (key === null) return fetchedRow;
    const cached = cacheMap.get(key);
    if (!cached) return fetchedRow;

    // If cached has rowsLoaded: true, preserve the loaded rows and rowsLoaded flag
    if (cached.rowsLoaded && Array.isArray(cached.rows)) {
      return {
        ...fetchedRow,
        rows: cached.rows,
        rowsLoaded: true,
        excludedClientKeys: cached.excludedClientKeys || fetchedRow.excludedClientKeys || []
      };
    }

    const cachedTime = getRowTimestamp(cached);
    const fetchedTime = getRowTimestamp(fetchedRow);
    if (cachedTime > fetchedTime) {
      return { ...fetchedRow, ...cached };
    }
    return fetchedRow;
  });
}

// Requirement 1: Helper fetchAllPages(buildQuery) fetching all rows in pages of 1000
async function fetchAllPages(
  buildQuery: () => any
): Promise<{ data: any[]; error: any; pageCount: number }> {
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;
  let allRecords: any[] = [];
  let pageIndex = 0;
  let orderStrategy: 'created_at_desc_id' | 'created_at_only' | 'id_only' | 'none' = 'created_at_desc_id';

  while (pageIndex < MAX_PAGES) {
    const from = allRecords.length;
    const to = from + PAGE_SIZE - 1;

    let q = buildQuery();
    if (orderStrategy === 'created_at_desc_id') {
      q = q.order('created_at', { ascending: false }).order('id', { ascending: true });
    } else if (orderStrategy === 'created_at_only') {
      q = q.order('created_at', { ascending: false });
    } else if (orderStrategy === 'id_only') {
      q = q.order('id', { ascending: true });
    }
    q = q.range(from, to);

    let { data, error } = await q;

    // Verify which created-at / id column the table really has on page 0
    if (error && pageIndex === 0 && orderStrategy === 'created_at_desc_id') {
      const errMsg = String(error.message || '').toLowerCase();
      if (error.code === '42703' || errMsg.includes('column') || errMsg.includes('order')) {
        if (errMsg.includes('id') && !errMsg.includes('created_at')) {
          // Has created_at but not id column
          orderStrategy = 'created_at_only';
          const r1 = await buildQuery().order('created_at', { ascending: false }).range(from, to);
          data = r1.data;
          error = r1.error;
        } else {
          // Fall back to id ordering
          orderStrategy = 'id_only';
          const r2 = await buildQuery().order('id', { ascending: true }).range(from, to);
          if (r2.error && (r2.error.code === '42703' || String(r2.error.message || '').toLowerCase().includes('id'))) {
            // Neither created_at nor id exists
            orderStrategy = 'none';
            const r3 = await buildQuery().range(from, to);
            data = r3.data;
            error = r3.error;
          } else {
            data = r2.data;
            error = r2.error;
          }
        }
      }
    }

    if (error) {
      return { data: allRecords, error, pageCount: pageIndex + 1 };
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      break;
    }

    allRecords.push(...rows);
    pageIndex++;
  }

  return { data: allRecords, error: null, pageCount: Math.max(1, pageIndex) };
}

const realtimeBillingMonthDebounceTimers: Record<string, any> = {};

function subscribeTable(
  tableName: string,
  callback: (data: any[], isFresh?: boolean) => void,
  mapRow: (row: any) => any = (row) => row,
  dealerId?: string,
  bypassLineCodeFilter: boolean | string = false
) {
  const syncKey = `${tableName}_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;

  if (!globalTableCaches[syncKey]) {
    // Skip stale localStorage pre-population for tables where momentarily stale status/data causes UI flicker (complaints & clients)
    if (tableName !== 'complaints' && tableName !== 'clients') {
      try {
        const metaStr = localStorage.getItem(`gts_cache_meta_${syncKey}`);
        const metaTime = metaStr ? Number(metaStr) : 0;
        const isExpired = !metaTime || (Date.now() - metaTime > CACHE_MAX_AGE_MS);

        if (!isExpired) {
          const cachedData = localStorage.getItem(`gts_cache_v3_${syncKey}`);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalTableCaches[syncKey] = parsed;
            }
          }
        } else if (metaStr) {
          localStorage.removeItem(`gts_cache_v3_${syncKey}`);
          localStorage.removeItem(`gts_cache_meta_${syncKey}`);
        }
      } catch (e) {}
    }
  }

  const fetchInitial = async () => {
    // Requirement 3: Race protection sequence counter and start timestamp
    const currentSeq = (fetchSeqCounter[syncKey] = (fetchSeqCounter[syncKey] || 0) + 1);
    const fetchStartedAt = Date.now();

    try {
      let mapped: any[] = [];
      let error = null;
      let pageCount = 1;

      if (tableName === 'billing_months') {
        try {
          let query = supabase.from('billing_months').select('id, month_id, dealer_id, line_code, created, updated');
          if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
            query = query.eq('dealer_id', dealerId);
          }
          const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
          const cleanActive = String(activeLineCode || '').trim();
          if (bypassLineCodeFilter === true || bypassLineCodeFilter === 'all') {
            // no filter
          } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
            query = query.or('line_code.is.null,line_code.eq.');
          } else if (cleanBypass) {
            query = query.eq('line_code', cleanBypass);
          } else if (cleanActive) {
            query = query.eq('line_code', cleanActive);
          } else {
            query = query.or('line_code.is.null,line_code.eq.');
          }
          query = query.order('created', { ascending: false });

          const { data: records, error: fetchErr } = await query;
          error = fetchErr;
          if (records) {
            mapped = records.map(mapRow);
          }
        } catch (fetchErr) {
          error = fetchErr;
        }
      } else if (tableName === 'ledger_sheets') {
        try {
          mapped = await supabaseService.getLedgerSheets(dealerId);
        } catch (fetchErr) {
          error = fetchErr;
        }
      } else {
        const targetTable = tableName === 'users' ? 'users_data' : tableName;

        // Build base query with exact line-code & dealer scoping filters
        const buildQuery = () => {
          let query = supabase.from(targetTable).select('*');
          
          if (!['branding_config', 'categories_config', 'priority_config', 'statuses_config', 'zone_config'].includes(tableName)) {
            const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
            const cleanActive = String(activeLineCode || '').trim();
            if (bypassLineCodeFilter === true) {
              // no filter
            } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
              query = query.or('line_code.is.null,line_code.eq.');
            } else if (cleanBypass) {
              query = query.eq('line_code', cleanBypass);
            } else if (cleanActive) {
              query = query.eq('line_code', cleanActive);
            } else if (tableName === 'users' && (!dealerId || dealerId === 'all' || dealerId === 'main')) {
              query = query.or('line_code.is.null,line_code.eq.,role.eq.dealer');
            } else {
              // No active line code: strictly isolate to the without line room!
              query = query.or('line_code.is.null,line_code.eq.');
            }
          }
          if (dealerId && dealerId !== 'all') {
            if (!activeLineCode) {
              if (tableName === 'ledger_folders') {
                query = dealerId === 'main' ? query.or('tenant_id.eq.main,tenant_id.is.null') : query.eq('tenant_id', dealerId);
              } else if (tableName === 'ledger_sheets') {
                query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null') : query.eq('dealer_id', dealerId);
              } else if (tableName === 'reminder_leads') {
                query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null') : query.eq('dealer_id', dealerId);
              } else if (!['branding_config'].includes(tableName)) {
                query = dealerId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null') : query.eq('dealer_id', dealerId);
              }
            }
          }
          return query;
        };

        // Requirement 1: Fetch ALL rows in pages of 1000 via fetchAllPages helper
        const { data: records, error: fetchErr, pageCount: pages } = await fetchAllPages(buildQuery);
        error = fetchErr;
        pageCount = pages;
        if (!error && records) {
          mapped = records.map(mapRow);
        }
      }

      // Requirement 6: Console timing log for every fetchInitial
      const fetchDuration = Date.now() - fetchStartedAt;
      console.log(`[Load Timing] ${tableName} ${mapped.length} rows in ${fetchDuration}ms (${pageCount} pages)`);

      // Special ledger_folders fallback logic
      if (tableName === 'ledger_folders' && (error || mapped.length === 0)) {
        const isSpecificDealer = Boolean(dealerId && dealerId !== 'all' && dealerId !== 'main');
        const currentCache = globalTableCaches[syncKey];
        if (currentCache && currentCache.length > 0) {
          mapped = currentCache;
        } else if (!isSpecificDealer) {
          const docId = `ledger_folders_data_${dealerId || 'main'}`;
          try {
            const { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
            if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
              const parsed = JSON.parse(bData[0].dashboard_subtext);
              if (Array.isArray(parsed) && parsed.length > 0) {
                mapped = parsed;
                if (Array.isArray(mapped) && mapped.length > 0) {
                  mapped = mapped.filter((f: any) => {
                    const fLc = f.lineCode || f.line_code || '';
                    return activeLineCode ? fLc === activeLineCode : !fLc;
                  });
                }
              }
            }
          } catch (e) {}

          if (mapped.length === 0) {
            const exactLedgerKey = `ledger_folders_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
            const localSaved = localStorage.getItem(`gts_cache_v3_${exactLedgerKey}`);
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  mapped = parsed;
                  if (Array.isArray(mapped) && mapped.length > 0) {
                    mapped = mapped.filter((f: any) => {
                      const fLc = f.lineCode || f.line_code || '';
                      return activeLineCode ? fLc === activeLineCode : !fLc;
                    });
                  }
                }
              } catch (e) {}
            }
          }

          if (mapped.length > 0) {
            globalTableCaches[syncKey] = mapped;
            supabaseService.saveLedgerFolders(mapped, dealerId || 'main').catch(console.warn);
          }
        }
      }

      if (tableName === 'ledger_folders' && Array.isArray(mapped)) {
        mapped.sort((a: any, b: any) => (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0));
      }

      const currentCache = globalTableCaches[syncKey];
      const hasExistingRows = Array.isArray(currentCache) && currentCache.length > 0;

      // Requirement 3: Bad-fetch retry logic (limit to 3 retries)
      if ((error || mapped.length === 0) && hasExistingRows) {
        const currentRetries = badFetchRetryCount[syncKey] || 0;
        if (currentRetries < 3) {
          badFetchRetryCount[syncKey] = currentRetries + 1;
          console.warn(`[subscribeTable] Retaining current cache for ${syncKey} after bad fetch (retry ${badFetchRetryCount[syncKey]}/3) (error: ${error ? (error.message || error) : '0 rows returned while cache has ' + currentCache.length + ' rows'}). Scheduling retry in 5s.`);
          if (retryFetchTimers[syncKey]) {
            clearTimeout(retryFetchTimers[syncKey]);
          }
          retryFetchTimers[syncKey] = setTimeout(() => {
            delete retryFetchTimers[syncKey];
            fetchInitial();
          }, 5000);
          return;
        } else {
          // 3rd retry finished
          if (!error && mapped.length === 0) {
            console.warn(`[subscribeTable] 3 consecutive retries returned 0 rows without error for ${syncKey}. Accepting empty result and updating cache.`);
            badFetchRetryCount[syncKey] = 0;
            // Proceed below to update cache and notify subscribers with empty result
          } else {
            console.warn(`[subscribeTable] 3 consecutive retries failed with error for ${syncKey}. Keeping cache and stopping retries until next event.`);
            return;
          }
        }
      } else if (!error && mapped.length > 0) {
        badFetchRetryCount[syncKey] = 0;
      }

      // Requirement 3: Race protection checks
      // Discard if a newer fetch started
      if (currentSeq !== fetchSeqCounter[syncKey]) {
        console.log(`[Race Protection] Discarding stale fetch result for ${syncKey} (seq ${currentSeq} vs latest ${fetchSeqCounter[syncKey]}).`);
        return;
      }

      // Discard and re-run if a realtime event was applied after this fetch started
      if (lastRealtimeAppliedAt[syncKey] && lastRealtimeAppliedAt[syncKey] > fetchStartedAt) {
        console.log(`[Race Protection] Realtime event was applied during fetch for ${syncKey}. Discarding stale fetch and re-running fetchInitial.`);
        if (retryFetchTimers[syncKey]) {
          clearTimeout(retryFetchTimers[syncKey]);
        }
        retryFetchTimers[syncKey] = setTimeout(() => {
          delete retryFetchTimers[syncKey];
          fetchInitial();
        }, 200);
        return;
      }

      // Requirement 3: Merge by ID with current cache (retaining rows with newer updatedAt/updated_at)
      if (hasExistingRows && mapped.length > 0) {
        mapped = mergeWithCache(mapped, currentCache);
      }

      if (mapped.length > 0 || !error) {
        // Prevent double re-render if fetched data is identical to cache
        const isIdentical = globalTableCaches[syncKey] && JSON.stringify(globalTableCaches[syncKey]) === JSON.stringify(mapped);
        
        globalTableCaches[syncKey] = mapped;
        try {
          localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(mapped));
          localStorage.setItem(`gts_cache_meta_${syncKey}`, String(Date.now()));
        } catch (e) {}

        // For billing_months, ensure initial subscribers always receive confirmation
        if (!isIdentical || tableName === 'billing_months') {
          const subscribers = globalTableSubscribers[syncKey];
          if (subscribers) {
            subscribers.forEach((cb) => {
              try {
                cb(mapped, true);
              } catch (cbErr) {
                console.error("Error in subscriber callback:", cbErr);
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Exception loading table ${tableName} from Supabase:`, err);
      const currentCache = globalTableCaches[syncKey];
      if (Array.isArray(currentCache) && currentCache.length > 0) {
        const currentRetries = badFetchRetryCount[syncKey] || 0;
        if (currentRetries < 3) {
          badFetchRetryCount[syncKey] = currentRetries + 1;
          console.warn(`[subscribeTable] Retaining current cache for ${syncKey} after exception (retry ${badFetchRetryCount[syncKey]}/3). Scheduling retry in 5s.`);
          if (retryFetchTimers[syncKey]) {
            clearTimeout(retryFetchTimers[syncKey]);
          }
          retryFetchTimers[syncKey] = setTimeout(() => {
            delete retryFetchTimers[syncKey];
            fetchInitial();
          }, 5000);
        } else {
          console.warn(`[subscribeTable] 3 consecutive retries failed with error for ${syncKey}. Keeping cache and stopping retries until next event.`);
        }
      }
    }
  };

  // Register fetchInitial for global window wake/online refetch
  activeFetchInitialFunctions[syncKey] = fetchInitial;

  const isFirstSubscriber = !globalTableSubscribers[syncKey] || globalTableSubscribers[syncKey].size === 0;

  if (!globalTableSubscribers[syncKey]) {
    globalTableSubscribers[syncKey] = new Set();
  }
  globalTableSubscribers[syncKey].add(callback);

  if (globalTableCaches[syncKey]) {
    const isFresh = Boolean(tableName === 'billing_months' && supabaseService.isBillingFresh);
    callback(globalTableCaches[syncKey], isFresh);
  }

  if (isFirstSubscriber) {
    fetchInitial();
  }

  // Requirement 5: Channel setup with health management, exponential backoff, and re-subscribe
  const setupChannel = () => {
    try {
      const targetTable = tableName === 'users' ? 'users_data' : tableName;
      const channelName = `rt_${tableName}_${dealerId || 'all'}_${Math.random().toString(36).substring(2, 7)}`;
      const postgresChangesConfig: any = { event: '*', schema: 'public', table: targetTable };

      if (tableName === 'billing_months') {
        if (activeLineCode) {
          postgresChangesConfig.filter = `line_code=eq.${activeLineCode}`;
        } else if (dealerId && dealerId !== 'all' && dealerId !== 'main') {
          postgresChangesConfig.filter = `dealer_id=eq.${dealerId}`;
        }
      }

      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', postgresChangesConfig, (payload: any) => {
          console.log('[REALTIME] Change event received for table', targetTable, ':', payload);
          let billingMonthResolved = false;
          
          // Requirement 3: Record timestamp whenever realtime change is applied and reset bad fetch retries
          lastRealtimeAppliedAt[syncKey] = Date.now();
          badFetchRetryCount[syncKey] = 0;

          if (payload && payload.eventType === 'DELETE' && payload.old) {
            try {
              const oldId = payload.old.id || payload.old.month_id || payload.old.sheet_id;
              if (oldId !== undefined) {
                let cache = globalTableCaches[syncKey] || [];
                const originalLength = cache.length;
                
                if (tableName === 'billing_months') {
                  const targetMonthId = payload.old.month_id || payload.old.id;
                  cache = cache.filter((item: any) => {
                    const itemMonthId = item.id || item.month_id;
                    const dbIdMatch = item.dbId !== undefined && payload.old.id !== undefined && String(item.dbId) === String(payload.old.id);
                    return itemMonthId !== targetMonthId && itemMonthId !== String(targetMonthId) && !dbIdMatch;
                  });
                  billingMonthResolved = true;
                } else if (tableName === 'ledger_folders') {
                  const targetFolderId = payload.old.folder_id || payload.old.id;
                  cache = cache.filter((item: any) => {
                    const itemFolderId = item.id || item.folder_id;
                    const dbIdMatch = item.dbId !== undefined && payload.old.id !== undefined && String(item.dbId) === String(payload.old.id);
                    return itemFolderId !== targetFolderId && itemFolderId !== String(targetFolderId) && !dbIdMatch;
                  });
                } else if (tableName === 'ledger_sheets') {
                  const targetSheetId = payload.old.sheet_id || payload.old.id;
                  cache = cache.filter((item: any) => {
                    const itemSheetId = item.id || item.sheet_id;
                    const dbIdMatch = item.dbId !== undefined && payload.old.id !== undefined && String(item.dbId) === String(payload.old.id);
                    return itemSheetId !== targetSheetId && itemSheetId !== String(targetSheetId) && !dbIdMatch;
                  });
                } else {
                  cache = cache.filter((item: any) => {
                    const itemId = item.id || item.month_id || item.sheet_id || item.folder_id;
                    const dbIdMatch = item.dbId !== undefined && payload.old.id !== undefined && String(item.dbId) === String(payload.old.id);
                    return itemId !== oldId && itemId !== String(oldId) && itemId !== payload.old.id && itemId !== String(payload.old.id) && !dbIdMatch;
                  });
                }

                if (cache.length !== originalLength) {
                  globalTableCaches[syncKey] = cache;
                  try {
                    localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
                  } catch (e) {}

                  const subscribers = globalTableSubscribers[syncKey];
                  if (subscribers) {
                    subscribers.forEach((cb) => {
                      try { cb(cache); } catch (err) {}
                    });
                  }
                }
              }
            } catch (e) {}
          } else if (payload && payload.new) {
            try {
              const incomingId = payload.new.id || payload.new.month_id || payload.new.sheet_id || payload.new.folder_id;

              const removeRowFromCache = () => {
                if (incomingId === undefined || incomingId === null) return;
                let cache = globalTableCaches[syncKey] || [];
                const originalLength = cache.length;
                cache = cache.filter((item: any) => {
                  const itemId = item.id || item.month_id || item.sheet_id || item.folder_id;
                  const dbIdMatch = item.dbId !== undefined && payload.new.id !== undefined && String(item.dbId) === String(payload.new.id);
                  return String(itemId) !== String(incomingId) && !dbIdMatch;
                });
                if (cache.length !== originalLength) {
                  globalTableCaches[syncKey] = cache;
                  try {
                    localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
                    localStorage.setItem(`gts_cache_meta_${syncKey}`, String(Date.now()));
                  } catch (e) {}

                  const subscribers = globalTableSubscribers[syncKey];
                  if (subscribers) {
                    subscribers.forEach((cb) => {
                      try { cb(cache, true); } catch (err) {}
                    });
                  }
                }
              };

              const isSpecificDealer = Boolean(dealerId && dealerId !== 'all' && dealerId !== 'main');
              if (activeLineCode) {
                const rowLineCode = payload.new.line_code;
                if (rowLineCode && rowLineCode !== activeLineCode) {
                  removeRowFromCache();
                  return; // Skip updates not belonging to this dealer's line code
                }
              } else if (isSpecificDealer) {
                const rowDealer = payload.new.dealer_id || payload.new.tenant_id;
                if (tableName === 'billing_months') {
                  if (rowDealer && rowDealer !== dealerId) {
                    removeRowFromCache();
                    return; // Skip billing month updates not belonging to this dealer
                  }
                } else {
                  if (rowDealer && rowDealer !== dealerId && rowDealer !== 'main') {
                    removeRowFromCache();
                    return; // Skip updates not belonging to this dealer (or main for ledger fallback logic)
                  }
                }
              }
              
              if (!['branding_config', 'categories_config', 'priority_config', 'statuses_config', 'zone_config'].includes(tableName)) {
                let matchesRoom = true;
                const rowLineCode = payload.new.line_code ? String(payload.new.line_code).trim() : '';
                const cleanActive = String(activeLineCode || '').trim();
                const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';

                if (bypassLineCodeFilter === true) {
                  matchesRoom = true;
                } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
                  matchesRoom = !rowLineCode;
                } else if (cleanBypass) {
                  matchesRoom = rowLineCode === cleanBypass;
                } else if (cleanActive) {
                  matchesRoom = rowLineCode === cleanActive;
                } else {
                  // Room has no active line code ("without line" room)
                  const isDealerProfile = tableName === 'users' && payload.new.role === 'dealer';
                  if (isDealerProfile) {
                    matchesRoom = true;
                  } else {
                    matchesRoom = !rowLineCode;
                  }
                }

                if (!matchesRoom) {
                  removeRowFromCache();
                  return;
                }
              }

              const mappedRow = mapRow(payload.new);
              if (mappedRow) {
                const rowId = mappedRow.id || mappedRow.month_id || mappedRow.sheet_id || mappedRow.folder_id;
                let cache = globalTableCaches[syncKey] || [];
                if (rowId) {
                  const idx = cache.findIndex((item: any) => (item.id || item.month_id || item.sheet_id || item.folder_id) === rowId);
                  const existing = idx !== -1 ? cache[idx] : null;
                  const wasLoaded = Boolean(existing && existing.rowsLoaded && Array.isArray(existing.rows));

                  if (idx !== -1) {
                    cache = [...cache];
                    cache[idx] = {
                      ...cache[idx],
                      ...mappedRow,
                      rows: wasLoaded ? cache[idx].rows : (cache[idx].rows || []),
                      rowsLoaded: wasLoaded ? true : false,
                      excludedClientKeys: wasLoaded ? (cache[idx].excludedClientKeys || mappedRow.excludedClientKeys) : mappedRow.excludedClientKeys
                    };
                  } else {
                    cache = [mappedRow, ...cache];
                  }

                  if (tableName === 'billing_months') {
                    billingMonthResolved = true;
                    const mId = mappedRow.id || mappedRow.month_id;
                    const dId = mappedRow.dealerId || dealerId || 'main';
                    const key = `${mId}_${dId}`;

                    // When the changed month is already loaded in state, schedule a debounced (1500 ms) refresh
                    if (wasLoaded && mId) {
                      const isSaving = (supabaseService._syncingMonths && supabaseService._syncingMonths.has(key)) ||
                        (supabaseService._saveBillingMonthLatestRows && !!supabaseService._saveBillingMonthLatestRows[key]) ||
                        (typeof window !== 'undefined' && (window as any).__gtsSavingMonthIds && (window as any).__gtsSavingMonthIds.has(mId));

                      if (!isSaving) {
                        if (realtimeBillingMonthDebounceTimers[key]) {
                          clearTimeout(realtimeBillingMonthDebounceTimers[key]);
                        }
                        realtimeBillingMonthDebounceTimers[key] = setTimeout(async () => {
                          delete realtimeBillingMonthDebounceTimers[key];
                          const stillSaving = (supabaseService._syncingMonths && supabaseService._syncingMonths.has(key)) ||
                            (supabaseService._saveBillingMonthLatestRows && !!supabaseService._saveBillingMonthLatestRows[key]) ||
                            (typeof window !== 'undefined' && (window as any).__gtsSavingMonthIds && (window as any).__gtsSavingMonthIds.has(mId));
                          if (stillSaving) return;

                          try {
                            const fresh = await supabaseService.getBillingMonthDirect(mId, dId);
                            if (fresh && fresh.rows) {
                              const currentCachedList = globalTableCaches[syncKey];
                              if (Array.isArray(currentCachedList)) {
                                const cIdx = currentCachedList.findIndex((item: any) => (item.id || item.month_id) === mId);
                                if (cIdx !== -1) {
                                  currentCachedList[cIdx] = {
                                    ...currentCachedList[cIdx],
                                    rows: fresh.rows,
                                    rowsLoaded: true,
                                    excludedClientKeys: fresh.excludedClientKeys || currentCachedList[cIdx].excludedClientKeys || [],
                                    updatedAt: fresh.updatedAt || Date.now()
                                  };
                                  try {
                                    localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(currentCachedList));
                                  } catch (e) {}
                                  const subs = globalTableSubscribers[syncKey];
                                  if (subs) {
                                    subs.forEach(cb => { try { cb([...currentCachedList], true); } catch (e) {} });
                                  }
                                }
                              }
                            }
                          } catch (err) {
                            console.warn(`[Realtime Debounce] Failed refreshing month ${mId}:`, err);
                          }
                        }, 1500);
                      }
                    }
                  }

                  globalTableCaches[syncKey] = cache;
                  try {
                    localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
                    localStorage.setItem(`gts_cache_meta_${syncKey}`, String(Date.now()));
                  } catch (e) {}

                  const subscribers = globalTableSubscribers[syncKey];
                  if (subscribers) {
                    subscribers.forEach((cb) => {
                      try { cb(cache, true); } catch (err) {}
                    });
                  }
                }
              }
            } catch (e) {}
          }

          if (tableName === 'billing_months') {
            return;
          }

          // Requirement 4: Less refetching for complaints and clients (safety refetch at most once per 60s)
          if (tableName === 'complaints' || tableName === 'clients') {
            const now = Date.now();
            const lastRefetch = lastSafetyRefetchAt[syncKey] || 0;
            if (now - lastRefetch >= 60000) {
              if (realtimeFetchTimers[syncKey]) {
                clearTimeout(realtimeFetchTimers[syncKey]);
                delete realtimeFetchTimers[syncKey];
              }
              lastSafetyRefetchAt[syncKey] = now;
              realtimeFetchTimers[syncKey] = setTimeout(() => {
                fetchInitial();
                delete realtimeFetchTimers[syncKey];
              }, 2000);
            }
          } else {
            // Existing behavior for all other tables
            if (realtimeFetchTimers[syncKey]) {
              clearTimeout(realtimeFetchTimers[syncKey]);
            }
            realtimeFetchTimers[syncKey] = setTimeout(() => {
              fetchInitial();
              delete realtimeFetchTimers[syncKey];
            }, 3000);
          }
        });
      
      // Hook up dedicated broadcast channel for notifications
      if (tableName === 'notifications') {
        const globalBroadcastChannel = supabase.channel('gts_notifications_global_broadcast');
        globalBroadcastChannel
          .on('broadcast', { event: 'clear_all' }, (payload: any) => {
            console.log('[GLOBAL BROADCAST] Received clear_all event:', payload);
            const targetDealerId = payload.payload?.dealerId;
            if (!targetDealerId || targetDealerId === 'main' || targetDealerId === dealerId) {
              globalTableCaches[syncKey] = [];
              try {
                localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify([]));
              } catch (e) {}
              const subscribers = globalTableSubscribers[syncKey];
              if (subscribers) {
                subscribers.forEach((cb) => {
                  try { cb([]); } catch (err) {}
                });
              }
            }
          })
          .on('broadcast', { event: 'delete_notification' }, (payload: any) => {
            console.log('[GLOBAL BROADCAST] Received delete_notification event:', payload);
            const { id } = payload.payload || {};
            if (id) {
              let cache = globalTableCaches[syncKey] || [];
              const originalLength = cache.length;
              cache = cache.filter((item: any) => item.id !== id);
              if (cache.length !== originalLength) {
                globalTableCaches[syncKey] = cache;
                try {
                  localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
                } catch (e) {}
                const subscribers = globalTableSubscribers[syncKey];
                if (subscribers) {
                  subscribers.forEach((cb) => {
                    try { cb(cache); } catch (err) {}
                  });
                }
              }
            }
          })
          .on('broadcast', { event: 'mark_all_read' }, (payload: any) => {
            console.log('[GLOBAL BROADCAST] Received mark_all_read event:', payload);
            const targetDealerId = payload.payload?.dealerId;
            if (!targetDealerId || targetDealerId === 'main' || targetDealerId === dealerId) {
              let cache = globalTableCaches[syncKey] || [];
              cache = cache.map((item: any) => ({ ...item, isRead: true }));
              globalTableCaches[syncKey] = cache;
              try {
                localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
              } catch (e) {}
              const subscribers = globalTableSubscribers[syncKey];
              if (subscribers) {
                subscribers.forEach((cb) => {
                  try { cb(cache); } catch (err) {}
                });
              }
            }
          })
          .on('broadcast', { event: 'mark_read' }, (payload: any) => {
            console.log('[GLOBAL BROADCAST] Received mark_read event:', payload);
            const { id } = payload.payload || {};
            if (id) {
              let cache = globalTableCaches[syncKey] || [];
              let updated = false;
              cache = cache.map((item: any) => {
                if (item.id === id) {
                  updated = true;
                  return { ...item, isRead: true };
                }
                return item;
              });
              if (updated) {
                globalTableCaches[syncKey] = cache;
                try {
                  localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(cache));
                } catch (e) {}
                const subscribers = globalTableSubscribers[syncKey];
                if (subscribers) {
                  subscribers.forEach((cb) => {
                    try { cb(cache); } catch (err) {}
                  });
                }
              }
            }
          })
          .subscribe();
        
        (channel as any)._globalBroadcastChannel = globalBroadcastChannel;
      }

      // Requirement 5: subscribe with status handling and exponential backoff recovery
      channel.subscribe((status: string, err?: any) => {
        console.log(`[Realtime Channel] ${channelName} status: ${status}`, err || '');
        if (status === 'SUBSCRIBED') {
          reconnectBackoff[syncKey] = 2000;
          if (hasSubscribedOnce[syncKey]) {
            fetchInitial();
          }
          hasSubscribedOnce[syncKey] = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Requirement 2: return immediately if stale channel or closing by us
          if (globalTableChannels[syncKey] !== channel || (channel as any)._closingByUs) {
            return;
          }

          console.warn(`[Realtime Channel] Health issue on ${channelName}: ${status}. Recreating channel with backoff...`);

          // Mark closingByUs before our own channel.unsubscribe()/removeChannel() call
          (channel as any)._closingByUs = true;
          try {
            if ((channel as any)._globalBroadcastChannel) {
              (channel as any)._globalBroadcastChannel._closingByUs = true;
              try { (channel as any)._globalBroadcastChannel.unsubscribe(); supabase.removeChannel((channel as any)._globalBroadcastChannel); } catch (e) {}
            }
            channel.unsubscribe();
            supabase.removeChannel(channel);
          } catch (e) {}
          delete globalTableChannels[syncKey];

          // Advance backoff only once for this failure (do not double backoff for one failure)
          const currentDelay = reconnectBackoff[syncKey] || 2000;
          reconnectBackoff[syncKey] = Math.min(30000, currentDelay * 2);

          if (channelReconnectTimers[syncKey]) {
            clearTimeout(channelReconnectTimers[syncKey]);
          }
          channelReconnectTimers[syncKey] = setTimeout(() => {
            delete channelReconnectTimers[syncKey];
            if (globalTableSubscribers[syncKey] && globalTableSubscribers[syncKey].size > 0) {
              setupChannel();
            }
          }, currentDelay);
        }
      });

      globalTableChannels[syncKey] = channel;
    } catch (e) {}
  };

  if (!globalTableChannels[syncKey]) {
    setupChannel();
  }

  return () => {
    const subscribers = globalTableSubscribers[syncKey];
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        delete activeFetchInitialFunctions[syncKey];
        if (retryFetchTimers[syncKey]) {
          clearTimeout(retryFetchTimers[syncKey]);
          delete retryFetchTimers[syncKey];
        }
        if (channelReconnectTimers[syncKey]) {
          clearTimeout(channelReconnectTimers[syncKey]);
          delete channelReconnectTimers[syncKey];
        }
        if (globalTableIntervals[syncKey]) {
          clearInterval(globalTableIntervals[syncKey]);
          delete globalTableIntervals[syncKey];
        }
        if (realtimeFetchTimers[syncKey]) {
          clearTimeout(realtimeFetchTimers[syncKey]);
          delete realtimeFetchTimers[syncKey];
        }
        if (globalTableChannels[syncKey]) {
          const chan = globalTableChannels[syncKey];
          (chan as any)._closingByUs = true;
          if (chan._globalBroadcastChannel) {
            (chan._globalBroadcastChannel as any)._closingByUs = true;
            try { chan._globalBroadcastChannel.unsubscribe(); supabase.removeChannel(chan._globalBroadcastChannel); } catch (e) {}
          }
          try { supabase.removeChannel(chan); } catch (e) {}
          delete globalTableChannels[syncKey];
        }
        delete badFetchRetryCount[syncKey];
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

const globalAppConfigCache: Record<string, { config: any; timestamp: number }> = {};
const globalAppConfigPromises: Record<string, Promise<any>> = {};

const globalBrandingConfigCache: Record<string, { data: any; timestamp: number }> = {};
const globalBrandingConfigPromises: Record<string, Promise<any>> = {};

async function fetchBrandingConfigType(configType: string): Promise<any> {
  const now = Date.now();
  if (globalBrandingConfigPromises[configType]) {
    return globalBrandingConfigPromises[configType];
  }
  if (globalBrandingConfigCache[configType] && (now - globalBrandingConfigCache[configType].timestamp < 2500)) {
    return globalBrandingConfigCache[configType].data;
  }

  const promise = (async () => {
    try {
      const { data } = await supabase.from('branding_config').select('*').eq('config_type', configType).limit(1);
      const res = data && data.length > 0 ? data[0] : null;
      globalBrandingConfigCache[configType] = { data: res, timestamp: Date.now() };
      return res;
    } catch (e) {
      return null;
    }
  })();

  globalBrandingConfigPromises[configType] = promise;
  try {
    return await promise;
  } finally {
    delete globalBrandingConfigPromises[configType];
  }
}

const recentComplaintEvents = new Set<string>();
function guardComplaintEvent(complaintId: string, event: 'registered' | 'completed'): boolean {
  if (!complaintId) return true;
  const key = `${complaintId}:${event}`;
  if (recentComplaintEvents.has(key)) {
    return false;
  }
  recentComplaintEvents.add(key);
  setTimeout(() => {
    recentComplaintEvents.delete(key);
  }, 60 * 1000);
  return true;
}

export const supabaseService = {
  isBillingFresh: true,
  clearAllLocalCaches: () => {
    Object.keys(globalTableCaches).forEach(k => {
      delete globalTableCaches[k];
    });
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('gts_cache_v3_') || k.startsWith('gts_cache_meta_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    supabaseService.isBillingFresh = false;
  },
  setActiveLineCode: (lineCode?: string, lineId?: string) => {
    const cleanCode = typeof lineCode === 'string' ? lineCode.trim() : (lineCode ? String(lineCode).trim() : '');
    const newCode = cleanCode || undefined;
    const cleanId = typeof lineId === 'string' ? lineId.trim() : (lineId ? String(lineId).trim() : '');
    const newId = cleanId || undefined;
    if (activeLineCode !== newCode || activeLineId !== newId) {
      supabaseService.clearAllLocalCaches();
    }
    activeLineCode = newCode;
    activeLineId = newId;
  },
  getActiveLineCode: () => activeLineCode,
  getActiveLineId: () => activeLineId,
  // Presence and Cursor Broadcast for Collaboration
  joinBillingPresence(
    monthId: string, 
    userId: string, 
    userName: string,
    onSync: (state: any) => void,
    onCursorMove: (payload: any) => void
  ) {
    if (!supabase) return () => {};

    const channelName = `billing-presence-${monthId}`;
    let channel = globalPresenceChannels[channelName];
    
    if (!channel) {
      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: userId,
          },
        },
      });
      globalPresenceChannels[channelName] = channel;
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        onSync(channel.presenceState());
      })
      .on('broadcast', { event: 'cursor-move' }, (payload: any) => {
        onCursorMove(payload.payload);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            userName,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      // In a real app we might want to reference count channels
      // but for this, just remove the channel if it's the last subscriber
      try {
        channel.unsubscribe();
        supabase?.removeChannel(channel);
        delete globalPresenceChannels[channelName];
      } catch (e) {}
    };
  },

  broadcastCursorMove(monthId: string, payload: { userId: string, userName: string, rowIndex: number, field: string | null, action: 'focus' | 'blur' }) {
    if (!supabase) return;
    const channelName = `billing-presence-${monthId}`;
    const channel = globalPresenceChannels[channelName];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'cursor-move',
        payload,
      }).catch(() => {});
    }
  },

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
    if (user.dealerId && user.dealerId !== 'main') {
      return user.dealerId;
    }
    if (user.role === 'dealer') return user.uid;
    return user.dealerId || 'main';
  },

  getReadTenantId: (user: UserProfile) => {
    if (user.dealerId && user.dealerId !== 'main') {
      return user.dealerId;
    }
    if (user.role === 'dealer') return user.uid;
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'member' || user.role === 'editor' || user.role === 'liteadmin' || user.role === 'field_agent') {
      return undefined;
    }
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
      let query = supabase.from('categories_config').select('*');
      if (tenantId && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      } else if (tenantId === 'main') {
        query = query.or('tenant_id.eq.main,tenant_id.is.null');
      }
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      }
      let { data, error } = await query;
      if (error && cleanCode && error.message && error.message.includes('column') && error.message.includes('line_code')) {
        let fallbackQuery = supabase.from('categories_config').select('*');
        if (tenantId && tenantId !== 'main') {
          fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
        } else if (tenantId === 'main') {
          fallbackQuery = fallbackQuery.or('tenant_id.eq.main,tenant_id.is.null');
        }
        const res = await fallbackQuery;
        data = res.data;
      }
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
      let query = supabase.from('statuses_config').select('*');
      if (tenantId && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      } else if (tenantId === 'main') {
        query = query.or('tenant_id.eq.main,tenant_id.is.null');
      }
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      }
      let { data, error } = await query;
      if (error && cleanCode && error.message && error.message.includes('column') && error.message.includes('line_code')) {
        let fallbackQuery = supabase.from('statuses_config').select('*');
        if (tenantId && tenantId !== 'main') {
          fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
        } else if (tenantId === 'main') {
          fallbackQuery = fallbackQuery.or('tenant_id.eq.main,tenant_id.is.null');
        }
        const res = await fallbackQuery;
        data = res.data;
      }
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
      let query = supabase.from('priority_config').select('*');
      if (tenantId && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      } else if (tenantId === 'main') {
        query = query.or('tenant_id.eq.main,tenant_id.is.null');
      }
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      }
      let { data, error } = await query;
      if (error && cleanCode && error.message && error.message.includes('column') && error.message.includes('line_code')) {
        let fallbackQuery = supabase.from('priority_config').select('*');
        if (tenantId && tenantId !== 'main') {
          fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
        } else if (tenantId === 'main') {
          fallbackQuery = fallbackQuery.or('tenant_id.eq.main,tenant_id.is.null');
        }
        const res = await fallbackQuery;
        data = res.data;
      }
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
      let query = supabase.from('zone_config').select('*');
      if (tenantId && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      } else if (tenantId === 'main') {
        query = query.or('tenant_id.eq.main,tenant_id.is.null');
      }
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      }
      let { data, error } = await query;
      if (error && cleanCode && error.message && error.message.includes('column') && error.message.includes('line_code')) {
        let fallbackQuery = supabase.from('zone_config').select('*');
        if (tenantId && tenantId !== 'main') {
          fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
        } else if (tenantId === 'main') {
          fallbackQuery = fallbackQuery.or('tenant_id.eq.main,tenant_id.is.null');
        }
        const res = await fallbackQuery;
        data = res.data;
      }
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
      let query = supabase.from(collection).select('*');
      if (tenantId && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      } else if (tenantId === 'main') {
        query = query.or('tenant_id.eq.main,tenant_id.is.null');
      }
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      }
      const { data: existingSup, error: selErr } = await query;
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
            const res = await supabase.from(collection).insert([{ [key]: item, config_type: collection, tenant_id: tenantId, line_code: activeLineCode || '' }]);
            if (!res.error) { inserted = true; break; }
          } catch (e) {}

          try {
            const res = await supabase.from(collection).insert([{ [key]: item, tenant_id: tenantId, line_code: activeLineCode || '' }]);
            if (!res.error) { inserted = true; break; }
          } catch (e) {}

          try {
            const res = await supabase.from(collection).insert([{ [key]: item, line_code: activeLineCode || '' }]);
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
  async getBillingMonths(dealerId: string = 'main', bypassLineCodeFilter: boolean | string | number = false, monthsBack: number = 6) {
    let effectiveMonthsBack = monthsBack;
    let effectiveBypass = bypassLineCodeFilter;
    if (typeof bypassLineCodeFilter === 'number') {
      effectiveMonthsBack = bypassLineCodeFilter;
      effectiveBypass = false;
    }

    try {
      const monthMap = new Map<string, any>();

      // Generate date cutoff and candidate month IDs for recent months
      const cutoffDate = new Date();
      cutoffDate.setDate(1);
      cutoffDate.setHours(0, 0, 0, 0);
      cutoffDate.setMonth(cutoffDate.getMonth() - Math.max(0, effectiveMonthsBack - 1));

      try {
        let query = supabase.from('billing_months').select('*');
        if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
          query = query.eq('dealer_id', dealerId);
        }
        const cleanBypass = typeof effectiveBypass === 'string' ? String(effectiveBypass || '').trim() : '';
        const cleanActive = String(activeLineCode || '').trim();
        if (effectiveBypass === true || effectiveBypass === 'all') {
          // Explicitly query all lines across network
        } else if (cleanBypass === '__without_line__' || effectiveBypass === null) {
          query = query.or('line_code.is.null,line_code.eq.');
        } else if (cleanBypass) {
          query = query.eq('line_code', cleanBypass);
        } else if (cleanActive) {
          query = query.eq('line_code', cleanActive);
        } else {
          // No line code set: strictly isolate to the "without line" room
          query = query.or('line_code.is.null,line_code.eq.');
        }

        // Limit to recent months ordered by newest first
        query = query.order('created', { ascending: false }).limit(Math.max(6, effectiveMonthsBack));

        const { data: supMonths } = await query;
        if (supMonths) {
          for (const em of supMonths) {
            const rowsFromData = parseRowsData(em.rows_data ?? em.rows);
            monthMap.set(em.month_id, {
              id: em.month_id,
              dbId: em.id,
              dealerId: em.dealer_id || dealerId,
              lineCode: em.line_code || '',
              rows: rowsFromData,
              excludedClientKeys: parseExcludedKeys(em),
              hasAuthoritativeRowsData: rowsFromData.length > 0,
              updatedAt: em.updated ? new Date(em.updated).getTime() : Date.now(),
              createdAt: em.created ? new Date(em.created).getTime() : Date.now()
            });
          }
        }
      } catch (err) {
        console.warn("billing_months fetch error:", err);
      }

      // Requirement 1: billing_rows is the source of truth. ALWAYS read billing_rows and overlay on blob rows
      try {
        let query = supabase.from('billing_rows').select('*');
        if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
          query = query.eq('dealer_id', dealerId);
        }
        const cleanBypass = typeof effectiveBypass === 'string' ? String(effectiveBypass || '').trim() : '';
        const cleanActive = String(activeLineCode || '').trim();
        if (effectiveBypass === true || effectiveBypass === 'all') {
          // Explicitly query all lines across network
        } else if (cleanBypass === '__without_line__' || effectiveBypass === null) {
          query = query.or('line_code.is.null,line_code.eq.');
        } else if (cleanBypass) {
          query = query.eq('line_code', cleanBypass);
        } else if (cleanActive) {
          query = query.eq('line_code', cleanActive);
        } else {
          query = query.or('line_code.is.null,line_code.eq.');
        }

        const candidateMonthIds = Array.from(monthMap.keys());
        if (candidateMonthIds.length > 0) {
          query = query.in('month_id', candidateMonthIds);
        } else {
          query = query.order('created', { ascending: false }).limit(2000);
        }

        const { data: rowRecords } = await query;
        if (rowRecords && rowRecords.length > 0) {
          const rowsByMonth = new Map<string, any[]>();
          for (const r of rowRecords) {
            const mId = r.month_id || 'UNKNOWN';
            if (isExcludedFromRecovery(r.name, r.username)) continue;
            if (activeLineCode && r.line_code && r.line_code.trim().toLowerCase() !== activeLineCode.trim().toLowerCase()) continue;
            if (!activeLineCode && (r.line_code || (r.dealer_id && r.dealer_id !== 'main'))) continue;
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
              panelDetails: r.panel_details || '',
              pkgDetails: r.pkg_details || '',
              sag: r.sag || '',
              lai: r.lai || '',
              connectionDate: r.connection_date || '',
              devicePrice: r.device_price || '',
              abl: r.abl || '',
              lineCode: r.line_code || '',
              lineId: r.line_id || null,
              reminderSentAt: r.reminder_sent_at || r.reminderSentAt || null,
              reminderSentCount: Number(r.reminder_sent_count ?? r.reminderSentCount ?? 0),
              line_code: r.line_code || '',
              line_id: r.line_id || null
            });
          }

          // Overlay billing_rows onto blob rows for each candidate month
          for (const [mId, monthObj] of monthMap.entries()) {
            const dbRowsForMonth = rowsByMonth.get(mId) || [];
            monthObj.rows = supabaseService.overlayBillingRows(mId, monthObj.rows || [], dbRowsForMonth);
            supabaseService._checkAndRepairDirtyBlob(mId, monthObj.dealerId || dealerId, monthObj.rows, monthObj.excludedClientKeys);
          }

          // Months present only in billing_rows are added to monthMap
          for (const [mId, rowList] of rowsByMonth.entries()) {
            if (!monthMap.has(mId)) {
              if (dealerId && dealerId !== 'main' && (!rowList || rowList.length === 0)) continue;
              monthMap.set(mId, {
                id: mId,
                dealerId: dealerId || 'main',
                lineCode: activeLineCode || '',
                rows: rowList,
                excludedClientKeys: [],
                hasAuthoritativeRowsData: true,
                updatedAt: Date.now(),
                createdAt: Date.now()
              });
            }
          }
        }
      } catch (err) {
        console.warn("billing_rows fetch error:", err);
      }

      const sortedList = Array.from(monthMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      try {
        const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        globalTableCaches[exactKey] = sortedList;
        try {
          localStorage.setItem(`gts_cache_v3_${exactKey}`, JSON.stringify(sortedList));
          localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
        } catch (e) {}
      } catch (e) {}

      return sortedList;
    } catch (e) {
      console.error("Failed to get billing months:", e);
      return [];
    }
  },

  getBillingMonthsList: async (dealerId: string = 'main', bypassLineCodeFilter: boolean | string = false): Promise<{id: string, dealerId: string, lineCode: string, createdAt: number, rows?: undefined}[]> => {
    try {
      let query = supabase.from('billing_months').select('month_id, dealer_id, line_code, created');
      if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
        query = query.eq('dealer_id', dealerId);
      }
      const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
      const cleanActive = String(activeLineCode || '').trim();
      if (bypassLineCodeFilter === true || bypassLineCodeFilter === 'all') {
        // Explicitly query all lines across network
      } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
        query = query.or('line_code.is.null,line_code.eq.');
      } else if (cleanBypass) {
        query = query.eq('line_code', cleanBypass);
      } else if (cleanActive) {
        query = query.eq('line_code', cleanActive);
      } else {
        // No line code set: strictly isolate to the "without line" room
        query = query.or('line_code.is.null,line_code.eq.');
      }

      const { data: supMonths } = await query;
      if (supMonths) {
        const monthMap = new Map<string, { id: string; dealerId: string; lineCode: string; createdAt: number; rows: undefined }>();
        for (const em of supMonths) {
          const mId = em.month_id;
          if (!mId) continue;
          const cTime = em.created ? new Date(em.created).getTime() : Date.now();
          if (!monthMap.has(mId) || cTime > (monthMap.get(mId)!.createdAt || 0)) {
            monthMap.set(mId, {
              id: mId,
              dealerId: em.dealer_id || dealerId,
              lineCode: em.line_code || '',
              createdAt: cTime,
              rows: undefined
            });
          }
        }
        return Array.from(monthMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      }
      return [];
    } catch (e) {
      console.error("Failed to get billing months list:", e);
      return [];
    }
  },

  getBillingMonthsHistory: async (monthId: string, dealerId: string = 'main', bypassLineCodeFilter: boolean | string = false) => {
    try {
      const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;

      // Helper function to fetch from database
      const fetchFromDb = async () => {
        const monthMap = new Map<string, any>();

        try {
          let query = supabase.from('billing_months').select('*').eq('month_id', monthId);
          if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
            query = query.eq('dealer_id', dealerId);
          }
          const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
          const cleanActive = String(activeLineCode || '').trim();
          if (bypassLineCodeFilter === true || bypassLineCodeFilter === 'all') {
            // Explicitly query all lines across network
          } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
            query = query.or('line_code.is.null,line_code.eq.');
          } else if (cleanBypass) {
            query = query.eq('line_code', cleanBypass);
          } else if (cleanActive) {
            query = query.eq('line_code', cleanActive);
          } else {
            query = query.or('line_code.is.null,line_code.eq.');
          }

          const { data: supMonths } = await query;
          if (supMonths) {
            for (const em of supMonths) {
              const rowsFromData = parseRowsData(em.rows_data ?? em.rows);
              monthMap.set(em.month_id, {
                id: em.month_id,
                dbId: em.id,
                dealerId: em.dealer_id || dealerId,
                lineCode: em.line_code || '',
                rows: rowsFromData,
                excludedClientKeys: parseExcludedKeys(em),
                hasAuthoritativeRowsData: rowsFromData.length > 0,
                updatedAt: em.updated ? new Date(em.updated).getTime() : Date.now(),
                createdAt: em.created ? new Date(em.created).getTime() : Date.now()
              });
            }
          }
        } catch (err) {}

        try {
          let query = supabase.from('billing_rows').select('*').eq('month_id', monthId);
          if (dealerId && dealerId !== 'main' && dealerId !== 'all') {
            query = query.eq('dealer_id', dealerId);
          }
          const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
          const cleanActive = String(activeLineCode || '').trim();
          if (bypassLineCodeFilter === true || bypassLineCodeFilter === 'all') {
            // Explicitly query all lines across network
          } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
            query = query.or('line_code.is.null,line_code.eq.');
          } else if (cleanBypass) {
            query = query.eq('line_code', cleanBypass);
          } else if (cleanActive) {
            query = query.eq('line_code', cleanActive);
          } else {
            query = query.or('line_code.is.null,line_code.eq.');
          }

          const { data: rowRecords } = await query;
          if (rowRecords && rowRecords.length > 0) {
            const rowsByMonth = new Map<string, any[]>();
            for (const r of rowRecords) {
              const mId = r.month_id || 'UNKNOWN';
              if (isExcludedFromRecovery(r.name, r.username)) continue;
              if (activeLineCode && r.line_code && r.line_code.trim().toLowerCase() !== activeLineCode.trim().toLowerCase()) continue;
              if (!activeLineCode && (r.line_code || (r.dealer_id && r.dealer_id !== 'main'))) continue;
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
                panelDetails: r.panel_details || '',
                pkgDetails: r.pkg_details || '',
                sag: r.sag || '',
                lai: r.lai || '',
                connectionDate: r.connection_date || '',
                devicePrice: r.device_price || '',
                abl: r.abl || '',
                lineCode: r.line_code || '',
                lineId: r.line_id || null,
                reminderSentAt: r.reminder_sent_at || r.reminderSentAt || null,
                reminderSentCount: Number(r.reminder_sent_count ?? r.reminderSentCount ?? 0),
                line_code: r.line_code || '',
                line_id: r.line_id || null
              });
            }

            for (const [mId, rowList] of rowsByMonth.entries()) {
              if (!monthMap.has(mId)) {
                if (dealerId && dealerId !== 'main' && (!rowList || rowList.length === 0)) continue;
                monthMap.set(mId, {
                  id: mId,
                  dealerId: dealerId || 'main',
                  lineCode: activeLineCode || '',
                  rows: rowList,
                  hasAuthoritativeRowsData: true,
                  updatedAt: Date.now(),
                  createdAt: Date.now()
                });
              } else {
                const existingMonth = monthMap.get(mId);
                if (existingMonth) {
                  existingMonth.rows = supabaseService.overlayBillingRows(mId, existingMonth.rows || [], rowList);
                  supabaseService._checkAndRepairDirtyBlob(mId, existingMonth.dealerId || dealerId, existingMonth.rows, existingMonth.excludedClientKeys);
                }
              }
            }
          } else if (monthMap.has(monthId)) {
            const existingMonth = monthMap.get(monthId);
            if (existingMonth) {
              supabaseService._checkAndRepairDirtyBlob(monthId, existingMonth.dealerId || dealerId, existingMonth.rows, existingMonth.excludedClientKeys);
            }
          }
        } catch (err) {}

        return monthMap.get(monthId) || null;
      };

      const updateExactCache = (resolvedMonth: any) => {
        if (!resolvedMonth) return;
        if (!globalTableCaches[exactKey]) globalTableCaches[exactKey] = [];
        const idx = globalTableCaches[exactKey].findIndex((m: any) => (m?.id || m?.month_id) === monthId);
        if (idx >= 0) {
          globalTableCaches[exactKey][idx] = resolvedMonth;
        } else {
          globalTableCaches[exactKey].push(resolvedMonth);
        }
        try {
          localStorage.setItem(`gts_cache_v3_${exactKey}`, JSON.stringify(globalTableCaches[exactKey]));
          localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
        } catch (e) {}

        const subs = globalTableSubscribers[exactKey];
        if (subs) {
          subs.forEach(cb => { try { cb([...globalTableCaches[exactKey]], true); } catch(e){} });
        }
      };

      // 1. Check exact key cache with 12h expiry
      let cachedMonth: any = null;
      let isCacheValid = false;
      try {
        const metaStr = localStorage.getItem(`gts_cache_meta_${exactKey}`);
        const metaTime = metaStr ? Number(metaStr) : 0;
        if (metaTime && Date.now() - metaTime <= CACHE_MAX_AGE_MS) {
          const inMem = globalTableCaches[exactKey];
          if (Array.isArray(inMem)) {
            const found = inMem.find((m: any) => (m?.id || m?.month_id) === monthId);
            if (found && Array.isArray(found.rows) && found.rows.length > 0) {
              cachedMonth = found;
              isCacheValid = true;
            }
          }
          if (!cachedMonth) {
            const raw = localStorage.getItem(`gts_cache_v3_${exactKey}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const found = parsed.find((m: any) => (m?.id || m?.month_id) === monthId);
                if (found && Array.isArray(found.rows) && found.rows.length > 0) {
                  cachedMonth = found;
                  isCacheValid = true;
                }
              }
            }
          }
        }
      } catch (e) {}

      if (isCacheValid && cachedMonth) {
        // Return cached month immediately, and always revalidate from database in background
        fetchFromDb().then(freshMonth => {
          if (freshMonth) {
            const cachedStr = JSON.stringify(cachedMonth.rows || []);
            const freshStr = JSON.stringify(freshMonth.rows || []);
            if (cachedStr !== freshStr) {
              updateExactCache(freshMonth);
            }
          }
        }).catch(console.warn);
        return cachedMonth;
      }

      // If cache is older than 12 hours or not found, fetch from the database first
      const freshResult = await fetchFromDb();
      if (freshResult) {
        updateExactCache(freshResult);
      }
      return freshResult;
    } catch (e) {
      console.error("Failed to get billing month history:", e);
      return null;
    }
  },

  getBillingMonthRowsDirect: async (monthId: string, dealerId: string = 'main', bypassLineCodeFilter: boolean | string = false) => {
    try {
      let query = supabase.from('billing_rows').select('*').eq('month_id', monthId).eq('dealer_id', dealerId);
      
        const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';
        const cleanActive = String(activeLineCode || '').trim();
        if (bypassLineCodeFilter === true) {
          // no filter
        } else if (cleanBypass) {
          query = query.eq('line_code', cleanBypass);
        } else if (cleanActive) {
          query = query.eq('line_code', cleanActive);
        }

      const { data: records } = await query;
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
          panelDetails: r.panel_details || '',
          pkgDetails: r.pkg_details || '',
          sag: r.sag || '',
          lai: r.lai || '',
          connectionDate: r.connection_date || '',
          devicePrice: r.device_price || '',
          abl: r.abl || '',
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  overlayBillingRows(monthId: string, blobRows: any[], dbRows: any[]): any[] {
    if (!Array.isArray(dbRows) || dbRows.length === 0) {
      return Array.isArray(blobRows) ? blobRows : [];
    }
    const safeBlobRows = Array.isArray(blobRows) ? blobRows : [];

    const dbByClientId = new Map<string, any>();
    const dbByUsername = new Map<string, any>();

    dbRows.forEach(dr => {
      const cid = dr.clientId || dr.client_id || dr.id;
      if (cid !== undefined && cid !== null && String(cid).trim() !== '') {
        dbByClientId.set(String(cid).trim().toLowerCase(), dr);
      }
      if (dr.username && String(dr.username).trim() !== '') {
        dbByUsername.set(String(dr.username).trim().toLowerCase(), dr);
      }
    });

    const matchedDbRows = new Set<any>();
    let changesCount = 0;

    const mergedRows = safeBlobRows.map((bRow) => {
      const cloned = { ...bRow };
      const bCid = cloned.clientId || cloned.client_id || cloned.id;
      const bNormCid = bCid !== undefined && bCid !== null ? String(bCid).trim().toLowerCase() : '';
      const bUname = cloned.username ? String(cloned.username).trim().toLowerCase() : '';

      let dbMatch: any = null;
      if (bNormCid && dbByClientId.has(bNormCid)) {
        dbMatch = dbByClientId.get(bNormCid);
      } else if (bUname && dbByUsername.has(bUname)) {
        dbMatch = dbByUsername.get(bUname);
      }

      if (dbMatch) {
        matchedDbRows.add(dbMatch);
        const clientIdForLog = bCid || dbMatch.clientId || dbMatch.client_id || cloned.username || 'unknown';

        const updateField = (camelField: string, snakeField: string, isNumeric = false) => {
          const oldVal = cloned[camelField] !== undefined ? cloned[camelField] : cloned[snakeField];
          const rawNewVal = dbMatch[camelField] !== undefined ? dbMatch[camelField] : dbMatch[snakeField];
          if (rawNewVal === undefined) return;

          const newVal = isNumeric ? (Number(rawNewVal) || 0) : String(rawNewVal ?? '');
          const isDiff = isNumeric
            ? (Number(oldVal || 0) !== Number(newVal || 0))
            : (String(oldVal ?? '').trim() !== String(newVal ?? '').trim());

          if (isDiff) {
            console.log(`[Billing Overlay] Stale blob corrected (month: ${monthId}, client: ${clientIdForLog}, field: ${camelField}, old: "${oldVal}", new: "${newVal}")`);
            changesCount++;
            cloned[camelField] = newVal;
            cloned[snakeField] = newVal;
          }
        };

        // Payment and subscriber fields specified in Requirement 1:
        // payment_received, payment_status, cr, total_amount, comments, username, name, mobile_number, area, pkg_details, rt, panel_details, billing_day, base_amount
        updateField('paymentReceived', 'payment_received', true);
        updateField('paymentStatus', 'payment_status', false);
        updateField('cr', 'cr', true);
        updateField('totalAmount', 'total_amount', true);
        updateField('baseAmount', 'base_amount', true);
        updateField('comments', 'comments', false);
        updateField('username', 'username', false);
        updateField('name', 'name', false);
        updateField('mobileNumber', 'mobile_number', false);
        updateField('area', 'area', false);
        updateField('pkgDetails', 'pkg_details', false);
        updateField('rt', 'rt', false);
        updateField('panelDetails', 'panel_details', false);
        updateField('billingDay', 'billing_day', false);

        // Advance fields if present in billing_rows
        if (dbMatch.occ !== undefined) cloned.occ = dbMatch.occ;
        if (dbMatch.devicePrice !== undefined) cloned.devicePrice = dbMatch.devicePrice;
        if (dbMatch.abl !== undefined) cloned.abl = dbMatch.abl;
        if (dbMatch.connectionDate !== undefined) cloned.connectionDate = dbMatch.connectionDate;
      }

      return cloned;
    });

    // Rows present only in billing_rows are appended
    for (const dr of dbRows) {
      if (!matchedDbRows.has(dr)) {
        mergedRows.push({ ...dr });
        console.log(`[Billing Overlay] Appended row present only in billing_rows (month: ${monthId}, client: ${dr.clientId || dr.client_id || dr.username})`);
        changesCount++;
      }
    }

    if (changesCount > 0) {
      console.log(`[Billing Overlay] Month "${monthId}": overlaid ${changesCount} changes from billing_rows onto blob rows`);
    }

    return mergedRows;
  },

  _checkAndRepairDirtyBlob(monthId: string, dealerId: string = 'main', mergedRows: any[], excludedClientKeys?: string[]) {
    try {
      const markerKey = `gts_blob_dirty_${monthId}_${dealerId || 'main'}`;
      if (typeof window !== 'undefined' && localStorage.getItem(markerKey) === '1') {
        localStorage.removeItem(markerKey);
        const payload: any = {
          month_id: monthId,
          dealer_id: dealerId || 'main',
          line_code: activeLineCode || '',
          line_id: activeLineId || null,
          rows_data: { rows: mergedRows, excludedClientKeys: excludedClientKeys || [] },
          updated_by: 'system_repair'
        };
        console.log(`[Billing Stale-Proof] Found dirty blob marker "${markerKey}". Scheduling fresh blob write from merged rows.`);
        this.scheduleBackgroundBillingMonthBlob(monthId, dealerId || 'main', payload);
      }
    } catch (e) {}
  },

  getBillingMonthDirect: async (monthId: string, dealerId: string = 'main') => {
    try {
      if (!supabase) return null;
      const { data } = await supabase
        .from('billing_months')
        .select('*')
        .eq('month_id', monthId)
        .eq('dealer_id', dealerId)
        .maybeSingle();

      let blobRows: any[] = [];
      let excludedClientKeys: string[] = [];
      let updatedAt = Date.now();

      if (data) {
        if (data.rows_data) {
          let rows = data.rows_data;
          if (typeof rows === 'string') {
            try { rows = JSON.parse(rows); } catch (e) { rows = []; }
          }
          if (rows && typeof rows === 'object' && !Array.isArray(rows) && 'rows' in rows) {
            if (Array.isArray(rows.rows)) {
              rows = rows.rows;
            }
          }
          if (Array.isArray(rows)) {
            blobRows = rows;
          }
        }
        excludedClientKeys = parseExcludedKeys(data);
        if (data.updated) {
          updatedAt = new Date(data.updated).getTime();
        }
      }

      // ALWAYS also read billing_rows for that month_id and dealer_id (source of truth)
      const singleRows = await supabaseService.getBillingMonthRowsDirect(monthId, dealerId);

      // Overlay billing_rows onto blob rows
      const mergedRows = supabaseService.overlayBillingRows(monthId, blobRows, singleRows || []);

      if (mergedRows.length > 0 || data) {
        supabaseService._checkAndRepairDirtyBlob(monthId, dealerId, mergedRows, excludedClientKeys);

        return {
          id: monthId,
          dbId: data?.id,
          month_id: monthId,
          dealerId: data?.dealer_id || dealerId,
          lineCode: data?.line_code || '',
          rows: mergedRows,
          rowsLoaded: true,
          excludedClientKeys,
          updatedAt
        };
      }

      return null;
    } catch (e) {
      console.error("Direct fetch for billing month failed:", e);
      return null;
    }
  },

  async createBillingMonth(monthId: string, rows: any[], createdBy: string, dealerId?: string) {
    await this.saveBillingMonth(monthId, rows, createdBy, dealerId || 'main');
  },

  _saveBillingMonthTimers: {} as Record<string, any>,
  _saveBillingMonthLatestRows: {} as Record<string, { rows: any[], updatedBy: string, changedIndices?: Set<number>, excludedClientKeys?: string[], baseRows?: any[] }>,
  _billingMonthSaveCounter: {} as Record<string, number>,
  _backgroundBlobTimers: {} as Record<string, any>,
  _backgroundBlobPayloads: {} as Record<string, any>,
  _backgroundBlobLocks: {} as Record<string, Promise<void>>,
  _backgroundBlobListenerAdded: false,

  scheduleBackgroundBillingMonthBlob(monthId: string, dealerId: string, payload: any) {
    const syncKey = `${monthId}_${dealerId}_${activeLineCode || 'nolc'}`;
    if (!this._backgroundBlobPayloads) this._backgroundBlobPayloads = {};
    if (!this._backgroundBlobTimers) this._backgroundBlobTimers = {};
    if (!this._backgroundBlobLocks) this._backgroundBlobLocks = {};

    // Requirement 3: Mark dirty in localStorage while background blob write is pending
    try {
      localStorage.setItem(`gts_blob_dirty_${monthId}_${dealerId || 'main'}`, '1');
    } catch (e) {}

    // Last write wins for this month key
    this._backgroundBlobPayloads[syncKey] = payload;

    if (typeof window !== 'undefined' && !this._backgroundBlobListenerAdded) {
      this._backgroundBlobListenerAdded = true;
      const flushAll = () => {
        if (!this._backgroundBlobPayloads) return;
        Object.keys(this._backgroundBlobPayloads).forEach(key => {
          this.flushBackgroundBillingMonthBlob(key);
        });
      };
      window.addEventListener('beforeunload', flushAll);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushAll();
        }
      });
    }

    if (this._backgroundBlobTimers[syncKey]) {
      clearTimeout(this._backgroundBlobTimers[syncKey]);
    }

    this._backgroundBlobTimers[syncKey] = setTimeout(() => {
      delete this._backgroundBlobTimers[syncKey];
      this.flushBackgroundBillingMonthBlob(syncKey);
    }, 2000);
  },

  flushBackgroundBillingMonthBlob(syncKey: string): Promise<void> {
    if (this._backgroundBlobTimers && this._backgroundBlobTimers[syncKey]) {
      clearTimeout(this._backgroundBlobTimers[syncKey]);
      delete this._backgroundBlobTimers[syncKey];
    }

    const payload = this._backgroundBlobPayloads ? this._backgroundBlobPayloads[syncKey] : null;
    if (!payload) return Promise.resolve();
    delete this._backgroundBlobPayloads[syncKey];

    const monthId = payload.month_id;
    const dealerId = payload.dealer_id || 'main';

    // Keep the per-month execution lock so two writes of the same month never overlap
    if (!this._backgroundBlobLocks) this._backgroundBlobLocks = {};
    const previousLock = this._backgroundBlobLocks[syncKey] || Promise.resolve();

    const currentRun = previousLock.then(async () => {
      const tStart = performance.now();
      try {
        await withTimeout(
          upsertSupabase('billing_months', 'month_id', payload.month_id, payload, true),
          25000,
          'Background billing month blob upsert'
        );
        const elapsed = Math.round(performance.now() - tStart);
        console.log(`[Save Timing] Background blob upsert for month "${payload.month_id}" completed in ${elapsed}ms`);
        // Successfully flushed: clear the dirty marker
        try {
          localStorage.removeItem(`gts_blob_dirty_${monthId}_${dealerId}`);
        } catch (e) {}
      } catch (err: any) {
        // Failed flush: keep dirty marker in localStorage for recovery on next load
        try {
          localStorage.setItem(`gts_blob_dirty_${monthId}_${dealerId}`, '1');
        } catch (e) {}
        console.error(`[Background Blob] Failed to upsert billing month blob for ${payload.month_id}:`, err);
        toast.error("Background month archive sync failed", {
          description: `Recovery rows are saved, but the full monthly backup failed: ${err?.message || 'Database error'}.`,
          duration: 6000
        });
      }
    });

    this._backgroundBlobLocks[syncKey] = currentRun.catch(() => {});
    return currentRun;
  },

  async saveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', forceImmediate = false, changedIndices?: number[] | Set<number>, excludedClientKeys?: string[], freshBase = false, baseRows?: any[]) {
    const key = `${monthId}_${dealerId}`;
    if (!this._saveBillingMonthLatestRows) this._saveBillingMonthLatestRows = {};
    if (!this._billingMonthSaveCounter) this._billingMonthSaveCounter = {};
    
    // Safely accumulate changedIndices into a Set so multiple fast cell updates retain all changed row indices
    const existing = this._saveBillingMonthLatestRows[key];
    let mergedChangedIndices: Set<number> | undefined = undefined;
    if (changedIndices && existing && existing.changedIndices !== undefined) {
      mergedChangedIndices = new Set<number>(existing.changedIndices);
      const newIndices = Array.isArray(changedIndices) ? changedIndices : Array.from(changedIndices);
      newIndices.forEach(i => mergedChangedIndices!.add(i));
    } else if (changedIndices) {
      mergedChangedIndices = new Set<number>(Array.isArray(changedIndices) ? changedIndices : Array.from(changedIndices));
    } else {
      mergedChangedIndices = undefined;
    }

    // Resolve excludedClientKeys: if not explicitly provided, preserve existing from cache or latest rows
    let finalExcludedKeys = excludedClientKeys;
    if (finalExcludedKeys === undefined) {
      if (existing && existing.excludedClientKeys !== undefined) {
        finalExcludedKeys = existing.excludedClientKeys;
      } else {
        const primaryKey = `billing_months_${dealerId || 'main'}_${activeLineCode || 'nolc'}`;
        const cached = (globalTableCaches[primaryKey] || []).find((m: any) => m.id === monthId || m.month_id === monthId);
        if (cached && cached.excludedClientKeys) {
          finalExcludedKeys = cached.excludedClientKeys;
        } else {
          finalExcludedKeys = [];
        }
      }
    }

    this._saveBillingMonthLatestRows[key] = { rows, updatedBy, changedIndices: mergedChangedIndices, excludedClientKeys: finalExcludedKeys, baseRows };
    const currentCounter = (this._billingMonthSaveCounter[key] || 0) + 1;
    this._billingMonthSaveCounter[key] = currentCounter;

    // Synchronously update globalTableCaches and defer localStorage for instant UI updates
    const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
    if (!globalTableCaches[exactKey]) globalTableCaches[exactKey] = [];
    const idx = globalTableCaches[exactKey].findIndex((m: any) => m.id === monthId || m.month_id === monthId);
    const updatedObj = {
      id: monthId,
      month_id: monthId,
      dealerId: dealerId || 'all',
      rows,
      rows_data: { rows, excludedClientKeys: finalExcludedKeys },
      excludedClientKeys: finalExcludedKeys,
      updated_by: updatedBy,
      updatedAt: Date.now()
    };
    if (idx !== -1) {
      globalTableCaches[exactKey][idx] = { ...globalTableCaches[exactKey][idx], ...updatedObj };
    } else {
      globalTableCaches[exactKey].unshift(updatedObj);
    }

    setTimeout(() => {
      try {
        localStorage.setItem(`gts_cache_v3_${exactKey}`, JSON.stringify(globalTableCaches[exactKey]));
        localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
      } catch (e) {}
    }, 0);
    
    if (!this._saveBillingMonthTimers) this._saveBillingMonthTimers = {};

    if (forceImmediate) {
      if (this._saveBillingMonthTimers[key]) {
        clearTimeout(this._saveBillingMonthTimers[key].timerId);
        if (this._saveBillingMonthTimers[key].resolve) this._saveBillingMonthTimers[key].resolve();
        delete this._saveBillingMonthTimers[key];
      }
      const latest = this._saveBillingMonthLatestRows[key];
      if (latest) {
        await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId, latest.changedIndices, currentCounter, latest.excludedClientKeys, freshBase, latest.baseRows || baseRows);
        delete this._saveBillingMonthLatestRows[key];
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
            await this._executeSaveBillingMonth(monthId, latest.rows, latest.updatedBy, dealerId, latest.changedIndices, currentCounter, latest.excludedClientKeys, freshBase, latest.baseRows || baseRows);
            delete this._saveBillingMonthLatestRows[key];
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

  async _executeSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', changedIndices?: number[] | Set<number>, executeCounter?: number, excludedClientKeys?: string[], skipDbFetch?: boolean, baseRows?: any[]) {
    const syncKey = `${monthId}_${dealerId}_${activeLineCode || 'nolc'}`;
    if (!this._billingMonthExecutionLocks) this._billingMonthExecutionLocks = {};
    
    const previous = this._billingMonthExecutionLocks[syncKey] || Promise.resolve();
    
    const run = previous.then(() => {
      return this._doExecuteSaveBillingMonth(monthId, rows, updatedBy, dealerId, changedIndices, excludedClientKeys, skipDbFetch, baseRows);
    });
    
    this._billingMonthExecutionLocks[syncKey] = run.catch(() => {});
    return run;
  },

  async _doExecuteSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main', changedIndices?: number[] | Set<number>, excludedClientKeys?: string[], skipDbFetch?: boolean, baseRows?: any[]) {
    const syncKey = `${monthId}_${dealerId}_${activeLineCode || 'nolc'}`;
    if (!this._syncingMonths) this._syncingMonths = new Set<string>();
    this._syncingMonths.add(syncKey);

    const countRecordedPaymentRows = (rowList: any[]) => {
      if (!Array.isArray(rowList)) return 0;
      return rowList.filter((r: any) => {
        const pRec = Number(r.paymentReceived) || 0;
        const pStat = String(r.paymentStatus || '').trim().toLowerCase();
        return pRec > 0 || (pStat !== '' && pStat !== 'unpaid');
      }).length;
    };

    const hasChangedIndices = Boolean(
      changedIndices &&
      ((Array.isArray(changedIndices) && changedIndices.length > 0) ||
       (changedIndices instanceof Set && changedIndices.size > 0))
    );

    // Fetch existing month data from database before saving to validate data integrity
    let dbTotal = 0;
    let dbPaidCount = 0;
    let existingRowsParsed: any[] = [];
    if (!skipDbFetch) {
      if (baseRows && Array.isArray(baseRows) && baseRows.length > 0 && hasChangedIndices) {
        existingRowsParsed = baseRows;
        dbTotal = baseRows.length;
        dbPaidCount = countRecordedPaymentRows(baseRows);
      } else {
        try {
          const { data: dbData } = await supabase
            .from('billing_months')
            .select('rows_data')
            .eq('month_id', monthId)
            .eq('dealer_id', dealerId)
            .maybeSingle();

          if (dbData && dbData.rows_data) {
            let existingRows = dbData.rows_data;
            if (typeof existingRows === 'string') {
              try { existingRows = JSON.parse(existingRows); } catch (e) { existingRows = []; }
            }
            if (existingRows && typeof existingRows === 'object' && !Array.isArray(existingRows) && 'rows' in existingRows) {
              if (Array.isArray(existingRows.rows)) {
                existingRows = existingRows.rows;
              }
            }
            if (Array.isArray(existingRows)) {
              existingRowsParsed = existingRows;
              dbTotal = existingRows.length;
              dbPaidCount = countRecordedPaymentRows(existingRows);
            }
          }
        } catch (checkErr) {
          console.warn("Could not fetch previous month data for validation check:", checkErr);
        }
      }
    } else {
      if (baseRows && Array.isArray(baseRows) && baseRows.length > 0 && hasChangedIndices) {
        existingRowsParsed = baseRows;
        dbTotal = baseRows.length;
        dbPaidCount = countRecordedPaymentRows(baseRows);
      } else {
        dbTotal = rows.length;
        dbPaidCount = countRecordedPaymentRows(rows);
      }
    }

    // STALE-PROOF SAVES: when changedIndices is provided and non-empty,
    // build rows to save from the DATABASE rows and replace ONLY the changed rows
    if (hasChangedIndices && existingRowsParsed.length > 0) {
      const changedIndicesSet = changedIndices instanceof Set ? changedIndices : new Set(changedIndices);
      const changedIncomingRows: any[] = [];
      changedIndicesSet.forEach(idx => {
        if (rows[idx]) {
          changedIncomingRows.push(rows[idx]);
        }
      });

      const mergedDbRows = existingRowsParsed.map(dbRow => ({ ...dbRow }));
      const matchedIncoming = new Set<any>();

      changedIncomingRows.forEach(incRow => {
        const uKey = incRow.username ? String(incRow.username).toLowerCase().trim() : null;
        const iKey = incRow.clientId ? String(incRow.clientId).toLowerCase().trim() : null;
        const idKey = incRow.id ? String(incRow.id).toLowerCase().trim() : null;

        const dbIdx = mergedDbRows.findIndex(dbRow => {
          const dbUKey = dbRow.username ? String(dbRow.username).toLowerCase().trim() : null;
          const dbIKey = dbRow.clientId ? String(dbRow.clientId).toLowerCase().trim() : null;
          const dbIdKey = dbRow.id ? String(dbRow.id).toLowerCase().trim() : null;
          return (uKey && dbUKey === uKey) || (iKey && dbIKey === iKey) || (idKey && dbIdKey === idKey);
        });

        if (dbIdx !== -1) {
          mergedDbRows[dbIdx] = { ...mergedDbRows[dbIdx], ...incRow };
          matchedIncoming.add(incRow);
        }
      });

      changedIncomingRows.forEach(incRow => {
        if (!matchedIncoming.has(incRow)) {
          mergedDbRows.push(incRow);
        }
      });

      rows = mergedDbRows;
    }

    const incomingTotal = Array.isArray(rows) ? rows.length : 0;
    const incomingPaidCount = countRecordedPaymentRows(rows);

    // AUDIT LOGGING (Requirement 4): Log incoming vs existing row counts and payment activity
    console.log(`Saving billing month "${monthId}": incoming ${incomingTotal} rows (paid/recorded: ${incomingPaidCount}), previous ${dbTotal} rows (paid/recorded: ${dbPaidCount})`);

    let wipedCommentsCount = 0;
    let totalExistingComments = 0;

    if (existingRowsParsed.length > 0) {
      const incomingRowsMap = new Map();
      rows.forEach(r => {
        const uKey = r.username ? `u_${String(r.username).toLowerCase().trim()}` : null;
        const iKey = r.clientId ? `i_${String(r.clientId).toLowerCase().trim()}` : null;
        const idKey = r.id ? `id_${String(r.id).toLowerCase().trim()}` : null;
        
        if (uKey) incomingRowsMap.set(uKey, r);
        if (iKey) incomingRowsMap.set(iKey, r);
        if (idKey) incomingRowsMap.set(idKey, r);
      });

      existingRowsParsed.forEach(er => {
        const uKey = er.username ? `u_${String(er.username).toLowerCase().trim()}` : null;
        const iKey = er.clientId ? `i_${String(er.clientId).toLowerCase().trim()}` : null;
        const idKey = er.id ? `id_${String(er.id).toLowerCase().trim()}` : null;
        
        const oldComment = String(er.comments || '').trim();
        if ((uKey || iKey || idKey) && oldComment !== '') {
          totalExistingComments++;
          
          let incRow = null;
          if (uKey && incomingRowsMap.has(uKey)) incRow = incomingRowsMap.get(uKey);
          else if (iKey && incomingRowsMap.has(iKey)) incRow = incomingRowsMap.get(iKey);
          else if (idKey && incomingRowsMap.has(idKey)) incRow = incomingRowsMap.get(idKey);
          
          const newComment = incRow ? String(incRow.comments || '').trim() : '';
          
          // PRESERVE COMMENTS: If the new row has empty comments but the old row had comments, we automatically migrate/preserve the comments instead of losing them!
          if (incRow && newComment === '' && oldComment !== '') {
             incRow.comments = oldComment;
          } else if (!incRow && oldComment !== '') {
            // The row itself is missing from the incoming save entirely — that's a genuine loss.
            wipedCommentsCount++;
          }
          // NOTE: a comment changing from one non-empty value to a DIFFERENT
          // non-empty value is a normal, intentional user edit — it must
          // NOT be counted as "wiped", otherwise every legitimate comment
          // edit gets flagged as data loss and blocks the save.
        }
      });
    }

    // HARD SAFETY CHECK (Requirement 2): Prevent silent overwriting/wiping of existing payment records and comments
    if (incomingTotal === 0 && dbTotal > 0) {
      console.warn(`[Save Safety] Refusing to save 0 rows over existing ${dbTotal} database rows for "${monthId}".`);
      return;
    }
    if (dbPaidCount > 0 && incomingPaidCount === 0 && dbTotal > 10) {
      console.warn(`[Save Safety] Refusing to overwrite ${dbPaidCount} paid records with 0 paid records for "${monthId}".`);
      return;
    }

    const isWipingPaymentRecords = dbPaidCount > 0 && incomingPaidCount === 0 && dbTotal <= 10;
    const isSeverelyReducingPaidRows = dbPaidCount >= 3 && incomingPaidCount < Math.floor(dbPaidCount * 0.4);
    const isWipingTotalRows = dbTotal >= 5 && incomingTotal === 0;
    const isWipingComments = totalExistingComments > 3 && wipedCommentsCount > totalExistingComments * 0.3;

    if (isWipingPaymentRecords || isSeverelyReducingPaidRows || isWipingTotalRows || isWipingComments) {
      let alertMsg = `Save blocked: this would erase existing payment records for "${monthId}" (${incomingPaidCount} paid/recorded rows incoming vs ${dbPaidCount} currently in database). Please refresh and try again.`;
      if (isWipingComments) {
        alertMsg = `Save blocked: this would erase/revert existing comments for "${monthId}" (${wipedCommentsCount} out of ${totalExistingComments} comments would be lost). Please refresh and try again.`;
      }
      console.error(`🚨 CRITICAL DATA LOSS PREVENTED: ${alertMsg}`);
      throw new Error(alertMsg);
    }
    try {
      const payload: any = {
        month_id: monthId,
        dealer_id: dealerId,
        line_code: activeLineCode || '',
        line_id: activeLineId || null,
        rows_data: { rows, excludedClientKeys: excludedClientKeys || [] },
        updated_by: updatedBy
      };

      // 1. Sync billing rows (awaited)
      const tSyncStart = performance.now();
      await withTimeout(this.syncBillingRows(monthId, dealerId, rows, changedIndices), 20000, 'Syncing billing rows');
      const syncDuration = Math.round(performance.now() - tSyncStart);
      console.log(`[Save Timing] syncBillingRows for month "${monthId}" took ${syncDuration}ms`);

      const syncKey = `${monthId}_${dealerId}_${activeLineCode || 'nolc'}`;

      // 2. Requirement 2: Full syncs (without changedIndices: month creation, Recheck Users, deletes)
      // must write the blob synchronously (awaited), never through background debounce, so deleted rows
      // cannot be resurrected by an old blob.
      if (!hasChangedIndices) {
        if (this._backgroundBlobTimers && this._backgroundBlobTimers[syncKey]) {
          clearTimeout(this._backgroundBlobTimers[syncKey]);
          delete this._backgroundBlobTimers[syncKey];
        }
        if (this._backgroundBlobPayloads) {
          delete this._backgroundBlobPayloads[syncKey];
        }

        const tBlobStart = performance.now();
        await withTimeout(
          upsertSupabase('billing_months', 'month_id', payload.month_id, payload, true),
          25000,
          'Full sync billing month blob upsert'
        );
        const blobDuration = Math.round(performance.now() - tBlobStart);
        console.log(`[Save Timing] Synchronous blob upsert for month "${monthId}" took ${blobDuration}ms`);

        // Clear dirty marker
        try {
          localStorage.removeItem(`gts_blob_dirty_${monthId}_${dealerId}`);
        } catch (e) {}
      } else {
        // Partial updates: schedule full billing_months blob upsert in background (debounced ~2s per month key, last write wins)
        this.scheduleBackgroundBillingMonthBlob(monthId, dealerId, payload);
      }

      // 3. Write localStorage billing cache once per save deferred with setTimeout(0)
      const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
      const cacheKey = `gts_cache_v3_${exactKey}`;
      try {
        const rawCache = localStorage.getItem(cacheKey);
        let list: any[] = rawCache ? JSON.parse(rawCache) : (globalTableCaches[exactKey] ? [...globalTableCaches[exactKey]] : []);
        const idx = list.findIndex(m => m.id === monthId || m.month_id === monthId);
        const updatedObj = { id: monthId, month_id: monthId, dealer_id: dealerId, rows, rows_data: { rows, excludedClientKeys: excludedClientKeys || [] }, excludedClientKeys: excludedClientKeys || [], updated_by: updatedBy, updatedAt: Date.now() };
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updatedObj };
        } else {
          list.unshift(updatedObj);
        }
        globalTableCaches[exactKey] = list;

        setTimeout(() => {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(list));
            localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
          } catch (e) {}
        }, 0);
      } catch (e) {}
    } catch (e: any) {
      console.error("Failed to save billing month:", e);
      throw e;
    } finally {
      if (this._syncingMonths) {
        this._syncingMonths.delete(syncKey);
      }
    }
  },

  async deleteBillingMonth(monthId: string, dealerId: string = 'main', authorName: string = 'admin', fullMonthObj?: any, isPermanent: boolean = false) {
    return globalLoading.wrap(async () => {
      try {
        if (!isPermanent && fullMonthObj) {
          await supabaseService.saveToRecycleBin('billing_months', monthId, authorName, dealerId, fullMonthObj);
        }
        await supabase.from('billing_months').delete().eq('month_id', monthId).eq('dealer_id', dealerId);
        await supabase.from('billing_rows').delete().eq('month_id', monthId).eq('dealer_id', dealerId);

        try {
          const lc = activeLineCode || 'nolc';
          const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
          if (globalTableCaches[exactKey]) {
            globalTableCaches[exactKey] = globalTableCaches[exactKey].filter((m: any) => m.id !== monthId && m.month_id !== monthId);
            const subs = globalTableSubscribers[exactKey];
            if (subs) {
              subs.forEach(cb => { try { cb(globalTableCaches[exactKey], true); } catch(e){} });
            }
            try {
              localStorage.setItem(`gts_cache_v3_${exactKey}`, JSON.stringify(globalTableCaches[exactKey]));
              localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
            } catch (e) {}
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
        const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        delete globalTableCaches[exactKey];
        localStorage.removeItem(`gts_cache_v3_${exactKey}`);
        localStorage.removeItem(`gts_cache_meta_${exactKey}`);
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

    const mapRowToDb = (r: any) => {
      const clientId = r.clientId;
      if (!clientId || !String(clientId).trim()) {
        return null;
      }
      return {
        id: `${monthId}_${clientId}`,
        month_id: String(monthId || ''),
        dealer_id: String(dealerId || 'main'),
        client_id: String(clientId),
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
        pkg_details: String(r.pkgDetails || r.pkg_details || ''),
        sag: String(r.sag || ''),
        lai: String(r.lai || ''),
        connection_date: String(r.connectionDate || r.connection_date || ''),
        device_price: sanitizeNum(r.devicePrice ?? r.device_price),
        abl: sanitizeNum(r.abl),
        panel_details: String(r.panelDetails || ''),
        line_code: String(r.lineCode || r.line_code || activeLineCode || ''),
        line_id: r.lineId || r.line_id || activeLineId || null
      };
    };

    const getPaymentScore = (row: any) => {
      const status = String(row.payment_status || '').toLowerCase();
      const rec = Number(row.payment_received || 0);
      let statusScore = 1;
      if (status === 'paid' || rec > 0) statusScore = 4;
      else if (status === 'partial') statusScore = 3;
      else if (status === 'tdc' || status === 'dc') statusScore = 2;
      return {
        statusScore,
        paymentReceived: rec,
        commentsLength: String(row.comments || '').trim().length
      };
    };

    const isBetterScore = (candidate: any, existing: any) => {
      const sCand = getPaymentScore(candidate);
      const sEx = getPaymentScore(existing);
      if (sCand.statusScore !== sEx.statusScore) {
        return sCand.statusScore > sEx.statusScore;
      }
      if (sCand.paymentReceived !== sEx.paymentReceived) {
        return sCand.paymentReceived > sEx.paymentReceived;
      }
      return sCand.commentsLength >= sEx.commentsLength;
    };

    let itemsToSync: { r: any; actualIndex: number }[];
    const hasChangedIndices = changedIndices && (Array.isArray(changedIndices) ? changedIndices.length > 0 : changedIndices.size > 0);
    if (hasChangedIndices) {
      const indicesArray = Array.isArray(changedIndices) ? changedIndices : Array.from(changedIndices);
      itemsToSync = indicesArray.map((idx: number) => ({ r: rows[idx], actualIndex: idx })).filter(item => Boolean(item.r));
    } else {
      itemsToSync = rows.map((r: any, idx: number) => ({ r, actualIndex: idx }));
    }

    const mappedRows = rows.map(r => mapRowToDb(r)).filter(Boolean);
    const allDbRows = mappedRows;

    let dbRowsToUpsert = itemsToSync.map(({ r }) => mapRowToDb(r)).filter(Boolean);

    // If full sync (!hasChangedIndices), fetch existing billing_rows from Supabase to protect paid / higher payment rows
    if (!hasChangedIndices && supabase) {
      try {
        const { data: existingDbRows } = await supabase.from('billing_rows').select('*').eq('month_id', monthId);
        if (existingDbRows && existingDbRows.length > 0) {
          const existingMap = new Map(existingDbRows.map(row => [row.id, row]));
          dbRowsToUpsert = dbRowsToUpsert.map(candidate => {
            const existing = existingMap.get(candidate.id);
            if (existing) {
              if (isBetterScore(existing, candidate)) {
                return {
                  ...candidate,
                  payment_status: existing.payment_status,
                  payment_received: Math.max(existing.payment_received || 0, candidate.payment_received || 0),
                  cr: Math.max(existing.cr || 0, candidate.cr || 0),
                  comments: existing.comments || candidate.comments
                };
              }
            }
            return candidate;
          });
        }
      } catch (fetchErr) {
        console.warn("Error fetching existing billing_rows for protection check:", fetchErr);
      }
    }

    // Deduplicate dbRowsToUpsert by id with payment score comparison and console.warn
    const dedupedMap = new Map<string, any>();
    dbRowsToUpsert.forEach(row => {
      if (dedupedMap.has(row.id)) {
        const existing = dedupedMap.get(row.id);
        if (isBetterScore(row, existing)) {
          console.warn(`[syncBillingRows] Duplicate ID detected: ${row.id}. Dropped duplicate username "${existing.username}" in favor of "${row.username}" (better score).`);
          dedupedMap.set(row.id, row);
        } else {
          console.warn(`[syncBillingRows] Duplicate ID detected: ${row.id}. Dropped duplicate username "${row.username}" in favor of existing "${existing.username}" (better score).`);
        }
      } else {
        dedupedMap.set(row.id, row);
      }
    });

    const finalDbRows = Array.from(dedupedMap.values());

    if (finalDbRows.length > 0) {
      try {
        const { error } = await supabase.from('billing_rows').upsert(finalDbRows, { onConflict: 'id' });
        if (error) {
          if (error.message?.includes('panel_details') || error.message?.includes('column')) {
            let fallbackRows = finalDbRows.map(row => {
              const { panel_details, ...rest } = row as any;
              return rest;
            });
            const { error: retryError } = await supabase.from('billing_rows').upsert(fallbackRows, { onConflict: 'id' });
            if (retryError) {
              console.warn("syncBillingRows retry upsert error:", retryError.message);
              throw retryError;
            }
          } else {
            console.warn("syncBillingRows batch upsert error:", error.message);
            throw error;
          }
        }
      } catch (err) {
        console.warn("syncBillingRows error:", err);
        throw err;
      }
    }

    // Purge deleted rows from billing_rows table if doing a full sync
    if (!hasChangedIndices && supabase) {
      try {
        const activeIds = new Set(allDbRows.map(d => d.id));
        const { data: existingDbRows } = await supabase.from('billing_rows').select('id').eq('month_id', monthId);
        if (existingDbRows && existingDbRows.length > 0) {
          const idsToDelete = existingDbRows.map(r => r.id).filter(id => !activeIds.has(id));
          if (idsToDelete.length > 0) {
            await supabase.from('billing_rows').delete().in('id', idsToDelete);
          }
        }
      } catch (delErr) {
        console.warn("Error purging deleted billing_rows:", delErr);
      }
    }
  },

  // --- USERS ---
  getUsers: async (dealerId?: string, lineCodeFilter?: string | null, lineIdFilter?: string | null): Promise<UserProfile[]> => {
    try {
      let query = supabase.from('users_data').select('*');
      const cleanCode = lineCodeFilter !== undefined 
        ? (lineCodeFilter ? String(lineCodeFilter).trim() : '')
        : String(activeLineCode || '').trim();
      const cleanId = lineIdFilter !== undefined
        ? (lineIdFilter ? String(lineIdFilter).trim() : '')
        : String(activeLineId || '').trim();

      if (cleanId) {
        query = query.eq('line_id', cleanId);
      } else if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else if (lineCodeFilter === 'all' || dealerId === 'all') {
        // 'all' explicitly requests all users across registry
      } else if (lineCodeFilter === '__without_line__' || lineCodeFilter === null) {
        query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
      } else if (dealerId && dealerId !== 'main') {
        query = query.eq('dealer_id', dealerId);
      } else {
        // No line_code for this viewer — restrict to without line_code + dealers
        query = query.or('line_code.is.null,line_code.eq.,role.eq.dealer');
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(r => fromDb('users', r));
    } catch (e) {
      return [];
    }
  },

  getUsersData: async (dealerId?: string, lineCodeFilter?: string | null): Promise<UserProfile[]> => {
    return supabaseService.getUsers(dealerId, lineCodeFilter);
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

  getUserForLogin: async (identifier: string): Promise<UserProfile | null> => {
    try {
      const clean = String(identifier || '').trim();
      if (!clean) return null;

      const { data: uData } = await supabase
        .from('users_data')
        .select('*')
        .or(`username.ilike.${clean},email.ilike.${clean},uid.eq.${clean}`)
        .limit(1)
        .maybeSingle();
      if (uData) return fromDb('users', uData);

      return null;
    } catch (e) {
      return null;
    }
  },

  getNetworkOwnerByLineCode: async (lineCode: string): Promise<UserProfile | null> => {
    try {
      const cleanCode = String(lineCode || '').trim();
      if (!cleanCode) return null;
      
      const { data } = await supabase.from('users_data').select('*').ilike('line_code', cleanCode).limit(1).maybeSingle();
      if (data) return fromDb('users', data);

      const { data: lpData } = await supabase.from('login_profiles').select('*').ilike('line_code', cleanCode).limit(1).maybeSingle();
      if (lpData) return fromDb('users', lpData);

      const { data: uData } = await supabase.from('users').select('*').ilike('line_code', cleanCode).limit(1).maybeSingle();
      if (uData) return fromDb('users', uData);

      return null;
    } catch (e) {
      return null;
    }
  },

  createUser: async (
    uid: string,
    username: string,
    pass: string,
    role: UserProfile['role'],
    authorId?: string,
    authorName?: string,
    dealerId: string = 'main',
    lineCode?: string,
    companyName?: string,
    status: UserProfile['status'] = 'active',
    fullName?: string,
    lineId?: string | null,
    currentUser?: UserProfile
  ): Promise<UserProfile> => {
    let finalLineId: string | null = lineId || null;
    let finalLineCode: string | null = lineCode || null;

    const isSubDealerOrLineAdmin = currentUser && currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && (Boolean(currentUser.lineCode) || Boolean(currentUser.lineId) || currentUser.role === 'dealer');
    if (isSubDealerOrLineAdmin) {
      finalLineId = currentUser.lineId || currentUser.line_id || null;
      finalLineCode = currentUser.lineCode || currentUser.line_code || activeLineCode || null;
    }

    const user: UserProfile = {
      uid,
      username,
      password: pass,
      role,
      fullName: fullName || username,
      createdAt: Date.now(),
      lastActive: Date.now(),
      dealerId,
      lineId: finalLineId,
      lineCode: finalLineCode || '',
      line_id: finalLineId,
      line_code: finalLineCode || '',
      createdBy: authorId || 'admin',
      createdByName: authorName || 'System Admin',
      companyName: companyName || '',
      status
    };
    await upsertSupabase('users', 'uid', uid, toDb('users', user), true);
    return user;
  },


  updateUserFcmToken: async (uid: string, token: string) => {
    try {
      await upsertSupabase('users', 'uid', uid, { fcm_token: token }, true);
    } catch (err) {
      console.warn('Failed to save FCM token to Supabase:', err);
    }
  },
  updateUserStatus: async (uid: string, status: UserProfile['status'], authorName: string) => {
    await upsertSupabase('users', 'uid', uid, { status });
  },

  deleteUser: async (uid: string, username: string, authorName: string, fullUserData?: any) => {
    try {
      // Find and cascade-delete all sub-accounts under this user first (checking both dealer_id and created_by)
      const { data: subAccounts } = await supabase
        .from('users_data')
        .select('*')
        .or(`dealer_id.eq.${uid},created_by.eq.${uid}`);

      if (subAccounts && subAccounts.length > 0) {
        for (const sub of subAccounts) {
          if (sub.uid === uid) continue; // safety guard
          try {
            await supabaseService.createNotification({
              type: 'recycle_bin',
              message: `Deleted Sub-Account: ${sub.username || sub.uid}`,
              authorName: authorName || 'System',
              dealerId: sub.dealer_id || 'main',
              details: {
                originalTable: 'users',
                originalId: sub.uid,
                originalData: fromDb('users', sub),
                deletedAt: Date.now()
              }
            });
            // Recursively cascade-delete any children of this sub-account
            await supabaseService.deleteUser(sub.uid, sub.username || sub.uid, authorName, fromDb('users', sub));
          } catch (subErr) {
            console.warn('Error deleting sub-account:', subErr);
          }
        }
      }

      if (fullUserData) {
        await supabaseService.createNotification({
          type: 'recycle_bin',
          message: `Deleted User: ${username || uid}`,
          authorName: authorName || 'System',
          dealerId: fullUserData.dealerId || 'main',
          details: {
            originalTable: 'users',
            originalId: uid,
            originalData: fullUserData,
            deletedAt: Date.now()
          }
        });
      }
      await supabase.from('users_data').delete().eq('uid', uid);
    } catch (e) {
      console.warn('Error in deleteUser:', e);
    }
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
    const cacheKey = `${tenantId || 'main'}_${activeLineCode || 'nolc'}`;
    const now = Date.now();

    // 1. Reuse active loading promise if currently fetching (Query Deduplication)
    if (globalAppConfigPromises[cacheKey]) {
      return globalAppConfigPromises[cacheKey];
    }

    // 2. Return cached config if it was fetched within the last 2.5 seconds (Throttle/Debounce)
    if (globalAppConfigCache[cacheKey] && (now - globalAppConfigCache[cacheKey].timestamp < 2500)) {
      return globalAppConfigCache[cacheKey].config;
    }

    const fetchPromise = (async () => {
      const specificDocId = activeLineCode ? `app_config_${activeLineCode}` : null;
      let baseConfig: any = {};
      try {
        let row = specificDocId ? await fetchBrandingConfigType(specificDocId) : null;
        if (!row && tenantId && tenantId !== 'main') {
          row = await fetchBrandingConfigType(`app_config_${tenantId}`);
        }
        if (!row) {
          row = await fetchBrandingConfigType('app_main_config');
        }
        if (row && row.dashboard_subtext) {
          try { baseConfig = JSON.parse(row.dashboard_subtext); } catch (e) {}
        }
      } catch (e) {}

      const [dbCategories, dbStatuses, dbPriorities, dbZones] = await Promise.all([
        supabaseService.getCategories(tenantId),
        supabaseService.getStatuses(tenantId),
        supabaseService.getPriorities(tenantId),
        supabaseService.getZones(tenantId),
      ]);

      const isMain = !tenantId || tenantId === 'main';

      const merged = {
        ...baseConfig,
        categories: dbCategories.length > 0 ? dbCategories : (isMain ? DEFAULT_CATEGORIES : []),
        statuses: ensurePermanentStatuses(dbStatuses.length > 0 ? dbStatuses : (isMain ? DEFAULT_STATUSES : [])),
        priorities: dbPriorities.length > 0 ? dbPriorities : (isMain ? DEFAULT_PRIORITIES : []),
        zones: dbZones.length > 0 ? dbZones : (isMain ? DEFAULT_ZONES : []),
        billingSecurityKey: baseConfig.billingSecurityKey || '1239870'
      };

      globalAppConfigCache[cacheKey] = {
        config: merged,
        timestamp: Date.now()
      };

      return merged;
    })();

    globalAppConfigPromises[cacheKey] = fetchPromise;

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      delete globalAppConfigPromises[cacheKey];
    }
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
      lineCode: cleanData.lineCode || activeLineCode || '',
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
      if (activeLineCode) {
        query = query.eq('line_code', activeLineCode);
      } else if (dealerId && dealerId !== 'main') {
        query = query.eq('dealer_id', dealerId);
      } else {
        query = query.neq('id', '');
      }
      await query;

      // Immediately update this client's own local cache and notify subscribers
      try {
        const syncKey = `notifications_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        const targetKeys = new Set<string>([syncKey]);
        Object.keys(globalTableSubscribers).forEach((k) => {
          if (k.startsWith('notifications_')) targetKeys.add(k);
        });
        targetKeys.forEach((k) => {
          globalTableCaches[k] = [];
          try {
            localStorage.setItem(`gts_cache_v3_${k}`, JSON.stringify([]));
          } catch (e) {}
          const subscribers = globalTableSubscribers[k];
          if (subscribers) {
            subscribers.forEach((cb) => {
              try { cb([]); } catch (err) {}
            });
          }
        });
      } catch (cacheErr) {
        console.warn("Local cache clear error:", cacheErr);
      }

      // Broadcast the clear event to the global channel to update all active clients in real-time
      const globalChannel = supabase.channel('gts_notifications_global_broadcast');
      globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.send({
            type: 'broadcast',
            event: 'clear_all',
            payload: { dealerId, lineCode: activeLineCode }
          });
          supabase.removeChannel(globalChannel);
        }
      });
    } catch (e) {
      console.warn("Failed to clear notifications:", e);
    }
  },

  deleteNotification: async (id: string, dealerId?: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);

      // Immediately update this client's own local cache and notify subscribers
      try {
        const syncKey = `notifications_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        const targetKeys = new Set<string>([syncKey]);
        Object.keys(globalTableSubscribers).forEach((k) => {
          if (k.startsWith('notifications_')) targetKeys.add(k);
        });
        targetKeys.forEach((k) => {
          let cache = globalTableCaches[k] || [];
          const originalLength = cache.length;
          cache = cache.filter((item: any) => item.id !== id);
          if (cache.length !== originalLength) {
            globalTableCaches[k] = cache;
            try {
              localStorage.setItem(`gts_cache_v3_${k}`, JSON.stringify(cache));
            } catch (e) {}
            const subscribers = globalTableSubscribers[k];
            if (subscribers) {
              subscribers.forEach((cb) => {
                try { cb(cache); } catch (err) {}
              });
            }
          }
        });
      } catch (cacheErr) {
        console.warn("Local cache delete error:", cacheErr);
      }

      // Broadcast the delete event to the global channel to update all active clients in real-time
      const globalChannel = supabase.channel('gts_notifications_global_broadcast');
      globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.send({
            type: 'broadcast',
            event: 'delete_notification',
            payload: { id }
          });
          supabase.removeChannel(globalChannel);
        }
      });
    } catch (e) {
      console.warn("Failed to delete notification:", e);
    }
  },

  markAllNotificationsRead: async (dealerId?: string) => {
    try {
      let query = supabase.from('notifications').update({ is_read: true });
      if (activeLineCode) {
        query = query.eq('line_code', activeLineCode);
      } else if (dealerId && dealerId !== 'main') {
        query = query.eq('dealer_id', dealerId);
      } else {
        query = query.neq('id', '');
      }
      await query;

      // Immediately update this client's own local cache and notify subscribers
      try {
        const syncKey = `notifications_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        const targetKeys = new Set<string>([syncKey]);
        Object.keys(globalTableSubscribers).forEach((k) => {
          if (k.startsWith('notifications_')) targetKeys.add(k);
        });
        targetKeys.forEach((k) => {
          let cache = globalTableCaches[k] || [];
          cache = cache.map((item: any) => ({ ...item, isRead: true }));
          globalTableCaches[k] = cache;
          try {
            localStorage.setItem(`gts_cache_v3_${k}`, JSON.stringify(cache));
          } catch (e) {}
          const subscribers = globalTableSubscribers[k];
          if (subscribers) {
            subscribers.forEach((cb) => {
              try { cb(cache); } catch (err) {}
            });
          }
        });
      } catch (cacheErr) {
        console.warn("Local cache mark all read error:", cacheErr);
      }

      // Broadcast mark_all_read event to other clients
      const globalChannel = supabase.channel('gts_notifications_global_broadcast');
      globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.send({
            type: 'broadcast',
            event: 'mark_all_read',
            payload: { dealerId, lineCode: activeLineCode }
          });
          supabase.removeChannel(globalChannel);
        }
      });
    } catch (e) {
      console.warn("Failed to mark all notifications read:", e);
    }
  },

  markNotificationRead: async (id: string, dealerId?: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);

      // Immediately update this client's own local cache and notify subscribers
      try {
        const syncKey = `notifications_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
        const targetKeys = new Set<string>([syncKey]);
        Object.keys(globalTableSubscribers).forEach((k) => {
          if (k.startsWith('notifications_')) targetKeys.add(k);
        });
        targetKeys.forEach((k) => {
          let cache = globalTableCaches[k] || [];
          let updated = false;
          cache = cache.map((item: any) => {
            if (item.id === id) {
              updated = true;
              return { ...item, isRead: true };
            }
            return item;
          });
          if (updated) {
            globalTableCaches[k] = cache;
            try {
              localStorage.setItem(`gts_cache_v3_${k}`, JSON.stringify(cache));
            } catch (e) {}
            const subscribers = globalTableSubscribers[k];
            if (subscribers) {
              subscribers.forEach((cb) => {
                try { cb(cache); } catch (err) {}
              });
            }
          }
        });
      } catch (cacheErr) {
        console.warn("Local cache mark read error:", cacheErr);
      }

      // Broadcast mark_read event to other clients
      const globalChannel = supabase.channel('gts_notifications_global_broadcast');
      globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.send({
            type: 'broadcast',
            event: 'mark_read',
            payload: { id }
          });
          supabase.removeChannel(globalChannel);
        }
      });
    } catch (e) {
      console.warn("Failed to mark notification read:", e);
    }
  },

  subscribeNotifications: (callback: (notifications: AppNotification[]) => void, dealerId?: string) => {
    return subscribeTable('notifications', callback, r => fromDb('notifications', r), dealerId);
  },

  getComplaints: async (dealerId?: string): Promise<Complaint[]> => {
    try {
      let query = supabase.from('complaints').select('*');
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else {
        // No line_code for this viewer — restrict to the shared "without
        // line_code" room only; never show a dealer's properly line_code-
        // scoped data just because dealerId wasn't provided.
        query = query.or('line_code.is.null,line_code.eq.');
        if (dealerId && dealerId !== 'all' && dealerId !== 'main') {
          query = query.eq('dealer_id', dealerId);
        }
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
        lineCode: activeLineCode || '',
        scheduledAt: data.scheduledAt
      };
      await upsertSupabase('complaints', 'id', complaint.id, toDb('complaints', complaint));
      
      // WhatsApp notification (fire-and-forget)
      if (complaint.number) {
        (async () => {
          try {
            if (!guardComplaintEvent(complaint.id, 'registered')) {
              return;
            }
            const statusRes = await getStatus();
            if (statusRes.connected) {
              const templates = await getTemplate();
              const tmpl = templates.complaintRegisteredTemplate;
              if (tmpl) {
                const msg = tmpl
                  .replace(/\{\{name\}\}/gi, complaint.customerName || '')
                  .replace(/\{\{complaintId\}\}/gi, complaint.id)
                  .replace(/\{\{category\}\}/gi, complaint.category || '')
                  .replace(/\{\{area\}\}/gi, complaint.area || '')
                  .replace(/\{\{description\}\}/gi, complaint.description || '');
                await sendMessage(complaint.number, msg, undefined, {
                  kind: 'complaint',
                  event: 'registered',
                  refId: complaint.id,
                  clientName: complaint.customerName,
                  clientUsername: complaint.customerUsername
                });
              }
            }
          } catch (err: any) {
            console.warn('Failed to send WhatsApp registered notification', err);
            toast.error(`Complaint saved, but the WhatsApp message was not sent: ${err.message || String(err)}`);
          }
        })();
      }
      

      // Push Notification
      try {
        const relevantUsers = await supabaseService.getUsers(tenantId);
        const tokens = relevantUsers.filter((u: any) => u.fcmToken).map((u: any) => u.fcmToken) as string[];
        if (tokens.length > 0) {
          await sendPushNotification(
            tokens, 
            'New Complaint', 
            `${complaint.customerName} (${complaint.area})`
          );
        }
      } catch (err) {
        console.warn('Could not send push notification:', err);
      }
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

  deleteComplaint: async (id: string, customerName: string, authorName: string, fullComplaintData?: Complaint, isPermanent: boolean = false) => {
    return globalLoading.wrap(async () => {
      try {
        let dealerId = fullComplaintData?.dealerId || 'main';
        if (!fullComplaintData) {
          try {
            const { data: comp } = await supabase.from('complaints').select('dealer_id').eq('id', id).single();
            if (comp && comp.dealer_id) dealerId = comp.dealer_id;
          } catch (e) {}
        }
        if (!isPermanent && fullComplaintData) {
          await supabaseService.saveToRecycleBin('complaints', id, authorName, fullComplaintData.dealerId || 'main', fullComplaintData);
        }
        await supabase.from('complaints').delete().eq('id', id);

        // Broadcast complaint deletion event for real-time list sync
        try {
          const channel = supabase.channel('gts-realtime-channel');
          channel.send({
            type: 'broadcast',
            event: 'complaint_deleted',
            payload: {
              complaintId: id,
              authorName: authorName || 'System',
              dealerId: dealerId
            }
          }).catch(err => console.warn("Broadcast failed:", err));
        } catch (err) {
          console.warn("Could not broadcast complaint deletion:", err);
        }
      } catch (e) {
        console.error("Error in deleteComplaint:", e);
      }
    }, 'Deleting complaint...');
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, protocols?: ComplaintReview[] | string, reviews?: ComplaintReview[]) => {
    return globalLoading.wrap(async () => {
      // Get dealer_id for scoped notification and number for WhatsApp
      let dealerId = 'main';
      let compNumber = '';
      try {
        const { data: comp } = await supabase.from('complaints').select('dealer_id, number').eq('id', id).single();
        if (comp && comp.dealer_id) dealerId = comp.dealer_id;
        if (comp && comp.number) compNumber = comp.number;
      } catch (e) {}

      const updates: any = { status, updated_at: Date.now() };
      if (protocols) {
        updates.remarks = typeof protocols === 'string' ? protocols : JSON.stringify(protocols);
        updates.remark_author_id = authorId;
        updates.remark_author_name = authorName;
      }
      if (reviews) {
        updates.customer_review = JSON.stringify(reviews);
      }
      await upsertSupabase('complaints', 'id', id, updates);

      // Trigger notification
      try {
        await supabaseService.createNotification({
          type: 'complaint_updated',
          message: `Status changed to ${status} for ${customerName}`,
          authorName: authorName || 'System',
          dealerId: dealerId,
          details: { complaintId: id, customerName, status, updated_at: Date.now() }
        });
      } catch(err) { console.warn("Failed to create notification", err); }

      // Broadcast complaint updated event for real-time list sync & alerts
      try {
        const { data: updatedRow } = await supabase.from('complaints').select('*').eq('id', id).single();
        if (updatedRow) {
          const fullUpdatedComplaint = fromDb('complaints', updatedRow);
          const channel = supabase.channel('gts-realtime-channel');
          channel.send({
            type: 'broadcast',
            event: 'complaint_updated',
            payload: {
              complaint: fullUpdatedComplaint,
              authorName: authorName || 'System',
              dealerId: fullUpdatedComplaint.dealerId || dealerId || 'main'
            }
          }).catch(err => console.warn("Broadcast failed:", err));
        }
      } catch (err) {
        console.warn("Could not broadcast complaint status update:", err);
      }
      
      // WhatsApp notification (fire-and-forget)
      (async () => {
        try {
          const templates = await getTemplate();
          const configuredCompletedVal = templates?.completedStatusValue || '';

          const normalizeStr = (s: string) => (s || '').toLowerCase().trim().replace(/[\s_\-]+/g, '');
          const normStatus = normalizeStr(status);
          const normConfigured = normalizeStr(configuredCompletedVal);

          let isMatch = false;
          if (normConfigured) {
            isMatch = normStatus === normConfigured;
          } else {
            const defaultCompleted = ['complete', 'completed', 'resolved', 'done', 'closed'].map(normalizeStr);
            isMatch = defaultCompleted.includes(normStatus);
          }

          if (!isMatch) {
            console.warn(
              `WhatsApp completed-message skipped: status mismatch (current status: "${status}", configured completed value: "${configuredCompletedVal || '[empty - defaults: complete, completed, resolved, done, closed]'}")`
            );
            toast.info(
              `WhatsApp completed message skipped: current status is "${status}", but Settings configured completed value is "${configuredCompletedVal || 'complete'}".`,
              { id: `status-mismatch-${id}` }
            );
            return;
          }

          if (!guardComplaintEvent(id, 'completed')) {
            return;
          }

          // Status matches - check customer phone number
          let phone = (compNumber || '').trim();
          let category = '';
          let custUsername = '';
          try {
            const { data: cRow } = await supabase.from('complaints').select('number, category, customer_username').eq('id', id).single();
            if (cRow?.number && !phone) phone = cRow.number.trim();
            if (cRow?.category) category = cRow.category.trim();
            if (cRow?.customer_username) custUsername = cRow.customer_username.trim();
          } catch (_) {}

          if (!phone) {
            console.warn(`WhatsApp completed-message skipped: no customer phone number available for complaint "${id}"`);
            return;
          }

          // Require WhatsApp connection
          const statusRes = await getStatus();
          if (!statusRes?.connected) {
            console.warn('WhatsApp completed-message skipped: WhatsApp is not connected');
            toast.error("Complaint saved, but the WhatsApp message was not sent: WhatsApp is not connected");
            return;
          }

          const rawTmpl = templates?.complaintCompletedTemplate;
          if (!rawTmpl) {
            console.warn('WhatsApp completed-message skipped: complaintCompletedTemplate is empty');
            return;
          }

          let msg = rawTmpl
            .replace(/\{\{name\}\}/gi, customerName || '')
            .replace(/\{\{complaintId\}\}/gi, id);

          if (category) {
            msg = msg.replace(/\{\{category\}\}/gi, category);
          } else {
            msg = msg.replace(/\{\{category\}\}/gi, '');
          }

          await sendMessage(phone, msg, undefined, {
            kind: 'complaint',
            event: 'completed',
            refId: id,
            clientName: customerName,
            clientUsername: custUsername || undefined
          });
        } catch (err: any) {
          console.warn('Failed to send WhatsApp completed notification:', err);
          toast.error(`Complaint saved, but the WhatsApp message was not sent: ${err.message || String(err)}`);
        }
      })();

      // Push Notification for status update
      try {
        const templates = await getTemplate();
        if (templates && templates.completedStatusValue && status.toLowerCase() === templates.completedStatusValue.toLowerCase()) {
            const relevantUsers = await supabaseService.getUsers(dealerId);
            const tokens = relevantUsers.filter((u: any) => u.fcmToken).map((u: any) => u.fcmToken) as string[];
            if (tokens.length > 0) {
              await sendPushNotification(
                tokens, 
                'Complaint Completed', 
                `${customerName}'s complaint is now ${status}`
              );
            }
        }
      } catch (err) {
        console.warn('Could not send push notification for status update:', err);
      }
    }, 'Updating complaint status...');
  },

  updateComplaintRemarks: async (id: string, protocols: string | ComplaintReview[], customerName: string, authorName: string, authorId: string) => {
    let dealerId = 'main';
    try {
      const { data: comp } = await supabase.from('complaints').select('dealer_id').eq('id', id).single();
      if (comp && comp.dealer_id) dealerId = comp.dealer_id;
    } catch (e) {}

    await upsertSupabase('complaints', 'id', id, {
      remarks: typeof protocols === 'string' ? protocols : JSON.stringify(protocols),
      remark_author_id: authorId,
      remark_author_name: authorName,
      updated_at: Date.now()
    });

    try {
      await supabaseService.createNotification({
        type: 'complaint_updated',
        message: `Remarks updated for ${customerName}`,
        authorName: authorName || 'System',
        dealerId: dealerId,
        details: { complaintId: id, customerName, updated_at: Date.now() }
      });
    } catch(err) { console.warn("Failed to create notification", err); }

    // Broadcast complaint updated event for real-time list sync & alerts
    try {
      const { data: updatedRow } = await supabase.from('complaints').select('*').eq('id', id).single();
      if (updatedRow) {
        const fullUpdatedComplaint = fromDb('complaints', updatedRow);
        const channel = supabase.channel('gts-realtime-channel');
        channel.send({
          type: 'broadcast',
          event: 'complaint_updated',
          payload: {
            complaint: fullUpdatedComplaint,
            authorName: authorName || 'System',
            dealerId: fullUpdatedComplaint.dealerId || dealerId || 'main'
          }
        }).catch(err => console.warn("Broadcast failed:", err));
      }
    } catch (err) {
      console.warn("Could not broadcast complaint remarks update:", err);
    }
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, customerName: string, authorName: string) => {
    let dealerId = 'main';
    try {
      const { data: comp } = await supabase.from('complaints').select('dealer_id').eq('id', id).single();
      if (comp && comp.dealer_id) dealerId = comp.dealer_id;
    } catch (e) {}

    await upsertSupabase('complaints', 'id', id, toDb('complaints', { ...data, updatedAt: Date.now() }));

    const changedFields = Object.keys(data).join(', ');
    try {
      await supabaseService.createNotification({
        type: 'complaint_updated',
        message: `Complaint details updated for ${customerName} (${changedFields})`,
        authorName: authorName || 'System',
        dealerId: dealerId,
        details: { complaintId: id, customerName, changedFields, updated_at: Date.now() }
      });
    } catch(err) { console.warn("Failed to create notification", err); }

    // Broadcast complaint updated event for real-time list sync & alerts
    try {
      const { data: updatedRow } = await supabase.from('complaints').select('*').eq('id', id).single();
      if (updatedRow) {
        const fullUpdatedComplaint = fromDb('complaints', updatedRow);
        const channel = supabase.channel('gts-realtime-channel');
        channel.send({
          type: 'broadcast',
          event: 'complaint_updated',
          payload: {
            complaint: fullUpdatedComplaint,
            authorName: authorName || 'System',
            dealerId: fullUpdatedComplaint.dealerId || dealerId || 'main'
          }
        }).catch(err => console.warn("Broadcast failed:", err));
      }
    } catch (err) {
      console.warn("Could not broadcast complaint update:", err);
    }
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

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  },

  updateConfig: async (config: any, authorName: string, tenantId: string = 'main') => {
    const docId = activeLineCode ? `app_config_${activeLineCode}` : (tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`);
    delete globalAppConfigCache[`${tenantId || 'main'}_${activeLineCode || 'nolc'}`];
    if (activeLineCode) {
      delete globalAppConfigCache[`${activeLineCode}_${activeLineCode}`];
      delete globalBrandingConfigCache[`app_config_${activeLineCode}`];
    }
    delete globalAppConfigCache[tenantId || 'main'];
    delete globalAppConfigCache['main'];
    delete globalBrandingConfigCache[docId];

    const payload = {
      config_type: docId,
      dashboard_subtext: typeof config === 'string' ? config : JSON.stringify(config),
      tenant_id: tenantId,
      line_code: activeLineCode || ''
    };
    await upsertSupabase('branding_config', 'config_type', docId, payload);
    if (activeLineCode && tenantId && tenantId !== 'main' && docId !== `app_config_${tenantId}`) {
      try {
        await upsertSupabase('branding_config', 'config_type', `app_config_${tenantId}`, {
          ...payload,
          config_type: `app_config_${tenantId}`
        });
        delete globalBrandingConfigCache[`app_config_${tenantId}`];
      } catch (e) {}
    }
    await supabaseService.syncAppConfig(config, tenantId);

    delete globalAppConfigCache[`${tenantId || 'main'}_${activeLineCode || 'nolc'}`];
    delete globalAppConfigCache[tenantId || 'main'];
    delete globalAppConfigCache['main'];
    delete globalBrandingConfigCache[docId];
  },

  subscribeBranding: (callback: (branding: BrandingConfig | null) => void, lineCode?: string) => {
    const fetchB = async () => {
      try {
        const specificType = lineCode ? `branding_${lineCode}` : null;
        let row = specificType ? await fetchBrandingConfigType(specificType) : null;
        if (!row) {
          row = await fetchBrandingConfigType('branding');
        }
        if (row) callback(fromDb('branding_config', row));
      } catch (e) {}
    };
    fetchB();
    const channelName = `branding_rt_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => fetchB())
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
    };
  },

  updateBranding: async (branding: BrandingConfig, authorName: string, lineCode?: string) => {
    const configType = lineCode ? `branding_${lineCode}` : 'branding';
    delete globalBrandingConfigCache[configType];
    delete globalBrandingConfigCache['branding'];
    await upsertSupabase('branding_config', 'config_type', configType, toDb('branding_config', { ...branding, config_type: configType }));
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

  getGroups: async (dealerId?: string): Promise<ChatGroup[]> => {
    try {
      let query = supabase.from('chat_groups').select('*');
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else {
        // No line_code for this viewer — restrict to the shared "without
        // line_code" room only; never show a dealer's properly line_code-
        // scoped data just because dealerId wasn't provided.
        query = query.or('line_code.is.null,line_code.eq.');
        if (dealerId && dealerId !== 'all' && dealerId !== 'main') {
          query = query.eq('dealer_id', dealerId);
        }
      }
      const { data } = await query;
      if (!data) return [];
      return data.map(r => fromDb('chat_groups', r));
    } catch (e) {
      return [];
    }
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void, dealerId?: string) => {
    return subscribeTable('chat_messages', (items) => callback(items.sort((a, b) => a.createdAt - b.createdAt)), r => fromDb('chat_messages', r), dealerId);
  },

  // --- CLIENTS ---
  getClients: async (dealerId?: string, lineCodeFilter?: string | null, lineIdFilter?: string | null): Promise<Client[]> => {
    try {
      let query = supabase.from('clients').select('*');
      const cleanCode = lineCodeFilter !== undefined
        ? (lineCodeFilter ? String(lineCodeFilter).trim() : '')
        : String(activeLineCode || '').trim();
      const cleanId = lineIdFilter !== undefined
        ? (lineIdFilter ? String(lineIdFilter).trim() : '')
        : String(activeLineId || '').trim();

      if (cleanId) {
        query = query.eq('line_id', cleanId);
      } else if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else if (lineCodeFilter === 'all' || dealerId === 'all') {
        // all clients across registry
      } else if (lineCodeFilter === '__without_line__' || lineCodeFilter === null) {
        query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
      } else {
        // No line_code for this viewer — restrict to the shared "without line_code" room only
        query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
        if (dealerId && dealerId !== 'main') {
          query = query.eq('dealer_id', dealerId);
        }
      }
      const { data } = await query;
      if (!data) return [];
      return data.map(r => fromDb('clients', r));
    } catch (e) {
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main', currentUser?: UserProfile): Promise<Client> => {
    const isLineAdmin = currentUser && currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && (Boolean(currentUser.lineCode) || Boolean(currentUser.lineId) || currentUser.role === 'dealer');
    
    let finalLineId: string | null = null;
    let finalLineCode: string | null = null;
    
    if (isLineAdmin) {
      finalLineId = currentUser.lineId || currentUser.line_id || null;
      finalLineCode = currentUser.lineCode || currentUser.line_code || activeLineCode || null;
    } else {
      finalLineId = data.lineId ?? data.line_id ?? activeLineId ?? null;
      finalLineCode = data.lineCode ?? data.line_code ?? activeLineCode ?? null;
      if (finalLineCode === '__without_line__') {
        finalLineCode = null;
        finalLineId = null;
      }
    }

    const client: Client = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      lineId: finalLineId,
      lineCode: finalLineCode,
      line_id: finalLineId,
      line_code: finalLineCode,
      createdAt: Date.now(),
      dealerId: data.dealerId || dealerId
    };
    await upsertSupabase('clients', 'id', client.id, toDb('clients', client), true);
    return client;
  },

  addClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main', currentUser?: UserProfile): Promise<Client> => {
    return supabaseService.createClient(data, authorName, dealerId, currentUser);
  },

  updateClient: async (id: string, data: Partial<Client>, clientName: string, authorName: string, currentUser?: UserProfile) => {
    const payload = { ...data };
    const isLineAdmin = currentUser && currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && (Boolean(currentUser.lineCode) || Boolean(currentUser.lineId) || currentUser.role === 'dealer');
    
    if (isLineAdmin) {
      payload.lineId = currentUser.lineId || currentUser.line_id || null;
      payload.lineCode = currentUser.lineCode || currentUser.line_code || activeLineCode || null;
      payload.line_id = payload.lineId;
      payload.line_code = payload.lineCode;
    } else if (payload.lineCode === '__without_line__') {
      payload.lineCode = null;
      payload.lineId = null;
      payload.line_code = null;
      payload.line_id = null;
    }
    await upsertSupabase('clients', 'id', id, toDb('clients', payload), true);
  },

  updateClientFee: async (clientId: string, newFee: number): Promise<void> => {
    return updateClientFee(clientId, newFee);
  },

  propagateClientToBilling: async (clientId: string, fields: { username?: string, name?: string, mobileNumber?: string, area?: string, pkgDetails?: string, rt?: string, panelDetails?: string, billingDay?: string }) => {
    try {
      const updatePayload: any = {};
      if (fields.username !== undefined) updatePayload.username = fields.username;
      if (fields.name !== undefined) updatePayload.name = fields.name;
      if (fields.mobileNumber !== undefined) {
        updatePayload.mobile_number = fields.mobileNumber;
        updatePayload.phone = fields.mobileNumber;
      }
      if (fields.area !== undefined) updatePayload.area = fields.area;
      if (fields.pkgDetails !== undefined) updatePayload.pkg_details = fields.pkgDetails;
      if (fields.rt !== undefined) updatePayload.rt = fields.rt;
      if (fields.panelDetails !== undefined) updatePayload.panel_details = fields.panelDetails;
      if (fields.billingDay !== undefined) updatePayload.billing_day = fields.billingDay;

      const { error } = await supabase
        .from('billing_rows')
        .update(updatePayload)
        .eq('client_id', clientId);

      if (error) {
        toast.error("Failed to update billing records for client");
        console.error("propagateClientToBilling billing_rows error:", error);
      }

      const monthsList = await supabaseService.getBillingMonthsList('all', true);
      const sortedMonths = [...(monthsList || [])].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 12);

      for (const m of sortedMonths) {
        if (!m || !m.id) continue;
        try {
          const monthDoc = await supabaseService.getBillingMonthDirect(m.id, m.dealerId || 'main');
          if (monthDoc && Array.isArray(monthDoc.rows)) {
            let changed = false;
            const newRows = monthDoc.rows.map((row: any) => {
              if (row && String(row.clientId) === String(clientId)) {
                changed = true;
                return {
                  ...row,
                  ...(fields.username !== undefined ? { username: fields.username } : {}),
                  ...(fields.name !== undefined ? { name: fields.name } : {}),
                  ...(fields.mobileNumber !== undefined ? { mobileNumber: fields.mobileNumber, phone: fields.mobileNumber } : {}),
                  ...(fields.area !== undefined ? { area: fields.area } : {}),
                  ...(fields.pkgDetails !== undefined ? { pkgDetails: fields.pkgDetails } : {}),
                  ...(fields.rt !== undefined ? { rt: fields.rt } : {}),
                  ...(fields.panelDetails !== undefined ? { panelDetails: fields.panelDetails } : {}),
                  ...(fields.billingDay !== undefined ? { billingDay: fields.billingDay } : {})
                };
              }
              return row;
            });
            if (changed) {
              await supabaseService.saveBillingMonth(m.id, newRows, 'system_sync', m.dealerId || 'main', true);
            }
          }
        } catch (monthErr) {
          console.warn(`Failed to propagate client to billing month ${m.id}:`, monthErr);
        }
      }
    } catch (err) {
      console.error("propagateClientToBilling error:", err);
      toast.error("Failed to propagate client updates to billing records.");
    }
  },

  saveClientsBatch: async (clientsList: Client[], dealerId: string = 'main') => {
    if (!clientsList || clientsList.length === 0) return;
    try {
      const primaryKey = `clients_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
      const lc = activeLineCode || 'nolc';
      const syncKeys = [primaryKey, `clients_all_${lc}`, `clients_main_${lc}`, `clients__${lc}`];
      
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

  deleteClient: async (id: string, clientName: string, authorName: string, fullClientData?: Client, isPermanent: boolean = false) => {
    try {
      if (!isPermanent && fullClientData) {
        await supabaseService.saveToRecycleBin('clients', id, authorName, fullClientData.dealerId || 'main', fullClientData);
      }
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
      lineCode: activeLineCode || '',
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
    try {
      const [
        usersData,
        complaintsData,
        clientsData,
        billingMonthsData,
        billingRowsData,
        ledgerFoldersData,
        ledgerSheetsData,
        brandingConfigData,
        chatMessagesData,
        chatGroupsData,
        notificationsData,
        recycleBinData,
        monitorTargetsData,
        googleSheetLinksData,
        categoriesConfigData,
        statusesConfigData,
        priorityConfigData,
        zoneConfigData
      ] = await Promise.all([
        supabase.from('users_data').select('*').then(res => res.data || []),
        supabase.from('complaints').select('*').then(res => res.data || []),
        supabase.from('clients').select('*').then(res => res.data || []),
        supabase.from('billing_months').select('*').then(res => res.data || []),
        supabase.from('billing_rows').select('*').then(res => res.data || []),
        supabase.from('ledger_folders').select('*').then(res => res.data || []),
        supabase.from('ledger_sheets').select('*').then(res => res.data || []),
        supabase.from('branding_config').select('*').then(res => res.data || []),
        supabase.from('chat_messages').select('*').then(res => res.data || []),
        supabase.from('chat_groups').select('*').then(res => res.data || []),
        supabase.from('notifications').select('*').then(res => res.data || []),
        supabase.from('recycle_bin').select('*').then(res => res.data || []),
        supabase.from('monitor_targets').select('*').then(res => res.data || []),
        supabase.from('google_sheet_links').select('*').then(res => res.data || []),
        supabase.from('categories_config').select('*').then(res => res.data || []),
        supabase.from('statuses_config').select('*').then(res => res.data || []),
        supabase.from('priority_config').select('*').then(res => res.data || []),
        supabase.from('zone_config').select('*').then(res => res.data || [])
      ]);

      const parsedUsers = (usersData || []).map((r: any) => fromDb('users', r));
      const parsedComplaints = (complaintsData || []).map((r: any) => fromDb('complaints', r));
      const parsedClients = (clientsData || []).map((r: any) => fromDb('clients', r));

      const dataObj = {
        users: parsedUsers,
        rawUsers: usersData,
        complaints: parsedComplaints,
        rawComplaints: complaintsData,
        clients: parsedClients,
        rawClients: clientsData,
        billingMonths: billingMonthsData,
        billingRows: billingRowsData,
        ledgerFolders: ledgerFoldersData,
        ledgerSheets: ledgerSheetsData,
        brandingConfig: brandingConfigData,
        chatMessages: chatMessagesData,
        chatGroups: chatGroupsData,
        notifications: notificationsData,
        recycleBin: recycleBinData,
        monitorTargets: monitorTargetsData,
        googleSheetLinks: googleSheetLinksData,
        categoriesConfig: categoriesConfigData,
        statusesConfig: statusesConfigData,
        priorityConfig: priorityConfigData,
        zoneConfig: zoneConfigData
      };

      return {
        version: '2.0-full',
        exportedBy,
        exportedAt: Date.now(),
        data: dataObj,
        ...dataObj
      };
    } catch (e: any) {
      console.error("getFullSystemBackup error:", e);
      throw e;
    }
  },

  restoreFullSystemBackup: async (backupPkg: any, authorName: string): Promise<void> => {
    if (!backupPkg) return;
    const pkgData = backupPkg.data || backupPkg;

    // 1. Users
    const users = pkgData.users || pkgData.rawUsers || pkgData.users_data;
    if (users && Array.isArray(users)) {
      for (const u of users) {
        if (u.uid || u.id) {
          const dbRow = u.role !== undefined ? toDb('users', u) : u;
          await upsertSupabase('users_data', 'uid', u.uid || u.id, dbRow);
        }
      }
    }

    // 2. Complaints
    const complaints = pkgData.complaints || pkgData.rawComplaints;
    if (complaints && Array.isArray(complaints)) {
      for (const c of complaints) {
        if (c.id) {
          const dbRow = c.createdAt !== undefined ? toDb('complaints', c) : c;
          await upsertSupabase('complaints', 'id', c.id, dbRow);
        }
      }
    }

    // 3. Clients
    const clients = pkgData.clients || pkgData.rawClients;
    if (clients && Array.isArray(clients)) {
      for (const cl of clients) {
        if (cl.id) {
          const dbRow = cl.clientName !== undefined || cl.name !== undefined ? toDb('clients', cl) : cl;
          await upsertSupabase('clients', 'id', cl.id, dbRow);
        }
      }
    }

    // 4. Billing Months
    const billingMonths = pkgData.billingMonths || pkgData.billing_months;
    if (billingMonths && Array.isArray(billingMonths)) {
      for (const bm of billingMonths) {
        const monthId = bm.month_id || bm.id;
        if (!monthId) continue;
        const dealerId = bm.dealer_id || bm.dealerId || 'main';
        const rowsVal = bm.rows_data ?? bm.rows;
        let rowsObj = typeof rowsVal === 'string' ? (()=>{try{return JSON.parse(rowsVal)}catch(e){return []}})() : rowsVal;
        const excludedKeys = bm.excludedClientKeys || bm.excluded_client_keys || [];
        if (Array.isArray(rowsObj)) {
          rowsObj = { rows: rowsObj, excludedClientKeys: excludedKeys };
        } else if (rowsObj && typeof rowsObj === 'object' && !Array.isArray(rowsObj)) {
           // already an object, maybe update excluded keys if present in bm
           if (excludedKeys.length > 0) {
              rowsObj.excludedClientKeys = excludedKeys;
           }
        }
        const rowsStr = JSON.stringify(rowsObj || { rows: [], excludedClientKeys: [] });
        await supabase.from('billing_months').upsert([{
          month_id: monthId,
          dealer_id: dealerId,
          rows_data: rowsStr,
          updated: bm.updated || new Date().toISOString(),
          created: bm.created || new Date().toISOString()
        }], { onConflict: 'month_id,dealer_id' });
      }
    }

    // 5. Billing Rows
    const billingRows = pkgData.billingRows || pkgData.billing_rows;
    if (billingRows && Array.isArray(billingRows)) {
      for (const br of billingRows) {
        if (br.id) {
          const dbRow = br.month_id ? br : toDb('billing_rows', br);
          await supabase.from('billing_rows').upsert([dbRow], { onConflict: 'id' });
        }
      }
    }

    // 6. Ledger Folders
    const ledgerFolders = pkgData.ledgerFolders || pkgData.ledger_folders;
    if (ledgerFolders && Array.isArray(ledgerFolders)) {
      for (const lf of ledgerFolders) {
        if (lf.id) {
          await supabase.from('ledger_folders').upsert([lf], { onConflict: 'id' });
        }
      }
    }

    // 7. Ledger Sheets
    const ledgerSheets = pkgData.ledgerSheets || pkgData.ledger_sheets;
    if (ledgerSheets && Array.isArray(ledgerSheets)) {
      for (const ls of ledgerSheets) {
        if (ls.id) {
          const dbRow = ls.sheet_name !== undefined ? ls : toDb('ledger_sheets', ls);
          await supabase.from('ledger_sheets').upsert([dbRow], { onConflict: 'id' });
        }
      }
    }

    // 8. Branding / System Config
    const brandingConfig = pkgData.brandingConfig || pkgData.branding_config;
    if (brandingConfig && Array.isArray(brandingConfig)) {
      for (const bc of brandingConfig) {
        if (bc.config_type) {
          await supabase.from('branding_config').upsert([bc], { onConflict: 'config_type' });
        }
      }
    }

    // 9. Chat Messages
    const chatMessages = pkgData.chatMessages || pkgData.chat_messages;
    if (chatMessages && Array.isArray(chatMessages)) {
      for (const cm of chatMessages) {
        if (cm.id) {
          await supabase.from('chat_messages').upsert([cm], { onConflict: 'id' });
        }
      }
    }

    // 10. Chat Groups
    const chatGroups = pkgData.chatGroups || pkgData.chat_groups;
    if (chatGroups && Array.isArray(chatGroups)) {
      for (const cg of chatGroups) {
        if (cg.id) {
          await supabase.from('chat_groups').upsert([cg], { onConflict: 'id' });
        }
      }
    }

    // 11. Notifications
    const notifications = pkgData.notifications;
    if (notifications && Array.isArray(notifications)) {
      for (const n of notifications) {
        if (n.id) {
          await supabase.from('notifications').upsert([n], { onConflict: 'id' });
        }
      }
    }

    // 12. Recycle Bin
    const recycleBin = pkgData.recycleBin || pkgData.recycle_bin;
    if (recycleBin && Array.isArray(recycleBin)) {
      for (const rb of recycleBin) {
        if (rb.id) {
          await supabase.from('recycle_bin').upsert([rb], { onConflict: 'id' });
        }
      }
    }

    // 13. Monitor Targets
    const monitorTargets = pkgData.monitorTargets || pkgData.monitor_targets;
    if (monitorTargets && Array.isArray(monitorTargets)) {
      for (const mt of monitorTargets) {
        if (mt.id) {
          await supabase.from('monitor_targets').upsert([mt], { onConflict: 'id' });
        }
      }
    }

    // 14. Config Tables (categories, statuses, priorities, zones)
    if (pkgData.categoriesConfig && Array.isArray(pkgData.categoriesConfig)) {
      await supabase.from('categories_config').upsert(pkgData.categoriesConfig);
    }
    if (pkgData.statusesConfig && Array.isArray(pkgData.statusesConfig)) {
      await supabase.from('statuses_config').upsert(pkgData.statusesConfig);
    }
    if (pkgData.priorityConfig && Array.isArray(pkgData.priorityConfig)) {
      await supabase.from('priority_config').upsert(pkgData.priorityConfig);
    }
    if (pkgData.zoneConfig && Array.isArray(pkgData.zoneConfig)) {
      await supabase.from('zone_config').upsert(pkgData.zoneConfig);
    }
  },

  subscribeBillingMonths: (callback: (months: any[], isFresh?: boolean) => void, dealerId?: string) => {
    return subscribeTable('billing_months', callback, (row: any) => ({
      id: row.month_id || row.id,
      dbId: row.id,
      month_id: row.month_id,
      dealerId: row.dealer_id || dealerId || 'main',
      lineCode: row.line_code || '',
      rows: [],
      rowsLoaded: false,
      excludedClientKeys: parseExcludedKeys(row),
      updatedAt: row.updated ? new Date(row.updated).getTime() : Date.now(),
      createdAt: row.created ? new Date(row.created).getTime() : Date.now()
    }), dealerId);
  },

  subscribeTranslations: (callback: (translations: any) => void) => {
    const fetchT = async () => {
      try {
        const row = await fetchBrandingConfigType('translations');
        if (row && row.dashboard_subtext) {
          try { callback(JSON.parse(row.dashboard_subtext)); } catch (e) {}
        }
      } catch (e) {}
    };
    fetchT();
    const channelName = `trans_rt_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => fetchT())
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
    };
  },

  updateTranslations: async (translations: any) => {
    await upsertSupabase('branding_config', 'config_type', 'translations', {
      config_type: 'translations',
      dashboard_subtext: JSON.stringify(translations)
    });
  },

  getUserPreferences: async (uid: string): Promise<any> => {
    try {
      if (!supabase) return null;
      const { data } = await supabase.from('branding_config').select('*').eq('config_type', `user_prefs_${uid}`).limit(1);
      const res = data && data.length > 0 ? data[0] : null;
      if (res && res.dashboard_subtext) {
        return JSON.parse(res.dashboard_subtext);
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  updateUserPreferences: async (uid: string, prefs: any) => {
    await upsertSupabase('branding_config', 'config_type', `user_prefs_${uid}`, {
      config_type: `user_prefs_${uid}`,
      dashboard_subtext: JSON.stringify(prefs),
      tenant_id: 'main' // or default
    });
  },

  // --- LEDGER & FOLDERS ---
  subscribeLedgerFolders: (callback: (folders: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_folders', (foldersList) => {
      if (Array.isArray(foldersList)) {
        const sorted = [...foldersList].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(sorted);
      } else {
        callback(foldersList);
      }
    }, r => {
      const f = fromDb('ledger_folders', r);
      let parsedCreated = Date.now();
      if (f.createdAt) {
        if (typeof f.createdAt === 'number') {
          parsedCreated = f.createdAt;
        } else {
          const t = new Date(f.createdAt).getTime();
          if (!isNaN(t)) parsedCreated = t;
        }
      } else if (r.created_at) {
        const t = new Date(r.created_at).getTime();
        if (!isNaN(t)) parsedCreated = t;
      } else if (r.created) {
        const t = new Date(r.created).getTime();
        if (!isNaN(t)) parsedCreated = t;
      } else if (f.id && String(f.id).startsWith('folder_')) {
        const num = parseInt(String(f.id).split('_')[1], 10);
        if (!isNaN(num) && num > 0) parsedCreated = num;
      }
      return {
        id: f.id,
        name: f.name || '',
        parentId: f.parentId || f.parent_id || '',
        tenantId: f.tenantId || f.tenant_id || 'main',
        lineCode: f.lineCode || r.line_code || '',
        createdAt: parsedCreated
      };
    }, dealerId);
  },

  subscribeLedgerSheetFolderMap: (callback: (map: any) => void, dealerId?: string) => {
    // Deprecated: rely entirely on ledger_sheets.folder_id column
    setTimeout(() => callback({}), 0);
    return () => {};
  },

  subscribeFolderMonthMap: (callback: (map: any) => void, dealerId?: string) => {
    const tenantId = dealerId || 'main';
    const scopeKey = activeLineCode || tenantId;
    const prefix = `folder_month_${scopeKey}_`;
    const fetchM = async () => {
      try {
        if (!supabase) return;
        let { data } = await supabase
          .from('branding_config')
          .select('*')
          .like('config_type', `${prefix}%`);
        
        if ((!data || data.length === 0) && activeLineCode && tenantId && tenantId !== 'main') {
          const fallbackRes = await supabase
            .from('branding_config')
            .select('*')
            .like('config_type', `folder_month_${tenantId}_%`);
          data = fallbackRes.data;
        }
        
        const reconstructedMap: Record<string, string> = {};
        if (data && data.length > 0) {
          data.forEach(r => {
            const usedPrefix = r.config_type.startsWith(prefix) ? prefix : `folder_month_${tenantId}_`;
            if (r.config_type.startsWith(usedPrefix)) {
              const folderId = r.config_type.substring(usedPrefix.length);
              reconstructedMap[folderId] = r.dashboard_subtext || '';
            }
          });
        }
        callback(reconstructedMap);
      } catch (e) {
        console.warn("Error in subscribeFolderMonthMap fetch:", e);
      }
    };
    fetchM();
    let channel: any = null;
    try {
      const channelName = `rt_folder_month_${scopeKey}_${Math.random().toString(36).substring(2, 7)}`;
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => {
          fetchM();
        })
        .subscribe();
    } catch (e) {}
    const timer = setInterval(fetchM, 10000);
    return () => {
      clearInterval(timer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) {}
      }
    };
  },

  updateFolderMonthMap: async (map: any, tenantId: string = 'main') => {
    if (!supabase) return;
    try {
      const scopeKey = activeLineCode || tenantId;
      const prefix = `folder_month_${scopeKey}_`;
      const { data: existingRows } = await supabase
        .from('branding_config')
        .select('config_type')
        .like('config_type', `${prefix}%`);

      const existingConfigTypes = (existingRows || []).map(r => r.config_type);
      const incomingConfigTypes = new Set<string>();

      for (const [folderId, monthId] of Object.entries(map)) {
        if (!folderId) continue;
        const docId = `folder_month_${scopeKey}_${folderId}`;
        incomingConfigTypes.add(docId);
        
        await upsertSupabase('branding_config', 'config_type', docId, {
          config_type: docId,
          dashboard_subtext: String(monthId || ''),
          tenant_id: tenantId,
          line_code: activeLineCode || ''
        });
      }

      for (const configType of existingConfigTypes) {
        if (!incomingConfigTypes.has(configType)) {
          await supabase.from('branding_config').delete().eq('config_type', configType);
        }
      }
    } catch (e) {
      console.warn("Error in updateFolderMonthMap:", e);
    }
  },

  getLedgerFolders: async (tenantId: string = 'main') => {
    try {
      if (!supabase) return [];
      let query = supabase.from('ledger_folders').select('*');
      const cleanCode = String(activeLineCode || '').trim();
      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else if (tenantId && tenantId !== 'all' && tenantId !== 'main') {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped = data.map(r => {
          const f = fromDb('ledger_folders', r);
          let parsedCreated = Date.now();
          if (f.createdAt) {
            if (typeof f.createdAt === 'number') {
              parsedCreated = f.createdAt;
            } else {
              const t = new Date(f.createdAt).getTime();
              if (!isNaN(t)) parsedCreated = t;
            }
          } else if (r.created_at) {
            const t = new Date(r.created_at).getTime();
            if (!isNaN(t)) parsedCreated = t;
          } else if (r.created) {
            const t = new Date(r.created).getTime();
            if (!isNaN(t)) parsedCreated = t;
          } else if (f.id && String(f.id).startsWith('folder_')) {
            const num = parseInt(String(f.id).split('_')[1], 10);
            if (!isNaN(num) && num > 0) parsedCreated = num;
          }
          return {
            id: f.id,
            name: f.name || '',
            parentId: f.parentId || f.parent_id || '',
            tenantId: f.tenantId || f.tenant_id || 'main',
            lineCode: f.lineCode || r.line_code || '',
            createdAt: parsedCreated
          };
        });
        // Sort newest folders first (top-left)
        mapped.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return mapped;
      }

      // Fallback 1: Check branding_config
      const docId = activeLineCode ? `ledger_folders_data_${activeLineCode}` : `ledger_folders_data_${tenantId || 'main'}`;
      let { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
      if ((!bData || bData.length === 0) && activeLineCode && tenantId && tenantId !== 'main') {
        const fallbackB = await supabase.from('branding_config').select('*').eq('config_type', `ledger_folders_data_${tenantId}`).limit(1);
        bData = fallbackB.data;
      }
      if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
        try {
          const parsed = JSON.parse(bData[0].dashboard_subtext);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          }
        } catch (e) {}
      }

      // Fallback 2: Check localStorage
      const localCached = localStorage.getItem(`gts_cache_v3_ledger_folders_${tenantId || 'all'}_${activeLineCode || 'nolc'}`);
      if (localCached) {
        try {
          const parsed = JSON.parse(localCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          }
        } catch (e) {}
      }

      return [];
    } catch (e) {
      return [];
    }
  },

  deleteLedgerFolder: async (folderId: string, tenantId: string = 'main') => {
    try {
      const folderPrimaryKey = `ledger_folders_${tenantId || 'all'}_${activeLineCode || 'nolc'}`;
      if (globalTableCaches[folderPrimaryKey]) {
        globalTableCaches[folderPrimaryKey] = globalTableCaches[folderPrimaryKey].filter((f: any) => f.id !== folderId);
        const subs = globalTableSubscribers[folderPrimaryKey];
        if (subs) {
          subs.forEach((cb: any) => { try { cb(globalTableCaches[folderPrimaryKey]); } catch(e) {} });
        }
      }

      // Instantly unmap the sheets from global cache
      const sheetPrimaryKey = `ledger_sheets_${tenantId || 'all'}_${activeLineCode || 'nolc'}`;
      if (globalTableCaches[sheetPrimaryKey]) {
        globalTableCaches[sheetPrimaryKey] = globalTableCaches[sheetPrimaryKey].map((sh: any) => {
          if (sh.folderId === folderId) {
            return { ...sh, folderId: '', sort: '', sortFolder: '' };
          }
          return sh;
        });
        const subs = globalTableSubscribers[sheetPrimaryKey];
        if (subs) {
          subs.forEach((cb: any) => { try { cb(globalTableCaches[sheetPrimaryKey]); } catch(e) {} });
        }
      }

      // Update backup in branding_config if present
      const docId = activeLineCode ? `ledger_folders_data_${activeLineCode}` : `ledger_folders_data_${tenantId || 'main'}`;
      try {
        const { data: bData } = await supabase.from('branding_config').select('*').eq('config_type', docId).limit(1);
        if (bData && bData.length > 0 && bData[0].dashboard_subtext) {
          const parsed = JSON.parse(bData[0].dashboard_subtext);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(f => f.id !== folderId);
            await upsertSupabase('branding_config', 'config_type', docId, {
              config_type: docId,
              dashboard_subtext: JSON.stringify(updated),
              tenant_id: tenantId || 'main',
              line_code: activeLineCode || ''
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
      const primaryKey = `ledger_folders_${tenantId || 'all'}_${activeLineCode || 'nolc'}`;
      const previousFolders = globalTableCaches[primaryKey] || [];
      const prevMap = new Map<string, any>();
      if (Array.isArray(previousFolders)) {
        previousFolders.forEach((pf: any) => {
          if (pf && pf.id) prevMap.set(String(pf.id), pf);
        });
      }

      // 1. Stamp lineCode on each folder: an existing folder's VLAN is never overwritten by current user's VLAN
      for (const f of folders) {
        if (!f) continue;
        f.lineCode = f.lineCode !== undefined && f.lineCode !== '' ? f.lineCode : (activeLineCode || '');
      }

      // Instantly update exact primary key in global table cache and subscribers
      globalTableCaches[primaryKey] = folders;
      const subs = globalTableSubscribers[primaryKey];
      if (subs) {
        subs.forEach(cb => {
          try { cb(folders); } catch (cbErr) {}
        });
      }

      try {
        localStorage.setItem(`gts_cache_v3_${primaryKey}`, JSON.stringify(folders));
        localStorage.setItem(`gts_cache_meta_${primaryKey}`, String(Date.now()));
      } catch (e) {}

      if (!supabase) return;

      // 2. Dual-save as JSON backup in branding_config so folders are ALWAYS retained in Supabase DB
      const docId = activeLineCode ? `ledger_folders_data_${activeLineCode}` : `ledger_folders_data_${tenantId || 'main'}`;
      await upsertSupabase('branding_config', 'config_type', docId, {
        config_type: docId,
        dashboard_subtext: JSON.stringify(folders),
        tenant_id: tenantId || 'main',
        line_code: activeLineCode || ''
      });
      if (activeLineCode && tenantId && tenantId !== 'main' && docId !== `ledger_folders_data_${tenantId}`) {
        try {
          await upsertSupabase('branding_config', 'config_type', `ledger_folders_data_${tenantId}`, {
            config_type: `ledger_folders_data_${tenantId}`,
            dashboard_subtext: JSON.stringify(folders),
            tenant_id: tenantId,
            line_code: activeLineCode
          });
        } catch (e) {}
      }

      // 3. Persist directly to Supabase ledger_folders table - only folders that are new or changed
      for (const f of folders) {
        if (!f.id) continue;
        const prev = prevMap.get(String(f.id));
        const isNew = !prev;
        const isChanged = prev && (
          String(prev.name || '') !== String(f.name || '') ||
          String(prev.parentId || prev.parent_id || '') !== String(f.parentId || f.parent_id || '') ||
          String(prev.tenantId || prev.tenant_id || '') !== String(tenantId || 'main') ||
          String(prev.lineCode || prev.line_code || '') !== String(f.lineCode || '')
        );

        if (!isNew && !isChanged && prevMap.size > 0) {
          continue; // Skip unchanged folders
        }

        checkWarnEmptyLineCode('folder', String(f.id), f.lineCode);

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
          lineCode: String(f.lineCode || ''),
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
          } else if (upsertErr.message.includes('Could not find') && upsertErr.message.includes('column')) {
            console.warn("The 'ledger_folders' table is missing a 'created_at' column — folders were created but won't sort by creation time correctly until this column is added in Supabase (ALTER TABLE ledger_folders ADD COLUMN created_at timestamptz DEFAULT now();).");
            toast.warning("Table Column Missing: created_at", {
              description: "The 'ledger_folders' table is missing a 'created_at' column — folders were created but won't sort by creation time correctly until this column is added in Supabase (ALTER TABLE ledger_folders ADD COLUMN created_at timestamptz DEFAULT now();).",
              duration: 8000
            });
            const { created_at, ...dbRowWithoutCreatedAt } = dbRow;
            const { error: retryErr } = await supabase.from('ledger_folders').upsert(dbRowWithoutCreatedAt);
            if (retryErr) {
              await upsertSupabase('ledger_folders', 'id', String(f.id), dbRowWithoutCreatedAt);
            }
          } else {
            // Try standard fallback
            await upsertSupabase('ledger_folders', 'id', String(f.id), dbRow);
          }
        }
      }
    } catch (e) {
      console.warn("saveLedgerFolders error:", e);
      throw e;
    }
  },

  updateLedgerFolders: async (folders: any[], tenantId: string = 'main') => {
    await supabaseService.saveLedgerFolders(folders, tenantId);
  },

  updateLedgerSheetFolderMap: async (map: any, tenantId: string = 'main') => {
    // Deprecated: rely entirely on ledger_sheets.folder_id column
  },

  saveGoogleSheetLink: async (tenantId: string, folderId: string, sheetId: string) => {
    const payload: any = {
      tenant_id: tenantId,
      folder_id: folderId,
      sheet_id: sheetId
    };
    if (activeLineCode) payload.line_code = activeLineCode;
    try {
      const { data } = await supabase.from('google_sheet_links').select('id').eq('tenant_id', tenantId).eq('folder_id', folderId).limit(1).single();
      if (data) {
        await supabase.from('google_sheet_links').update(payload).eq('id', data.id);
      } else {
        await supabase.from('google_sheet_links').insert([payload]);
      }
    } catch (e) {}
  },

  getGoogleSheetLinks: async (tenantId: string, bypassLineCodeFilter: boolean | string = false) => {
    try {
      let query = supabase.from('google_sheet_links').select('*');
      const cleanCode = String(activeLineCode || '').trim();
      const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';

      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else if (cleanBypass) {
        query = query.eq('line_code', cleanBypass);
      }

      if (tenantId && tenantId !== 'all') {
        query = tenantId === 'main' ? query.or('tenant_id.eq.main,tenant_id.is.null') : query.eq('tenant_id', tenantId);
      }

      const { data } = await query;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  getLedgerSheets: async (tenantId: string = 'main', bypassLineCodeFilter: boolean | string = false, monthsBack: number = 2) => {
    try {
      let query = supabase.from('ledger_sheets').select('*');
      const cleanCode = String(activeLineCode || '').trim();
      const cleanBypass = typeof bypassLineCodeFilter === 'string' ? String(bypassLineCodeFilter || '').trim() : '';

      if (cleanCode) {
        query = query.eq('line_code', cleanCode);
      } else if (cleanBypass === '__without_line__' || bypassLineCodeFilter === null) {
        query = query.or('line_code.is.null,line_code.eq.');
      } else if (cleanBypass) {
        query = query.eq('line_code', cleanBypass);
      } else if (bypassLineCodeFilter === true) {
        // no filter
      } else {
        // when activeLineCode is empty and no bypass is given, add the strict filter
        query = query.or('line_code.is.null,line_code.eq.');
      }

      if (tenantId && tenantId !== 'all') {
        query = tenantId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null') : query.eq('dealer_id', tenantId);
      }

      if (monthsBack && monthsBack > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(1);
        cutoffDate.setHours(0, 0, 0, 0);
        cutoffDate.setMonth(cutoffDate.getMonth() - Math.max(0, monthsBack - 1));
        const cutoffIso = cutoffDate.toISOString();
        query = query.gte('created', cutoffIso);
      }

      const { data } = await query;
      return (data || []).map(r => fromDb('ledger_sheets', r));
    } catch (e) {
      return [];
    }
  },

  getLedgerSheetsForFolder: async (folderId: string, tenantId: string = 'main') => {
    try {
      if (!folderId) return [];
      let query = supabase.from('ledger_sheets').select('*').eq('folder_id', folderId);
      if (tenantId && tenantId !== 'all') {
        query = tenantId === 'main' ? query.or('dealer_id.eq.main,dealer_id.is.null') : query.eq('dealer_id', tenantId);
      }
      const { data } = await query;
      return (data || []).map(r => fromDb('ledger_sheets', r));
    } catch (e) {
      return [];
    }
  },

  getLedgerSheetDirect: async (sheetId: string) => {
    try {
      if (!sheetId) return null;
      const { data } = await supabase.from('ledger_sheets').select('*').eq('id', sheetId).maybeSingle();
      if (data) {
        return fromDb('ledger_sheets', data);
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  subscribeLedgerSheets: (callback: (sheets: any[]) => void, dealerId?: string) => {
    return subscribeTable('ledger_sheets', callback, r => fromDb('ledger_sheets', r), dealerId);
  },

  saveLedgerSheet: async (sheet: any, tenantId: string = 'main') => {
    if (!sheet) return {};

    const openedAt = sheet.openedUpdatedAt || sheet.initialUpdatedAt || sheet.openedUpdatedAtAsStoredInDb || sheet.updated_at;
    const openedAtNum = openedAt ? (typeof openedAt === 'number' ? openedAt : new Date(openedAt).getTime()) : 0;
    const currentSheetUpdatedAt = sheet.updatedAt ? (typeof sheet.updatedAt === 'number' ? sheet.updatedAt : new Date(sheet.updatedAt).getTime()) : Date.now();
    const finalUpdatedAt = Math.max(currentSheetUpdatedAt, (openedAtNum || 0) + 1);
    sheet.updatedAt = finalUpdatedAt;

    const sortValue = sheet.sort || sheet.sortFolder || sheet.folderName || '';
    let folderIdValue = sheet.folderId || '';

    // Safety check: prevent orphaned sheets if folder has been concurrently deleted
    if (folderIdValue && supabase) {
      try {
        const { data: folderExists } = await supabase.from('ledger_folders').select('id').eq('id', folderIdValue).maybeSingle();
        if (!folderExists) {
          folderIdValue = '';
        }
      } catch (e) {
        const foldersCache = globalTableCaches[`ledger_folders_${tenantId}`] || globalTableCaches[`ledger_folders_all`] || [];
        const existsInCache = foldersCache.some((f: any) => f.id === folderIdValue);
        if (!existsInCache) {
          folderIdValue = '';
        }
      }
    }

    const itemObj = { ...sheet, sort: folderIdValue ? sortValue : '', folderId: folderIdValue, dealerId: tenantId, lineCode: sheet.lineCode || activeLineCode || '' };
    checkWarnEmptyLineCode('sheet', String(sheet.id), itemObj.lineCode);
    const dbRow = toDb('ledger_sheets', itemObj);
    delete dbRow.updated;
    delete dbRow.updated_at;

    let returnedUpdatedString: string | undefined = undefined;

    if (supabase && sheet.id) {
      // Check if sheet already exists in database
      let existingRow: any = null;
      try {
        const { data } = await supabase
          .from('ledger_sheets')
          .select('id, updated')
          .eq('id', sheet.id)
          .maybeSingle();
        existingRow = data;
      } catch (checkErr) {
        console.warn("Check existing sheet warning in saveLedgerSheet:", checkErr);
      }

      if (existingRow) {
        // Compare-and-swap update for existing sheets:
        // The opened version string is sheet.openedUpdatedAtAsStoredInDb (raw string from the DB updated column); do not rebuild it from Date/ISO/number and never fall back to updated_at.
        let openedVersionString = (typeof sheet.openedUpdatedAtAsStoredInDb === 'string' && sheet.openedUpdatedAtAsStoredInDb.trim())
          ? sheet.openedUpdatedAtAsStoredInDb.trim()
          : (typeof sheet.updated === 'string' && sheet.updated.trim() ? sheet.updated.trim() : undefined);

        if (!openedVersionString && existingRow.updated) {
          console.warn(`[CAS Warning] Sheet ${sheet.id} missing opened version string. Using current database updated value as compare value.`);
          openedVersionString = String(existingRow.updated);
        }

        let updateError: any = null;
        let updatedRows: any[] | null = null;
        try {
          const res = await supabase
            .from('ledger_sheets')
            .update(dbRow)
            .eq('id', sheet.id)
            .eq('updated', openedVersionString)
            .select('id, updated');
          updateError = res.error;
          updatedRows = res.data;
        } catch (err: any) {
          updateError = err;
        }

        if (updateError || !updatedRows || updatedRows.length === 0) {
          // If zero rows come back, read the row's current updated once
          try {
            const { data: verifyRow } = await supabase
              .from('ledger_sheets')
              .select('id, updated, table1_rows, table2_rows')
              .eq('id', sheet.id)
              .maybeSingle();

            if (verifyRow && verifyRow.updated) {
              const currentDbUpdated = String(verifyRow.updated);
              const dbMs = new Date(currentDbUpdated).getTime();
              const openedMs = openedVersionString ? new Date(openedVersionString).getTime() : 0;
              const diffMs = Math.abs(dbMs - openedMs);

              if (diffMs <= 1) {
                // Same instant (parse both to ms, difference <= 1 ms, because of microsecond formatting) retry ONCE using the database's raw current string
                const resRetry = await supabase
                  .from('ledger_sheets')
                  .update(dbRow)
                  .eq('id', sheet.id)
                  .eq('updated', currentDbUpdated)
                  .select('id, updated');
                if (!resRetry.error && resRetry.data && resRetry.data.length > 0) {
                  updateError = null;
                  updatedRows = resRetry.data;
                }
              }

              if (updateError || !updatedRows || updatedRows.length === 0) {
                if (dbMs > openedMs + 1) {
                  console.warn(`[CAS Conflict] Sheet ${sheet.id} opened version: ${openedVersionString}, database updated: ${currentDbUpdated}, diff: ${dbMs - openedMs}ms`);
                  // Check if content equals payload's (ambiguous timeout where write succeeded)
                  const payloadT1 = typeof dbRow.table1_rows === 'string' ? dbRow.table1_rows : JSON.stringify(dbRow.table1_rows || []);
                  const payloadT2 = typeof dbRow.table2_rows === 'string' ? dbRow.table2_rows : JSON.stringify(dbRow.table2_rows || []);
                  const dbT1 = typeof verifyRow.table1_rows === 'string' ? verifyRow.table1_rows : JSON.stringify(verifyRow.table1_rows || []);
                  const dbT2 = typeof verifyRow.table2_rows === 'string' ? verifyRow.table2_rows : JSON.stringify(verifyRow.table2_rows || []);

                  if (payloadT1 === dbT1 && payloadT2 === dbT2) {
                    updatedRows = [{ id: sheet.id, updated: currentDbUpdated }];
                    updateError = null;
                  } else {
                    throw new Error("This sheet was changed on another device. Please reload it and try again.");
                  }
                } else if (updateError) {
                  const payloadT1 = typeof dbRow.table1_rows === 'string' ? dbRow.table1_rows : JSON.stringify(dbRow.table1_rows || []);
                  const payloadT2 = typeof dbRow.table2_rows === 'string' ? dbRow.table2_rows : JSON.stringify(dbRow.table2_rows || []);
                  const dbT1 = typeof verifyRow.table1_rows === 'string' ? verifyRow.table1_rows : JSON.stringify(verifyRow.table1_rows || []);
                  const dbT2 = typeof verifyRow.table2_rows === 'string' ? verifyRow.table2_rows : JSON.stringify(verifyRow.table2_rows || []);

                  if (payloadT1 === dbT1 && payloadT2 === dbT2) {
                    updatedRows = [{ id: sheet.id, updated: currentDbUpdated }];
                    updateError = null;
                  } else {
                    throw updateError;
                  }
                }
              }
            }
          } catch (verifyEx: any) {
            if (verifyEx.message && verifyEx.message.includes("changed on another device")) {
              throw verifyEx;
            }
          }
        }

        if (updateError) {
          throw updateError;
        }

        if (!updatedRows || updatedRows.length === 0) {
          throw new Error("This sheet was changed on another device. Please reload it and try again.");
        }

        returnedUpdatedString = updatedRows[0]?.updated;
      } else {
        // New sheets: .insert([dbRow]).select('id, updated')
        let res = await supabase.from('ledger_sheets').insert([dbRow]).select('id, updated');
        if (res.error) {
          throw res.error;
        }
        returnedUpdatedString = res.data?.[0]?.updated;
      }
    } else {
      await upsertSupabase('ledger_sheets', 'id', sheet.id, dbRow, true);
    }

    if (returnedUpdatedString) {
      sheet.updated = returnedUpdatedString;
      sheet.openedUpdatedAtAsStoredInDb = returnedUpdatedString;
    }

    // Write globalTableCaches, notify subscribers, and write localStorage ONLY AFTER database save has succeeded
    const syncKey = `ledger_sheets_${tenantId || 'all'}_${activeLineCode || 'nolc'}`;
    if (!globalTableCaches[syncKey]) globalTableCaches[syncKey] = [];
    const cachedItemObj = { ...itemObj, updated: returnedUpdatedString || itemObj.updated };
    const idx = globalTableCaches[syncKey].findIndex(item => item.id === sheet.id);
    if (idx !== -1) {
      globalTableCaches[syncKey][idx] = { ...globalTableCaches[syncKey][idx], ...cachedItemObj };
    } else {
      globalTableCaches[syncKey].unshift(cachedItemObj);
    }
    const subs = globalTableSubscribers[syncKey];
    if (subs) {
      subs.forEach(cb => { try { cb(globalTableCaches[syncKey]); } catch (e) {} });
    }

    try {
      localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(globalTableCaches[syncKey] || []));
      localStorage.setItem(`gts_cache_meta_${syncKey}`, String(Date.now()));
    } catch (e) {}

    return returnedUpdatedString ? { [sheet.id]: returnedUpdatedString } : {};
  },

  saveLedgerSheetsBatch: async (sheets: any[], tenantId: string = 'main') => {
    if (!sheets || sheets.length === 0) return {};

    const sheetIds = sheets.map(sh => sh.id).filter(Boolean);
    const existingRowsMap = new Map<string, any>();

    if (supabase && sheetIds.length > 0) {
      try {
        const { data: existingRows, error: checkError } = await supabase
          .from('ledger_sheets')
          .select('id, updated')
          .in('id', sheetIds);

        if (!checkError && existingRows) {
          existingRows.forEach(r => existingRowsMap.set(r.id, r));
        }
      } catch (err: any) {
        console.warn("Optimistic concurrency check query warning in saveLedgerSheetsBatch:", err);
      }
    }

    const folderIds = Array.from(new Set(sheets.map(sh => sh.folderId).filter(Boolean)));
    const validFolderIds = new Set<string>();

    // Skip folder query when folderId is already in cached folders
    const foldersCache = globalTableCaches[`ledger_folders_${tenantId}`] || globalTableCaches[`ledger_folders_all`] || [];
    const missingFolderIds: string[] = [];
    folderIds.forEach(fId => {
      if (foldersCache.some((f: any) => f.id === fId)) {
        validFolderIds.add(fId);
      } else {
        missingFolderIds.push(fId);
      }
    });

    if (missingFolderIds.length > 0 && supabase) {
      try {
        const { data: existingFolders } = await supabase.from('ledger_folders').select('id').in('id', missingFolderIds);
        if (existingFolders) {
          existingFolders.forEach(f => validFolderIds.add(f.id));
        }
      } catch (e) {
        console.warn("Could not query missing folders:", e);
      }
    }

    const tStartSheets = performance.now();
    const itemObjs: any[] = [];
    const updatedStringMap: Record<string, string> = {};

    // Save each sheet using compare-and-swap for existing sheets and insert for new sheets
    await Promise.all(sheets.map(async (sheet) => {
      const sortValue = sheet.sort || sheet.sortFolder || sheet.folderName || '';
      let folderIdValue = sheet.folderId || '';
      if (folderIdValue && !validFolderIds.has(folderIdValue)) {
        folderIdValue = '';
      }

      const itemObj = { ...sheet, sort: folderIdValue ? sortValue : '', folderId: folderIdValue, dealerId: tenantId, lineCode: sheet.lineCode || activeLineCode || '' };
      checkWarnEmptyLineCode('sheet', String(sheet.id), itemObj.lineCode);
      itemObjs.push(itemObj);
      const dbRow = toDb('ledger_sheets', itemObj);
      delete dbRow.updated;
      delete dbRow.updated_at;

      let sheetUpdatedString: string | undefined = undefined;

      if (supabase && sheet.id) {
        const existingRow = existingRowsMap.get(sheet.id);

        if (existingRow) {
          // Compare-and-swap update for existing sheets:
          // The opened version string is sheet.openedUpdatedAtAsStoredInDb (raw string from the DB updated column); do not rebuild it from Date/ISO/number and never fall back to updated_at.
          let openedVersionString = (typeof sheet.openedUpdatedAtAsStoredInDb === 'string' && sheet.openedUpdatedAtAsStoredInDb.trim())
            ? sheet.openedUpdatedAtAsStoredInDb.trim()
            : (typeof sheet.updated === 'string' && sheet.updated.trim() ? sheet.updated.trim() : undefined);

          if (!openedVersionString && existingRow.updated) {
            console.warn(`[CAS Warning] Sheet ${sheet.id} missing opened version string. Using current database updated value as compare value.`);
            openedVersionString = String(existingRow.updated);
          }

          let updateError: any = null;
          let updatedRows: any[] | null = null;
          try {
            const res = await supabase
              .from('ledger_sheets')
              .update(dbRow)
              .eq('id', sheet.id)
              .eq('updated', openedVersionString)
              .select('id, updated');
            updateError = res.error;
            updatedRows = res.data;
          } catch (err: any) {
            updateError = err;
          }

          if (updateError || !updatedRows || updatedRows.length === 0) {
            // Re-read current row to check if conflict or timeout/ambiguous error
            try {
              const { data: verifyRow } = await supabase
                .from('ledger_sheets')
                .select('id, updated, table1_rows, table2_rows')
                .eq('id', sheet.id)
                .maybeSingle();

              if (verifyRow && verifyRow.updated) {
                const currentDbUpdated = String(verifyRow.updated);
                const dbMs = new Date(currentDbUpdated).getTime();
                const openedMs = openedVersionString ? new Date(openedVersionString).getTime() : 0;
                const diffMs = Math.abs(dbMs - openedMs);

                if (diffMs <= 1) {
                  // Same instant -> retry once
                  const resRetry = await supabase
                    .from('ledger_sheets')
                    .update(dbRow)
                    .eq('id', sheet.id)
                    .eq('updated', currentDbUpdated)
                    .select('id, updated');
                  if (!resRetry.error && resRetry.data && resRetry.data.length > 0) {
                    updateError = null;
                    updatedRows = resRetry.data;
                  }
                }

                if (updateError || !updatedRows || updatedRows.length === 0) {
                  if (dbMs > openedMs + 1) {
                    console.warn(`[CAS Conflict] Sheet ${sheet.id} opened version: ${openedVersionString}, database updated: ${currentDbUpdated}, diff: ${dbMs - openedMs}ms`);
                    const payloadT1 = typeof dbRow.table1_rows === 'string' ? dbRow.table1_rows : JSON.stringify(dbRow.table1_rows || []);
                    const payloadT2 = typeof dbRow.table2_rows === 'string' ? dbRow.table2_rows : JSON.stringify(dbRow.table2_rows || []);
                    const dbT1 = typeof verifyRow.table1_rows === 'string' ? verifyRow.table1_rows : JSON.stringify(verifyRow.table1_rows || []);
                    const dbT2 = typeof verifyRow.table2_rows === 'string' ? verifyRow.table2_rows : JSON.stringify(verifyRow.table2_rows || []);

                    if (payloadT1 === dbT1 && payloadT2 === dbT2) {
                      updatedRows = [{ id: sheet.id, updated: currentDbUpdated }];
                      updateError = null;
                    } else {
                      throw new Error("This sheet was changed on another device. Please reload it and try again.");
                    }
                  } else if (updateError) {
                    const payloadT1 = typeof dbRow.table1_rows === 'string' ? dbRow.table1_rows : JSON.stringify(dbRow.table1_rows || []);
                    const payloadT2 = typeof dbRow.table2_rows === 'string' ? dbRow.table2_rows : JSON.stringify(dbRow.table2_rows || []);
                    const dbT1 = typeof verifyRow.table1_rows === 'string' ? verifyRow.table1_rows : JSON.stringify(verifyRow.table1_rows || []);
                    const dbT2 = typeof verifyRow.table2_rows === 'string' ? verifyRow.table2_rows : JSON.stringify(verifyRow.table2_rows || []);

                    if (payloadT1 === dbT1 && payloadT2 === dbT2) {
                      updatedRows = [{ id: sheet.id, updated: currentDbUpdated }];
                      updateError = null;
                    } else {
                      throw updateError;
                    }
                  }
                }
              }
            } catch (verifyEx: any) {
              if (verifyEx.message && verifyEx.message.includes("changed on another device")) {
                throw verifyEx;
              }
            }
          }

          if (updateError) {
            throw updateError;
          }

          if (!updatedRows || updatedRows.length === 0) {
            throw new Error("This sheet was changed on another device. Please reload it and try again.");
          }

          sheetUpdatedString = updatedRows[0]?.updated;
        } else {
          // New sheets are inserted: .insert([dbRow]).select('id, updated')
          let res = await supabase.from('ledger_sheets').insert([dbRow]).select('id, updated');
          if (res.error) {
            throw res.error;
          }
          sheetUpdatedString = res.data?.[0]?.updated;
        }
      } else {
        await upsertSupabase('ledger_sheets', 'id', sheet.id, dbRow, true);
      }

      if (sheetUpdatedString) {
        sheet.updated = sheetUpdatedString;
        sheet.openedUpdatedAtAsStoredInDb = sheetUpdatedString;
        updatedStringMap[sheet.id] = sheetUpdatedString;
      }
    }));

    const elapsedSheets = Math.round(performance.now() - tStartSheets);
    console.log(`[Save Timing] saveLedgerSheetsBatch for ${sheets.length} sheet(s) took ${elapsedSheets}ms`);

    // Write globalTableCaches, notify subscribers, and write localStorage ONLY AFTER database save has succeeded
    const syncKey = `ledger_sheets_${tenantId || 'all'}_${activeLineCode || 'nolc'}`;
    if (!globalTableCaches[syncKey]) globalTableCaches[syncKey] = [];

    itemObjs.forEach(itemObj => {
      const returnedUpdated = updatedStringMap[itemObj.id];
      const cachedItem = { ...itemObj, updated: returnedUpdated || itemObj.updated };
      const idx = globalTableCaches[syncKey].findIndex(item => item.id === itemObj.id);
      if (idx !== -1) {
        globalTableCaches[syncKey][idx] = { ...globalTableCaches[syncKey][idx], ...cachedItem };
      } else {
        globalTableCaches[syncKey].unshift(cachedItem);
      }
    });

    const subs = globalTableSubscribers[syncKey];
    if (subs) {
      subs.forEach(cb => { try { cb(globalTableCaches[syncKey]); } catch (e) {} });
    }

    try {
      localStorage.setItem(`gts_cache_v3_${syncKey}`, JSON.stringify(globalTableCaches[syncKey] || []));
      localStorage.setItem(`gts_cache_meta_${syncKey}`, String(Date.now()));
    } catch (e) {}

    return updatedStringMap;
  },

  terminateAllLedgerSheets: async (tenantId: string = 'main', authorName: string = 'admin') => {
    try {
      await supabase.from('ledger_sheets').delete().eq('dealer_id', tenantId);
    } catch (e) {}
  },

  deleteLedgerSheet: async (sheetId: string, authorName: string = 'admin', tenantId: string = 'main', fullSheetData?: any, isPermanent: boolean = false) => {
    try {
      if (!isPermanent && fullSheetData) {
        await supabaseService.saveToRecycleBin('ledger_sheets', sheetId, authorName, tenantId, fullSheetData);
      }
      await supabase.from('ledger_sheets').delete().eq('id', sheetId);
    } catch (e) {}
  },

  // --- RECYCLE BIN ---
  saveToRecycleBin: async (tableName: string, recordId: string, authorName: string, dealerId?: string, extraData?: any) => {
    try {
      const itemTitle = extraData?.customerName || extraData?.username || extraData?.clientName || extraData?.name || extraData?.title || recordId;
      await supabaseService.createNotification({
        type: 'recycle_bin',
        message: `Deleted ${tableName.replace('_', ' ')}: ${itemTitle}`,
        authorName: authorName || 'System',
        dealerId: dealerId || 'main',
        details: {
          originalTable: tableName,
          originalId: recordId,
          originalData: extraData || { id: recordId },
          deletedAt: Date.now()
        }
      });
      await supabase.from('recycle_bin').insert([{
        table_name: tableName,
        record_id: recordId,
        author_name: authorName,
        dealer_id: dealerId || 'main',
        data: extraData ? (typeof extraData === 'string' ? extraData : JSON.stringify(extraData)) : null,
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
      let details: any = null;
      const { data: notif } = await supabase.from('notifications').select('*').eq('id', recycleBinItemId).maybeSingle();
      if (notif) {
        details = typeof notif.details === 'string' ? JSON.parse(notif.details) : notif.details;
      }
      if (!details) {
        const { data: rbItem } = await supabase.from('recycle_bin').select('*').eq('id', recycleBinItemId).maybeSingle();
        if (rbItem && rbItem.data) {
          details = {
            originalTable: rbItem.table_name,
            originalId: rbItem.record_id,
            originalData: typeof rbItem.data === 'string' ? JSON.parse(rbItem.data) : rbItem.data
          };
        }
      }

      if (details && details.originalTable && details.originalData) {
        const table = details.originalTable;
        const data = details.originalData;

        if (table === 'complaints') {
          await upsertSupabase('complaints', 'id', data.id, toDb('complaints', data));
        } else if (table === 'users' || table === 'users_data') {
          await upsertSupabase('users_data', 'uid', data.uid || data.id, toDb('users_data', data));
        } else if (table === 'clients') {
          await upsertSupabase('clients', 'id', data.id, toDb('clients', data));
        } else if (table === 'ledger_sheets') {
          await upsertSupabase('ledger_sheets', 'id', data.id, toDb('ledger_sheets', data));
        } else if (table === 'billing_rows') {
          // data is expected to be { originalData, monthId, dealerId } from saveToRecycleBin
          const rowData = data.originalData || data;
          const monthId = data.monthId || rowData.month_id;
          const dealerId = data.dealerId || rowData.dealer_id || 'main';
          
          if (monthId && rowData) {
            let rowId = rowData.clientId || rowData.id;
            if (!rowId || !String(rowId).trim()) {
              if (rowData.username && String(rowData.username).trim()) {
                rowId = `usr_${String(rowData.username).trim().toLowerCase()}`;
              } else if (rowData.name && String(rowData.name).trim()) {
                rowId = `name_${String(rowData.name).trim().toLowerCase().replace(/\s+/g, '_')}_restored`;
              } else {
                rowId = `row_restored_${Date.now()}`;
              }
            }
            
            // Ensure clientId is present on the restored object
            if (!rowData.clientId) {
              rowData.clientId = rowId;
            }

            const dbRow = toDb('billing_rows', {
              ...rowData,
              id: `${monthId}_${rowId}`,
              month_id: monthId,
              dealer_id: dealerId,
              client_id: rowId,
            });
            await upsertSupabase('billing_rows', 'id', dbRow.id, dbRow);
            
            // Also append back to the billing_months JSON to reflect in the active UI
            if (supabase) {
              const { data: monthData } = await supabase.from('billing_months').select('*').eq('month_id', monthId).eq('dealer_id', dealerId).maybeSingle();
              if (monthData) {
                const rowsStr = monthData.rows_data ?? monthData.rows;
                let currentRows: any[] = [];
                let parsedObj: any = null;
                if (typeof rowsStr === 'string' && rowsStr.trim()) {
                  try { 
                    parsedObj = JSON.parse(rowsStr); 
                    if (Array.isArray(parsedObj)) currentRows = parsedObj;
                    else if (parsedObj && typeof parsedObj === 'object' && Array.isArray(parsedObj.rows)) currentRows = parsedObj.rows;
                  } catch (e) {}
                } else if (Array.isArray(rowsStr)) {
                  currentRows = rowsStr;
                } else if (rowsStr && typeof rowsStr === 'object' && !Array.isArray(rowsStr) && Array.isArray(rowsStr.rows)) {
                  parsedObj = rowsStr;
                  currentRows = rowsStr.rows;
                }
                
                // Add if not already present
                if (!currentRows.some((r: any) => (r.clientId || r.id) === rowId)) {
                  currentRows.push(rowData);
                  
                  let newRowsData: any = currentRows;
                  if (parsedObj && typeof parsedObj === 'object' && !Array.isArray(parsedObj)) {
                     newRowsData = { ...parsedObj, rows: currentRows };
                  } else {
                     newRowsData = { rows: currentRows, excludedClientKeys: parseExcludedKeys(monthData) };
                  }

                  await supabase.from('billing_months').update({
                    rows_data: JSON.stringify(newRowsData)
                  }).eq('month_id', monthId).eq('dealer_id', dealerId);
                  
                  // Trigger cache update so UI sees it instantly
                  const exactKey = `billing_months_${dealerId || 'all'}_${activeLineCode || 'nolc'}`;
                  if (globalTableCaches[exactKey]) {
                    const mIndex = globalTableCaches[exactKey].findIndex((m: any) => m.id === monthId && (m.dealerId === dealerId || (!m.dealerId && (dealerId === 'main' || dealerId === 'all'))));
                    if (mIndex !== -1) {
                      globalTableCaches[exactKey][mIndex].rows = currentRows;
                    }
                    const subs = globalTableSubscribers[exactKey];
                    if (subs) {
                      subs.forEach(cb => { try { cb([...globalTableCaches[exactKey]], true); } catch(e){} });
                    }
                    try {
                      localStorage.setItem(`gts_cache_v3_${exactKey}`, JSON.stringify(globalTableCaches[exactKey]));
                      localStorage.setItem(`gts_cache_meta_${exactKey}`, String(Date.now()));
                    } catch (e) {}
                  }
                }
              }
            }
          }
        } else {
          try {
            await supabase.from(table).upsert([data]);
          } catch (err) {}
        }
      }

      await supabase.from('notifications').delete().eq('id', recycleBinItemId);
      if (details && details.originalTable && details.originalId) {
        await supabase.from('recycle_bin').delete()
          .eq('table_name', details.originalTable)
          .eq('record_id', details.originalId);
      } else {
        await supabase.from('recycle_bin').delete().eq('id', recycleBinItemId);
      }
    } catch (e) {
      console.error("Error restoring item from recycle bin:", e);
    }
  },

  permanentlyDeleteFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      const { data: notif } = await supabase.from('notifications').select('*').eq('id', recycleBinItemId).maybeSingle();
      if (notif) {
        let details = typeof notif.details === 'string' ? JSON.parse(notif.details) : notif.details;
        await supabase.from('notifications').delete().eq('id', recycleBinItemId);
        if (details && details.originalTable && details.originalId) {
          await supabase.from('recycle_bin').delete()
            .eq('table_name', details.originalTable)
            .eq('record_id', details.originalId);
        }
      } else {
        await supabase.from('notifications').delete().eq('id', recycleBinItemId);
        await supabase.from('recycle_bin').delete().eq('id', recycleBinItemId);
      }
    } catch (e) {
      console.error("Error permanently deleting:", e);
    }
  },

  emptyRecycleBin: async () => {
    try {
      await supabase.from('notifications').delete().eq('type', 'recycle_bin');
      await supabase.from('recycle_bin').delete().neq('id', '');
    } catch (e) {}
  },

  cleanOldRecycleBinItems: async (days: number = 30) => {
    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      await supabase.from('notifications').delete().eq('type', 'recycle_bin').lt('created_at', cutoff);
      await supabase.from('recycle_bin').delete().lt('created_at', cutoff);
    } catch (e) {}
  },

  migrateAllRowsToBillingMonths: async (dealerId: string = 'main') => {
    try {
      await supabaseService.getBillingMonths(dealerId, false, 999);
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
  },

  // --- REMINDER LEADS & CAMPAIGNS ---
  createReminderLead: async (data: {
    name: string;
    dealerId: string;
    lineCode?: string;
    monthId: string;
    dueDateStart: string;
    dueDateEnd: string;
    waitSeconds: number;
    items: { clientId: string; name: string; mobileNumber: string; message?: string }[];
  }): Promise<string> => {
    try {
      const leadPayload = {
        name: data.name,
        dealer_id: data.dealerId || 'main',
        line_code: data.lineCode || activeLineCode || null,
        month_id: data.monthId,
        due_date_start: data.dueDateStart,
        due_date_end: data.dueDateEnd,
        wait_seconds: data.waitSeconds || 30,
        status: 'pending',
        total_count: data.items.length,
        success_count: 0,
        failed_count: 0
      };

      const { data: leadRow, error: leadErr } = await supabase
        .from('reminder_leads')
        .insert(leadPayload)
        .select('id')
        .single();

      if (leadErr) {
        console.error("Failed to insert reminder_lead:", leadErr);
        throw leadErr;
      }

      const leadId = leadRow.id;

      if (data.items && data.items.length > 0) {
        const itemRows = data.items.map((item: any, idx: number) => {
          const row: any = {
            lead_id: leadId,
            client_id: String(item.username || item.clientId || ''),
            name: String(item.name || ''),
            mobile_number: String(item.mobileNumber || ''),
            message: item.message || null,
            status: 'pending',
            sort_order: idx
          };
          if (item.username) {
            row.username = String(item.username);
          }
          return row;
        });

        let { error: itemsErr } = await supabase
          .from('reminder_lead_items')
          .insert(itemRows);

        if (itemsErr && itemsErr.message?.includes('username')) {
          console.warn("Retrying reminder_lead_items insert without username column:", itemsErr.message);
          const fallbackRows = itemRows.map(({ username, ...rest }: any) => rest);
          const { error: fallbackErr } = await supabase
            .from('reminder_lead_items')
            .insert(fallbackRows);
          if (fallbackErr) {
            console.error("Failed to insert reminder_lead_items on fallback:", fallbackErr);
            throw fallbackErr;
          }
        } else if (itemsErr) {
          console.error("Failed to insert reminder_lead_items:", itemsErr);
          throw itemsErr;
        }
      }

      return leadId;
    } catch (e: any) {
      console.error("createReminderLead error:", e);
      throw e;
    }
  },

  getReminderLeads: async (dealerId?: string): Promise<ReminderLead[]> => {
    try {
      let query = supabase.from('reminder_leads').select('*').order('created_at', { ascending: false });
      if (dealerId && dealerId !== 'main') {
        query = query.eq('dealer_id', dealerId);
      }
      const { data, error } = await query;
      if (error) {
        console.error("getReminderLeads error:", error);
        return [];
      }
      return (data || []).map(r => fromDb('reminder_leads', r));
    } catch (e) {
      console.error("getReminderLeads exception:", e);
      return [];
    }
  },

  subscribeReminderLeads: (callback: (leads: ReminderLead[]) => void, dealerId?: string) => {
    const sortLeads = (data: any[]) => (data || []).sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.created ? new Date(a.created).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.created ? new Date(b.created).getTime() : 0);
      return timeB - timeA;
    });

    const unsubscribeTable = subscribeTable('reminder_leads', (data) => {
      callback(sortLeads(data));
    }, r => fromDb('reminder_leads', r), dealerId);

    // Polling fallback (matches subscribeReminderLeadItems) so the lead
    // registry keeps updating live even if realtime isn't delivering
    // postgres_changes events on this instance.
    const pollInterval = setInterval(async () => {
      try {
        let query = supabase.from('reminder_leads').select('*');
        if (dealerId && dealerId !== 'main') {
          query = query.eq('dealer_id', dealerId);
        }
        const { data, error } = await query;
        if (!error && data) {
          callback(sortLeads(data.map((r: any) => fromDb('reminder_leads', r))));
        }
      } catch (e) {}
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      if (typeof unsubscribeTable === 'function') unsubscribeTable();
    };
  },

  getReminderLeadItems: async (leadId: string): Promise<ReminderLeadItem[]> => {
    try {
      const { data, error } = await supabase
        .from('reminder_lead_items')
        .select('*')
        .eq('lead_id', leadId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error("getReminderLeadItems error:", error);
        return [];
      }

      return (data || []).map(r => fromDb('reminder_lead_items', r));
    } catch (e) {
      console.error("getReminderLeadItems exception:", e);
      return [];
    }
  },

  subscribeReminderLeadItems: (leadId: string, callback: (items: ReminderLeadItem[]) => void) => {
    // Initial fetch
    supabaseService.getReminderLeadItems(leadId).then(items => {
      callback(items);
    }).catch(console.warn);

    // Live polling interval for guaranteed realtime updates even without WebSockets
    const pollInterval = setInterval(() => {
      supabaseService.getReminderLeadItems(leadId).then(items => {
        callback(items);
      }).catch(() => {});
    }, 1500);

    const channelName = `lead_items_${leadId}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminder_lead_items',
          filter: `lead_id=eq.${leadId}`
        },
        async () => {
          const fresh = await supabaseService.getReminderLeadItems(leadId);
          callback(fresh);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  },

  updateReminderLeadItem: async (itemId: string, patch: {
    status?: string;
    sentAt?: string;
    errorMessage?: string;
    waitSecondsAfter?: number;
  }) => {
    try {
      const updateData: any = {};
      if (patch.status !== undefined) updateData.status = patch.status;
      if (patch.sentAt !== undefined) updateData.sent_at = patch.sentAt;
      if (patch.errorMessage !== undefined) updateData.error_message = patch.errorMessage;
      if (patch.waitSecondsAfter !== undefined) updateData.wait_seconds_after = patch.waitSecondsAfter;

      const { error } = await supabase
        .from('reminder_lead_items')
        .update(updateData)
        .eq('id', itemId);

      if (error) {
        console.error("updateReminderLeadItem error:", error);
      }
    } catch (e) {
      console.error("updateReminderLeadItem exception:", e);
    }
  },

  updateReminderLead: async (leadId: string, patch: {
    status?: string;
    successCount?: number;
    failedCount?: number;
    startedAt?: string;
    completedAt?: string;
  }) => {
    try {
      const updateData: any = {};
      if (patch.status !== undefined) updateData.status = patch.status;
      if (patch.successCount !== undefined) updateData.success_count = patch.successCount;
      if (patch.failedCount !== undefined) updateData.failed_count = patch.failedCount;
      if (patch.startedAt !== undefined) updateData.started_at = patch.startedAt;
      if (patch.completedAt !== undefined) updateData.completed_at = patch.completedAt;

      const { error } = await supabase
        .from('reminder_leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) {
        console.error("updateReminderLead error:", error);
      }
    } catch (e) {
      console.error("updateReminderLead exception:", e);
    }
  },

  deleteReminderLead: async (leadId: string): Promise<boolean> => {
    try {
      if (!leadId) return false;

      // 1. Delete associated reminder_lead_items first
      try {
        const { error: itemsErr } = await supabase
          .from('reminder_lead_items')
          .delete()
          .eq('lead_id', leadId);

        if (itemsErr) {
          console.warn("deleteReminderLead items delete warning:", itemsErr);
        }
      } catch (errItems) {
        console.warn("deleteReminderLead items exception:", errItems);
      }

      // 2. Delete the lead from reminder_leads
      const { error: leadErr } = await supabase
        .from('reminder_leads')
        .delete()
        .eq('id', leadId);

      if (leadErr) {
        console.error("deleteReminderLead error:", leadErr);
        throw leadErr;
      }

      // 3. Notify backend / server to halt if background job is processing
      try {
        const { deleteReminderLeadApi } = await import('../whatsapp_data');
        if (typeof deleteReminderLeadApi === 'function') {
          deleteReminderLeadApi(leadId).catch(() => {});
        }
      } catch (_) {}

      return true;
    } catch (e: any) {
      console.error("deleteReminderLead exception:", e);
      throw e;
    }
  },

  recordClientReminderSent: async (clientId: string, monthId?: string) => {
    try {
      const nowIso = new Date().toISOString();
      Object.keys(globalTableCaches).forEach(key => {
        if (key.startsWith('billing_months')) {
          const months = globalTableCaches[key];
          if (Array.isArray(months)) {
            months.forEach((m: any) => {
              if (Array.isArray(m.rows)) {
                m.rows.forEach((r: any) => {
                  if (r.clientId === clientId || r.id === clientId || r.username === clientId) {
                    r.reminderSentCount = (Number(r.reminderSentCount || 0)) + 1;
                    r.reminderSentAt = nowIso;
                  }
                });
              }
            });
          }
        }
      });
      if (supabase) {
        try {
          let query = supabase.from('billing_rows').select('id, reminder_sent_count');
          if (monthId) query = query.eq('month_id', monthId);
          query = query.or(`client_id.eq.${clientId},client_username.eq.${clientId}`);
          const { data: rows } = await query;

          if (rows && rows.length > 0) {
            for (const r of rows) {
              await supabase
                .from('billing_rows')
                .update({
                  reminder_sent_count: (Number(r.reminder_sent_count || 0)) + 1,
                  reminder_sent_at: nowIso,
                  updated_at: nowIso
                })
                .eq('id', r.id);
            }
          }

          if (monthId) {
            const { data: bMonth } = await supabase
              .from('billing_months')
              .select('id, rows')
              .eq('id', monthId)
              .single();

            if (bMonth && Array.isArray(bMonth.rows)) {
              let changed = false;
              const updatedRows = bMonth.rows.map((r: any) => {
                if (r.clientId === clientId || r.id === clientId || r.username === clientId) {
                  changed = true;
                  return {
                    ...r,
                    reminderSentCount: (Number(r.reminderSentCount || 0)) + 1,
                    reminderSentAt: nowIso
                  };
                }
                return r;
              });
              if (changed) {
                await supabase
                  .from('billing_months')
                  .update({ rows: updatedRows, updated_at: nowIso })
                  .eq('id', monthId);
              }
            }
          }
        } catch (dbErr) {}
      }
    } catch (e) {
      console.warn("recordClientReminderSent error:", e);
    }
  }
};

export const pocketbaseService = supabaseService;
export const dbService = supabaseService;
export const getBillingMonthsHistory = (monthId: string, dealerId: string = 'main', bypassLineCodeFilter: boolean | string = false) => {
  return supabaseService.getBillingMonthsHistory(monthId, dealerId, bypassLineCodeFilter);
};
export const getBillingMonthsList = (dealerId: string = 'main', bypassLineCodeFilter: boolean | string = false) => {
  return supabaseService.getBillingMonthsList(dealerId, bypassLineCodeFilter);
};
export const markAllNotificationsRead = (dealerId?: string) => {
  return supabaseService.markAllNotificationsRead(dealerId);
};
export const markNotificationRead = (id: string, dealerId?: string) => {
  return supabaseService.markNotificationRead(id, dealerId);
};
export const getLedgerSheetsForFolder = (folderId: string, tenantId: string = 'main') => {
  return supabaseService.getLedgerSheetsForFolder(folderId, tenantId);
};
export const getLedgerSheetDirect = (sheetId: string) => {
  return supabaseService.getLedgerSheetDirect(sheetId);
};
export const createReminderLead = (data: any) => {
  return supabaseService.createReminderLead(data);
};
export const getReminderLeads = (dealerId?: string) => {
  return supabaseService.getReminderLeads(dealerId);
};
export const subscribeReminderLeads = (callback: (leads: ReminderLead[]) => void, dealerId?: string) => {
  return supabaseService.subscribeReminderLeads(callback, dealerId);
};
export const getReminderLeadItems = (leadId: string) => {
  return supabaseService.getReminderLeadItems(leadId);
};
export const subscribeReminderLeadItems = (leadId: string, callback: (items: ReminderLeadItem[]) => void) => {
  return supabaseService.subscribeReminderLeadItems(leadId, callback);
};
export const updateReminderLeadItem = (itemId: string, patch: any) => {
  return supabaseService.updateReminderLeadItem(itemId, patch);
};
export const updateReminderLead = (leadId: string, patch: any) => {
  return supabaseService.updateReminderLead(leadId, patch);
};
export const deleteReminderLead = (leadId: string) => {
  return supabaseService.deleteReminderLead(leadId);
};
export const recordClientReminderSent = (clientId: string, monthId?: string) => {
  return supabaseService.recordClientReminderSent(clientId, monthId);
};
export const updateClientFee = async (clientId: string, newFee: number): Promise<void> => {
  if (!clientId) return;
  await upsertSupabase('clients', 'id', clientId, { base_amount: newFee }, true);
};