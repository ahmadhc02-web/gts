import { supabase } from '../../supabaseClient';
import { auth, getDb } from './firebase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification as AppNotification, ChatGroup, BrandingConfig, MonitorTarget, ComplaintReview } from '../types';
import { safeStringify } from './utils';
import { toast } from 'sonner';

// Unified snake_case/camelCase mappings for GTS ISP schema tables
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
    createdAt: 'created_at'
  },
  branding_config: {
    id: 'id',
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

  // Handle special packaging of unstructured attributes inside mascot_pos for branding_config
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
    // Copy over other unmapped keys as fallback
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
  // Copy original DB attributes first
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val;
  }
  // Translate snake_case properties to expected camelCase react keys
  for (const [clientKey, dbKey] of Object.entries(tableMapping)) {
    if (obj[dbKey] !== undefined && obj[dbKey] !== null) {
      result[clientKey] = obj[dbKey];
    }
  }

  // Handle parse of reviews for complaints table
  if (table === 'complaints') {
    if (obj.customer_review) {
      const cr = obj.customer_review.trim();
      if (cr.startsWith('[')) {
        try {
          result.reviews = JSON.parse(cr);
        } catch (e) {
          result.reviews = [{
            id: 'legacy-err',
            text: obj.customer_review,
            createdAt: obj.created_at || Date.now()
          }];
        }
      } else {
        result.reviews = [{
          id: 'legacy-1',
          text: obj.customer_review,
          createdAt: obj.created_at || Date.now()
        }];
      }
    } else {
      result.reviews = [];
    }
  }

  // Handle unpack of unstructured attributes from mascot_pos for branding_config
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

// Global subscription query listener with instant cache-first fallback for premium panel speed
function subscribeTable(
  tableName: string,
  queryBuilder: (query: any) => any,
  callback: (data: any[]) => void,
  mapRow: (row: any) => any = (row) => row,
  dealerId?: string
) {
  const cacheKey = `gts_cache_v3_${tableName}`;
  
  // Try to deliver cached data immediately & synchronously to avoid loading screens completely
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed);
      }
    }
  } catch (e) {
    console.warn(`[Cache] Synchronous load failed for ${tableName}:`, e);
  }

  const fetchAndCallback = async () => {
    try {
      let q = supabase.from(tableName).select('*');
      q = queryBuilder(q);
      const { data, error } = await q;
      if (error) {
        console.warn(`Error loading table ${tableName} from Supabase:`, error);
        
        const isTableMissing = error.message?.includes('relation') && error.message?.includes('does not exist');
        const lastAlertTime = (window as any)[`gts_alert_time_${tableName}`] || 0;
        const now = Date.now();
        if (now - lastAlertTime > 20000) { // Throttled to 20 seconds to prevent alert storms
          (window as any)[`gts_alert_time_${tableName}`] = now;
          if (isTableMissing) {
            toast.error(`Database table "${tableName}" does not exist. Please go to Admin Panel -> Settings -> Database Setup & Connection to run the SQL migration and provision your database tables!`, {
              id: `missing-table-${tableName}`,
              duration: 8000
            });
          } else {
            toast.error(`Error syncing table "${tableName}": ${error.message || 'Connection offline'}`, {
              id: `sync-error-${tableName}`,
              duration: 4000
            });
          }
        }
        return;
      }
      const mapped = (data || []).map(mapRow);
      
      // Update our high-speed local cache with fresh data
      try {
        localStorage.setItem(cacheKey, JSON.stringify(mapped));
      } catch (e) {
        console.warn(`[Cache] Failed updating cache for ${tableName}:`, e);
      }

      callback(mapped);
    } catch (err) {
      console.warn(`Exception loading table ${tableName} from Supabase:`, err);
    }
  };

  fetchAndCallback();

  const localEventName = `gts-table-updated-${tableName}`;
  const handleLocalUpdate = () => {
    fetchAndCallback();
  };
  window.addEventListener(localEventName, handleLocalUpdate);

  const channelId = `realtime_${tableName}_${Math.random().toString(36).substr(2, 6)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
      fetchAndCallback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    window.removeEventListener(localEventName, handleLocalUpdate);
  };
}

// Utility to remove undefined keys
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

export const firebaseService = {
  testConnection: async () => {
    try {
      const { data, error } = await supabase.from('complaints').select('id').limit(1);
      if (error) throw error;
      console.log('Supabase API client connected and verified successfully');
    } catch (error) {
      console.warn("Supabase handshake failed or restricted:", error);
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
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      });
      if (auth.currentUser) {
        unsubscribe();
        resolve(auth.currentUser);
      }
    });
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

  // --- Users ---
  getUsers: async (dealerId?: string): Promise<UserProfile[]> => {
    try {
      let q = supabase.from('users').select('*');
      if (dealerId && dealerId !== 'all') {
        q = q.eq('dealer_id', dealerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(row => fromDb('users', row));
    } catch (error) {
      console.warn('getUsers error:', error);
      return [];
    }
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
      if (error) throw error;
      return data ? fromDb('users', data) : null;
    } catch (error) {
      console.warn('getUser error:', error);
      return null;
    }
  },

  getNetworkOwnerByLineCode: async (lineCode: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('line_code', lineCode).maybeSingle();
      if (error) throw error;
      return data ? fromDb('users', data) : null;
    } catch (error) {
      console.error('getNetworkOwnerByLineCode error:', error);
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
      const { error } = await supabase.from('users').upsert(dbRow);
      if (error) throw error;
      
      if (authorName) {
        await firebaseService.createNotification({
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
      console.error('createUser error:', error);
      throw error;
    }
  },

  updateUserStatus: async (uid: string, status: UserProfile['status'], authorName: string) => {
    try {
      const { error } = await supabase.from('users').update({ status }).eq('uid', uid);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'user_updated',
        message: `Identity status updated to ${status?.toUpperCase()} for UID: ${uid}`,
        authorName
      });
    } catch (error) {
      console.error('updateUserStatus error:', error);
    }
  },

  deleteUser: async (uid: string, username: string, authorName: string) => {
    try {
      // Save user to Recycle Bin first before deleting
      try {
        await firebaseService.saveToRecycleBin('users', uid, authorName);
      } catch (err) {
        console.error("Error saving user to recycle bin:", err);
      }

      const user = await firebaseService.getUser(uid);
      if (user && user.role === 'dealer') {
        const dealerId = uid;
        const tablesToDelete = ['users', 'complaints', 'clients', 'chat_groups', 'chat_messages', 'notifications'];
        for (const tbl of tablesToDelete) {
          await supabase.from(tbl).delete().eq('dealer_id', dealerId);
        }
      }
      
      const { error } = await supabase.from('users').delete().eq('uid', uid);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'user_deleted',
        message: `Identity revoked: Access node for "${username}" purged`,
        authorName
      });
    } catch (error) {
      console.error('deleteUser error:', error);
    }
  },

  updateUserPassword: async (uid: string, username: string, newPass: string, authorName: string) => {
    try {
      const { error } = await supabase.from('users').update({ password: newPass }).eq('uid', uid);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'user_updated',
        message: `Security credentials updated for user: ${username}`,
        authorName
      });
    } catch (error) {
      console.error('updateUserPassword error:', error);
    }
  },

  updateUser: async (uid: string, data: Partial<UserProfile>, authorName: string) => {
    try {
      const dbRow = toDb('users', { ...data, uid });
      const { error } = await supabase.from('users').update(dbRow).eq('uid', uid);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'user_created',
        message: `User Profile updated: ${data.username || uid}`,
        authorName
      });
    } catch (error) {
      console.error('updateUser error:', error);
    }
  },

  updateUserPresence: async (uid: string) => {
    try {
      if (!auth.currentUser) return;
      await supabase.from('users').update({ last_active: Date.now() }).eq('uid', uid);
    } catch (error) {
      // quiet
    }
  },

  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      const { data, error } = await supabase
        .from('branding_config')
        .select('*')
        .eq('id', docId)
        .maybeSingle();
      
      let currentConfig: any = null;
      if (!error && data && data.dashboard_subtext) {
        try {
          currentConfig = JSON.parse(data.dashboard_subtext);
        } catch (e) {
          console.error("Failed to parse app config json:", e);
        }
      }

      if (!currentConfig) {
        currentConfig = {};
      }

      const zoneKey = tenantId === 'main' ? 'zone' : `zone_${tenantId}`;
      const categoryKey = tenantId === 'main' ? 'category' : `category_${tenantId}`;
      const priorityKey = tenantId === 'main' ? 'priority' : `priority_${tenantId}`;

      // Fetch dynamic dropdown filters from 'branding_config' table using custom row queries:
      const [zonesRes, categoriesRes, prioritiesRes] = await Promise.all([
        supabase.from('branding_config').select('item_value').eq('config_type', zoneKey),
        supabase.from('branding_config').select('item_value').eq('config_type', categoryKey),
        supabase.from('branding_config').select('item_value').eq('config_type', priorityKey)
      ]);

      const dbZones = (zonesRes.data || [])
        .map(r => r.item_value)
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      
      const dbCategories = (categoriesRes.data || [])
        .map(r => r.item_value)
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

      const dbPriorities = (prioritiesRes.data || [])
        .map(r => r.item_value)
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

      if (dbZones && dbZones.length > 0) {
        currentConfig.zones = dbZones;
      }
      if (dbCategories && dbCategories.length > 0) {
        currentConfig.categories = dbCategories;
      }
      if (dbPriorities && dbPriorities.length > 0) {
        currentConfig.priorities = dbPriorities;
      }

      return currentConfig;
    } catch (e) {
      console.error("getAppConfig error:", e);
      return null;
    }
  },

  setTypingStatus: async (uid: string, username: string, isTyping: boolean, fullName?: string) => {
    try {
      const channel = supabase.channel('typing_broadcast');
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { uid, username, fullName, isTyping, timestamp: Date.now() }
          });
          supabase.removeChannel(channel);
        }
      });
    } catch (e) {}
  },

  subscribeTypingStatus: (callback: (typingUsers: { uid: string, username: string, fullName?: string }[]) => void) => {
    const localTypingMap = new Map<string, { uid: string, username: string, fullName?: string, timestamp: number }>();
    
    const channel = supabase.channel('typing_broadcast');
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload && payload.uid) {
          if (payload.isTyping) {
            localTypingMap.set(payload.uid, {
              uid: payload.uid,
              username: payload.username,
              fullName: payload.fullName,
              timestamp: payload.timestamp
            });
          } else {
            localTypingMap.delete(payload.uid);
          }
          
          const now = Date.now();
          const list = Array.from(localTypingMap.values())
            .filter(t => now - t.timestamp < 10000)
            .map(t => ({ uid: t.uid, username: t.username, fullName: t.fullName }));
          
          callback(list);
        }
      })
      .subscribe();

    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [key, val] of localTypingMap.entries()) {
        if (now - val.timestamp >= 10000) {
          localTypingMap.delete(key);
          changed = true;
        }
      }
      if (changed) {
        const list = Array.from(localTypingMap.values())
          .map(t => ({ uid: t.uid, username: t.username, fullName: t.fullName }));
        callback(list);
      }
    }, 2000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  },

  subscribeUsers: (callback: (users: UserProfile[]) => void, dealerId?: string) => {
    return subscribeTable(
      'users',
      (q) => {
        if (dealerId && dealerId !== 'all') {
          return q.eq('dealer_id', dealerId);
        }
        return q;
      },
      callback,
      (row) => fromDb('users', row),
      dealerId
    );
  },

  // --- Notifications ---
  createNotification: async (data: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> => {
    const id = `notif_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const cleanData = sanitize(data);
    
    const clientNotification: AppNotification = {
      ...cleanData,
      id,
      createdAt: Date.now(),
      isRead: false,
      dealerId: data.dealerId || 'main'
    };
    
    try {
      const dbRow = toDb('notifications', clientNotification);
      const { error } = await supabase.from('notifications').insert(dbRow);
      if (error) throw error;
      return clientNotification;
    } catch (error) {
      console.error('createNotification error:', error);
      throw error;
    }
  },

  clearAllNotifications: async (dealerId?: string) => {
    try {
      if (dealerId) {
        await supabase.from('notifications').delete().eq('dealer_id', dealerId);
      } else {
        await supabase.from('notifications').delete().not('id', 'is', null);
      }
    } catch (error) {
      console.error('clearAllNotifications error:', error);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
    } catch (error) {
      console.error('deleteNotification error:', error);
    }
  },

  subscribeNotifications: (callback: (notifications: AppNotification[]) => void, dealerId?: string) => {
    return subscribeTable(
      'notifications',
      (q) => q,
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
      let q = supabase.from('complaints').select('*');
      if (dealerId && dealerId !== 'all') {
        q = q.eq('dealer_id', dealerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(row => fromDb('complaints', row)).sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('getComplaints error:', error);
      return [];
    }
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    const id = `comp_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = firebaseService.getTenantId(member);
    
    const clientComplaint: Complaint = {
      ...data,
      id,
      memberId: member.uid,
      memberName: member.fullName || member.username,
      createdAt: Date.now(),
      dealerId: tenantId
    };

    try {
      const dbRow = toDb('complaints', clientComplaint);
      const { error } = await supabase.from('complaints').insert(dbRow);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'complaint_created',
        message: `New registry: ${clientComplaint.customerName} - ${clientComplaint.category}`,
        authorName: member.fullName || member.username,
        details: clientComplaint,
        dealerId: tenantId || undefined
      });
      return clientComplaint;
    } catch (error) {
      console.error('createComplaint error:', error);
      throw error;
    }
  },

  deleteComplaint: async (id: string, customerName: string, authorName: string) => {
    try {
      // Save to Recycle Bin first
      try {
        await firebaseService.saveToRecycleBin('complaints', id, authorName);
      } catch (err) {
        console.error("Error saving complaint to recycle bin:", err);
      }

      const { error } = await supabase.from('complaints').delete().eq('id', id);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'complaint_deleted',
        message: `Registry removed: "${customerName}" protocol terminated`,
        authorName
      });
    } catch (error) {
      console.error('deleteComplaint error:', error);
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
      const { error } = await supabase.from('complaints').update(dbRow).eq('id', id);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Status updated to ${status.toUpperCase()} for "${customerName}"${remarks ? ` - Remarks: ${remarks}` : ''}${reviews && reviews.length > 0 ? ` - Reviews count: ${reviews.length}` : ''}`,
        authorName
      });
    } catch (error) {
      console.error('updateComplaintStatus error:', error);
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
      const { error } = await supabase.from('complaints').update(dbRow).eq('id', id);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Protocol remarks revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      console.error('updateComplaintRemarks error:', error);
    }
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, customerName: string, authorName: string) => {
    try {
      const dbRow = toDb('complaints', data);
      const { error } = await supabase.from('complaints').update(dbRow).eq('id', id);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Registry modified: Data revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      console.error('updateComplaint error:', error);
    }
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void, dealerId?: string) => {
    return subscribeTable(
      'complaints',
      (q) => {
        if (dealerId && dealerId !== 'all') {
          return q.eq('dealer_id', dealerId);
        }
        return q;
      },
      (complaints) => {
        callback(complaints.sort((a, b) => b.createdAt - a.createdAt));
      },
      (row) => fromDb('complaints', row),
      dealerId
    );
  },

  // --- Config Settings ---
  getSettings: async () => {
    try {
      const data = await firebaseService.getAppConfig();
      return data;
    } catch (error) {
      console.error('getSettings error:', error);
      return null;
    }
  },

  subscribeConfig: (callback: (config: any) => void, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    
    const fetchConfig = async () => {
      try {
        let currentConfig: any = null;
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();
        
        if (!error && data && data.dashboard_subtext) {
          try {
            currentConfig = JSON.parse(data.dashboard_subtext);
          } catch (e) {
            console.error("Failed to parse app config json:", e);
          }
        }
        
        if (!currentConfig) {
          const cached = localStorage.getItem(`gts_config_${tenantId}`);
          if (cached) {
            try {
              currentConfig = JSON.parse(cached);
            } catch (e) {}
          }
        }

        if (!currentConfig) {
          currentConfig = {};
        }

        const zoneKey = tenantId === 'main' ? 'zone' : `zone_${tenantId}`;
        const categoryKey = tenantId === 'main' ? 'category' : `category_${tenantId}`;
        const priorityKey = tenantId === 'main' ? 'priority' : `priority_${tenantId}`;

        // Fetch dynamic dropdown filters from 'branding_config' table using custom row queries:
        const [zonesRes, categoriesRes, prioritiesRes] = await Promise.all([
          supabase.from('branding_config').select('item_value').eq('config_type', zoneKey),
          supabase.from('branding_config').select('item_value').eq('config_type', categoryKey),
          supabase.from('branding_config').select('item_value').eq('config_type', priorityKey)
        ]);

        const dbZones = (zonesRes.data || [])
          .map(r => r.item_value)
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
        
        const dbCategories = (categoriesRes.data || [])
          .map(r => r.item_value)
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

        const dbPriorities = (prioritiesRes.data || [])
          .map(r => r.item_value)
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

        if (dbZones && dbZones.length > 0) {
          currentConfig.zones = dbZones;
        }
        if (dbCategories && dbCategories.length > 0) {
          currentConfig.categories = dbCategories;
        }
        if (dbPriorities && dbPriorities.length > 0) {
          currentConfig.priorities = dbPriorities;
        }

        callback(currentConfig);
      } catch (e) {
        console.error("Failed to fetch app config:", e);
        callback(null);
      }
    };

    fetchConfig();

    const configChannelId = `config_realtime_${tenantId}_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(configChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => {
        fetchConfig();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateConfig: async (config: any, authorName: string, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      const cleanConfig = sanitize(config);
      localStorage.setItem(`gts_config_${tenantId}`, JSON.stringify(cleanConfig));
      
      const payload = {
        id: docId,
        dashboard_subtext: JSON.stringify(cleanConfig),
        updated_at: Date.now(),
        updated_by: authorName
      };
      
      await supabase.from('branding_config').upsert(payload);

      const zoneKey = tenantId === 'main' ? 'zone' : `zone_${tenantId}`;
      const categoryKey = tenantId === 'main' ? 'category' : `category_${tenantId}`;
      const priorityKey = tenantId === 'main' ? 'priority' : `priority_${tenantId}`;

      // 1. Sync zones
      if (Array.isArray(cleanConfig.zones)) {
        await supabase.from('branding_config').delete().eq('config_type', zoneKey);
        if (cleanConfig.zones.length > 0) {
          const insertZones = cleanConfig.zones.map((z: string) => ({
            id: `zone_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
            config_type: zoneKey,
            item_value: z,
            updated_at: Date.now(),
            updated_by: authorName
          }));
          await supabase.from('branding_config').insert(insertZones);
        }
      }

      // 2. Sync categories
      if (Array.isArray(cleanConfig.categories)) {
        await supabase.from('branding_config').delete().eq('config_type', categoryKey);
        if (cleanConfig.categories.length > 0) {
          const insertCategories = cleanConfig.categories.map((c: string) => ({
            id: `cat_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
            config_type: categoryKey,
            item_value: c,
            updated_at: Date.now(),
            updated_by: authorName
          }));
          await supabase.from('branding_config').insert(insertCategories);
        }
      }

      // 3. Sync priorities
      if (Array.isArray(cleanConfig.priorities)) {
        await supabase.from('branding_config').delete().eq('config_type', priorityKey);
        if (cleanConfig.priorities.length > 0) {
          const insertPriorities = cleanConfig.priorities.map((p: string) => ({
            id: `pri_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
            config_type: priorityKey,
            item_value: p,
            updated_at: Date.now(),
            updated_by: authorName
          }));
          await supabase.from('branding_config').insert(insertPriorities);
        }
      }
      
      await firebaseService.createNotification({
        type: 'config_updated',
        message: `System matrix configuration updated`,
        authorName,
        dealerId: tenantId === 'main' ? undefined : tenantId
      });
    } catch (error) {
      console.error("updateConfig error:", error);
    }
  },

  // --- Branding ---
  subscribeBranding: (callback: (branding: BrandingConfig | null) => void) => {
    const fetchBranding = async () => {
      try {
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', 'branding')
          .maybeSingle();
        if (!error && data) {
          callback(fromDb('branding_config', data));
        } else {
          callback(null);
        }
      } catch (e) {
        console.error("Branding fetch failed:", e);
        callback(null);
      }
    };

    fetchBranding();

    const brandingChannelId = `branding_config_realtime_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(brandingChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config', filter: 'id=eq.branding' }, () => {
        fetchBranding();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateBranding: async (branding: BrandingConfig, authorName: string) => {
    try {
      const dbRow = toDb('branding_config', { ...branding, id: 'branding' });
      const { error } = await supabase.from('branding_config').upsert(dbRow);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'config_updated',
        message: `Global UI Branding configuration updated`,
        authorName
      });
    } catch (error) {
      console.error("updateBranding error:", error);
    }
  },

  // --- Chat ---
  sendMessage: async (sender: UserProfile, text: string, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const tenantId = firebaseService.getTenantId(sender);
    const newMessage: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text,
      createdAt: Date.now(),
      seenBy: {
        [sender.uid]: { username: sender.fullName || sender.username, time: Date.now() }
      },
      replyTo,
      recipientId,
      isGroup,
      dealerId: tenantId
    };

    try {
      const dbRow = toDb('chat_messages', newMessage);
      const { error } = await supabase.from('chat_messages').insert(dbRow);
      if (error) throw error;
      return newMessage;
    } catch (error) {
      console.error('sendMessage error:', error);
      throw error;
    }
  },

  sendVoiceMessage: async (sender: UserProfile, audioBase64: string, duration: number, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const tenantId = firebaseService.getTenantId(sender);
    const newMessage: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      audioUrl: audioBase64,
      type: 'voice',
      duration,
      createdAt: Date.now(),
      seenBy: {
        [sender.uid]: { username: sender.fullName || sender.username, time: Date.now() }
      },
      replyTo,
      recipientId,
      isGroup,
      dealerId: tenantId
    };

    try {
      const dbRow = toDb('chat_messages', newMessage);
      const { error } = await supabase.from('chat_messages').insert(dbRow);
      if (error) throw error;
      return newMessage;
    } catch (error) {
      console.error('sendVoiceMessage error:', error);
      throw error;
    }
  },

  createGroup: async (name: string, members: string[], creator: UserProfile): Promise<ChatGroup> => {
    const id = `group_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = firebaseService.getTenantId(creator);
    const newGroup: ChatGroup = {
      id,
      name,
      members: Array.from(new Set([...members, creator.uid])),
      createdBy: creator.uid,
      createdAt: Date.now(),
      dealerId: tenantId
    };

    try {
      const dbRow = toDb('chat_groups', newGroup);
      const { error } = await supabase.from('chat_groups').insert(dbRow);
      if (error) throw error;
      return newGroup;
    } catch (error) {
      console.error('createGroup error:', error);
      throw error;
    }
  },

  subscribeGroups: (callback: (groups: ChatGroup[]) => void, userId: string, dealerId?: string) => {
    return subscribeTable(
      'chat_groups',
      (q) => q,
      (groups) => {
        let filtered = groups.filter(g => g.members && Array.isArray(g.members) && g.members.includes(userId));
        if (dealerId) {
          if (dealerId === 'main') {
            filtered = filtered.filter(g => !g.dealerId || g.dealerId === 'main');
          } else {
            filtered = filtered.filter(g => g.dealerId === dealerId);
          }
        }
        callback(filtered);
      },
      (row) => fromDb('chat_groups', row),
      dealerId
    );
  },

  markAsSeen: async (messageId: string, uid: string, name: string) => {
    try {
      const { data } = await supabase.from('chat_messages').select('seen_by').eq('id', messageId).maybeSingle();
      const currentSeen = data?.seen_by || {};
      const updatedSeen = {
        ...currentSeen,
        [uid]: { username: name, time: Date.now() }
      };
      await supabase.from('chat_messages').update({ seen_by: updatedSeen }).eq('id', messageId);
    } catch (e) {
      console.error('markAsSeen error:', e);
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      await supabase.from('chat_messages').delete().eq('id', messageId);
    } catch (error) {
      console.error("deleteMessage error:", error);
    }
  },

  clearAllMessages: async (dealerId?: string) => {
    try {
      if (dealerId) {
        await supabase.from('chat_messages').delete().eq('dealer_id', dealerId);
      } else {
        await supabase.from('chat_messages').delete().not('id', 'is', null);
      }
    } catch (error) {
      console.error("clearAllMessages failed:", error);
    }
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    try {
      await supabase.from('chat_groups').delete().eq('id', groupId);
    } catch (error) {
      console.error("deleteGroup error:", error);
    }
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    try {
      if (isGroup) {
        await supabase.from('chat_messages').delete().eq('is_group', true).eq('recipient_id', scopeId);
      } else {
        await supabase.from('chat_messages').delete().eq('is_group', false).eq('sender_id', userId).eq('recipient_id', scopeId);
        await supabase.from('chat_messages').delete().eq('is_group', false).eq('sender_id', scopeId).eq('recipient_id', userId);
      }
    } catch (error) {
      console.error("clearMessagesByScope error:", error);
    }
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void, dealerId?: string) => {
    return subscribeTable(
      'chat_messages',
      (q) => {
        if (dealerId && dealerId !== 'all') {
          return q.eq('dealer_id', dealerId);
        }
        return q;
      },
      (messages) => {
        callback(messages.sort((a, b) => a.createdAt - b.createdAt));
      },
      (row) => fromDb('chat_messages', row),
      dealerId
    );
  },

  // --- Clients ---
  getClients: async (dealerId?: string): Promise<Client[]> => {
    try {
      let q = supabase.from('clients').select('*');
      if (dealerId && dealerId !== 'all') {
        q = q.eq('dealer_id', dealerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(row => fromDb('clients', row)).sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('getClients error:', error);
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main'): Promise<Client> => {
    const id = `client_${Math.random().toString(36).substr(2, 9)}`;
    const newClient: Client = {
      ...data,
      id,
      createdAt: Date.now(),
      dealerId
    };
    try {
      const dbRow = toDb('clients', newClient);
      const { error } = await supabase.from('clients').insert(dbRow);
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('gts-table-updated-clients'));

      await firebaseService.createNotification({
        type: 'client_added',
        message: `New client added to registry: ${newClient.name}`,
        authorName,
        details: newClient,
        dealerId
      });
      return newClient;
    } catch (error) {
      console.error('createClient error:', error);
      throw error;
    }
  },

  updateClient: async (id: string, data: Partial<Client>, clientName: string, authorName: string) => {
    try {
      const dbRow = toDb('clients', data);
      const { error } = await supabase.from('clients').update(dbRow).eq('id', id);
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('gts-table-updated-clients'));

      await firebaseService.createNotification({
        type: 'client_updated',
        message: `Client record modified: Updated info for "${clientName}"`,
        authorName
      });
    } catch (error) {
      console.error('updateClient error:', error);
    }
  },

  updateClientComplaints: async (originalUsername: string, updatedData: { name: string; username: string; number: string; mobileNumber: string; pkgDetails: string; userNearby: string; panelDetails: string; area: string }) => {
    try {
      const payload = {
        customer_name: updatedData.name,
        customer_username: updatedData.username,
        phone_number: updatedData.mobileNumber || updatedData.number || '',
        pkg_details: updatedData.pkgDetails || '',
        user_nearby: updatedData.userNearby || '',
        panel_details: updatedData.panelDetails || '',
        area: updatedData.area || ''
      };
      await supabase.from('complaints').update(payload).eq('customer_username', originalUsername);
      window.dispatchEvent(new CustomEvent('gts-table-updated-complaints'));
    } catch (error) {
      console.error("updateClientComplaints error:", error);
    }
  },

  deleteClient: async (id: string, clientName: string, authorName: string) => {
    try {
      // Fetch associated users_data rows before they are deleted, to pass to saveToRecycleBin as extraData
      let uRows: any[] = [];
      try {
        const { data: clientData } = await supabase.from('clients').select('username, name').eq('id', id).maybeSingle();
        if (clientData) {
          const clientUsername = clientData.username;
          const clientRealName = clientData.name;
          let q = supabase.from('users_data').select('*');
          if (id) {
            q = q.eq('client_id', id);
          } else if (clientUsername) {
            q = q.eq('username', clientUsername);
          } else {
            q = q.eq('name', clientRealName);
          }
          const { data: uData } = await q;
          if (uData) uRows = uData;
        }
      } catch (err) {
        console.error("Error fetching users_data for recycle bin:", err);
      }

      // Save to Recycle Bin first with uRows as extraData
      try {
        await firebaseService.saveToRecycleBin('clients', id, authorName, undefined, uRows);
      } catch (err) {
        console.error("Error saving client to recycle bin:", err);
      }

      // 1. Fetch info about the client before deleting, so we can clean up backups/billings
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const clientUsername = clientData ? clientData.username : null;
      const clientRealName = clientData ? clientData.name : clientName;

      // Delete the client row
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      
      // 2. Remove billing list/rows matching this client from users_data database
      try {
        let q = supabase.from('users_data').delete();
        if (id) {
          q = q.eq('client_id', id);
        } else if (clientUsername) {
          q = q.eq('username', clientUsername);
        } else {
          q = q.eq('name', clientRealName);
        }
        await q;
      } catch (usersDataErr) {
        console.error("Failed to delete matching user rows from users_data table:", usersDataErr);
      }

      // 3. Keep branding_config (billing monthly sheets stored as lists) in sync
      try {
        const { data: billingDocs, error: billingError } = await supabase
          .from('branding_config')
          .select('*')
          .like('id', 'billing_month_%');

        if (!billingError && billingDocs) {
          for (const doc of billingDocs) {
            try {
              let rows = doc.dashboard_subtext;
              if (typeof rows === 'string') {
                rows = JSON.parse(rows);
              }
              if (Array.isArray(rows)) {
                const initialLength = rows.length;
                const filteredRows = rows.filter((r: any) => {
                  const isMatchById = id && r.clientId === id;
                  const isMatchByUsername = clientUsername && r.username && String(r.username).toLowerCase() === String(clientUsername).toLowerCase();
                  const isMatchByName = clientRealName && r.name && String(r.name).toLowerCase() === String(clientRealName).toLowerCase();
                  return !(isMatchById || isMatchByUsername || isMatchByName);
                });

                if (filteredRows.length < initialLength) {
                  await supabase
                    .from('branding_config')
                    .update({ 
                      dashboard_subtext: JSON.stringify(filteredRows),
                      updated_at: Date.now(),
                      updated_by: authorName || 'admin'
                    })
                    .eq('id', doc.id);
                }
              }
            } catch (jsonErr) {
              console.error(`Error parsing rows for billing month doc ${doc.id}:`, jsonErr);
            }
          }
        }
      } catch (billingSyncError) {
        console.error("Failed to sync branding_config billing months:", billingSyncError);
      }

      // 4. Update table1_rows and table2_rows inside ledger_sheets to purge references
      try {
        const { data: sheets, error: sheetsError } = await supabase
          .from('ledger_sheets')
          .select('*');

        if (!sheetsError && sheets) {
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
              table1 = table1.filter((r: any) => {
                const isMatchById = id && r.clientId === id;
                const isMatchByUsername = clientUsername && r.clientUsername && String(r.clientUsername).toLowerCase() === String(clientUsername).toLowerCase();
                const isMatchByName = clientRealName && r.name && String(r.name).toLowerCase() === String(clientRealName).toLowerCase();
                return !(isMatchById || isMatchByUsername || isMatchByName);
              });
              if (table1.length < initialLen) {
                updated = true;
              }
            }

            if (Array.isArray(table2)) {
              const initialLen = table2.length;
              table2 = table2.filter((r: any) => {
                const isMatchById = id && r.clientId === id;
                const isMatchByUsername = clientUsername && r.clientUsername && String(r.clientUsername).toLowerCase() === String(clientUsername).toLowerCase();
                const isMatchByName = clientRealName && r.name && String(r.name).toLowerCase() === String(clientRealName).toLowerCase();
                return !(isMatchById || isMatchByUsername || isMatchByName);
              });
              if (table2.length < initialLen) {
                updated = true;
              }
            }

            if (updated) {
              await supabase
                .from('ledger_sheets')
                .update({
                  table1_rows: JSON.stringify(table1),
                  table2_rows: JSON.stringify(table2)
                })
                .eq('id', sh.id);
            }
          }
        }
      } catch (sheetsSyncError) {
        console.error("Failed to sync structural ledger_sheets rows:", sheetsSyncError);
      }

      await firebaseService.createNotification({
        type: 'client_deleted',
        message: `Client record removed: "${clientRealName}" purged from database and billing databases completely`,
        authorName
      });
    } catch (error) {
      console.error('deleteClient error:', error);
    }
  },

  subscribeClients: (callback: (clients: Client[]) => void, dealerId?: string) => {
    return subscribeTable(
      'clients',
      (q) => {
        if (dealerId && dealerId !== 'all') {
          return q.eq('dealer_id', dealerId);
        }
        return q;
      },
      (clients) => {
        callback(clients.sort((a, b) => b.createdAt - a.createdAt));
      },
      (row) => fromDb('clients', row),
      dealerId
    );
  },

  // --- Service Monitor ---
  createMonitorTarget: async (domain: string, creator: UserProfile, label?: string, lat?: number, lng?: number): Promise<MonitorTarget> => {
    const id = `target_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = firebaseService.getTenantId(creator);
    const newTarget: MonitorTarget = {
      id,
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
      const { error } = await supabase.from('monitor_targets').insert(dbRow);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent('gts-table-updated-monitor_targets'));
      return newTarget;
    } catch (error) {
      console.error('createMonitorTarget error:', error);
      throw error;
    }
  },

  deleteMonitorTarget: async (id: string): Promise<void> => {
    try {
      // Save monitor target to Recycle Bin first
      try {
        await firebaseService.saveToRecycleBin('monitor_targets', id, 'admin');
      } catch (err) {
        console.error("Error saving monitor target to recycle bin:", err);
      }

      await supabase.from('monitor_targets').delete().eq('id', id);
      window.dispatchEvent(new CustomEvent('gts-table-updated-monitor_targets'));
    } catch (error) {
      console.error('deleteMonitorTarget error:', error);
    }
  },

  updateMonitorTarget: async (id: string, updates: Partial<MonitorTarget>): Promise<void> => {
    try {
      const dbRow = toDb('monitor_targets', updates);
      await supabase.from('monitor_targets').update(dbRow).eq('id', id);
      window.dispatchEvent(new CustomEvent('gts-table-updated-monitor_targets'));
    } catch (error) {
      console.error('updateMonitorTarget error:', error);
    }
  },

  subscribeMonitorTargets: (callback: (targets: MonitorTarget[]) => void, dealerId?: string) => {
    return subscribeTable(
      'monitor_targets',
      (q) => q,
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

  // --- Local system backup / restore --
  getFullSystemBackup: async (exportedBy: string): Promise<any> => {
    try {
      const usersSnap = await supabase.from('users').select('*');
      const complaintsSnap = await supabase.from('complaints').select('*');
      const clientsSnap = await supabase.from('clients').select('*');
      const notificationsSnap = await supabase.from('notifications').select('*');
      
      const resUsers = (usersSnap.data || []).map(r => fromDb('users', r));
      const resComplaints = (complaintsSnap.data || []).map(r => fromDb('complaints', r));
      const resClients = (clientsSnap.data || []).map(r => fromDb('clients', r));
      const resNotifications = (notificationsSnap.data || []).map(r => fromDb('notifications', r));

      return {
        version: "2.0-full",
        exportedAt: new Date().toISOString(),
        metadata: {
          system: "GreenTech Premium Wifi Complain Management",
          exportedBy: exportedBy || "Administrator"
        },
        data: {
          users: resUsers,
          complaints: resComplaints,
          clients: resClients,
          notifications: resNotifications,
          billing: [],
          config: {},
          branding: {}
        }
      };
    } catch (error) {
      console.error("Failed to generate system backup:", error);
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
        await supabase.from('users').upsert(toDb('users', u));
      }
      for (const c of complaints) {
        await supabase.from('complaints').upsert(toDb('complaints', c));
      }
      for (const cl of clients) {
        await supabase.from('clients').upsert(toDb('clients', cl));
      }
      for (const n of notifications) {
        await supabase.from('notifications').upsert(toDb('notifications', n));
      }
    } catch (e) {
      console.error("Failed backup restore:", e);
      throw e;
    }
  },

  // --- Billing Months Methods ---
  subscribeBillingMonths: (callback: (months: any[]) => void, dealerId?: string) => {
    const fetchBillingMonths = async () => {
      try {
        let prefix = 'billing_month_';
        if (dealerId) {
          prefix = `billing_month_${dealerId}_`;
        }

        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .like('id', `${prefix}%`);
        
        if (!error && data) {
          const months = data.map(item => {
            try {
              const parsedRows = JSON.parse(item.dashboard_subtext || '[]');
              
              // If dealerId is NOT passed, filter out dealer-specific billing months
              if (!dealerId) {
                const suffix = item.id.substring('billing_month_'.length);
                if (suffix.includes('_')) {
                  // This is a dealer-specific month, skip for standard view
                  return null;
                }
              }

              const displayId = dealerId 
                ? item.id.replace(`billing_month_${dealerId}_`, '')
                : item.id.replace('billing_month_', '');

              return {
                id: displayId,
                rows: parsedRows,
                createdAt: item.updated_at || Date.now(),
                updatedAt: item.updated_at || Date.now(),
                createdBy: item.updated_by || 'admin',
                updatedBy: item.updated_by || 'admin'
              };
            } catch (e) {
              return null;
            }
          }).filter(m => m !== null);
          callback(months);
        } else {
          callback([]);
        }
      } catch (e) {
        console.error("Failed to fetch billing months:", e);
        callback([]);
      }
    };

    fetchBillingMonths();

    const billingMonthsChannelId = `billing_months_realtime_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(billingMonthsChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, () => {
        fetchBillingMonths();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  createBillingMonth: async (monthId: string, rows: any[], createdBy: string, dealerId?: string) => {
    const docId = dealerId ? `billing_month_${dealerId}_${monthId}` : `billing_month_${monthId}`;
    const payload = {
      id: docId,
      dashboard_subtext: JSON.stringify(rows),
      updated_at: Date.now(),
      updated_by: createdBy
    };
    await supabase.from('branding_config').upsert(payload);

    try {
      const dbRows = rows.map((r, i) => {
        const uniqueId = dealerId 
          ? `bm_${dealerId}_${monthId}_${r.clientId || r.username || i}`
          : `bm_${monthId}_${r.clientId || r.username || i}`;
        return {
          id: uniqueId,
          month_id: monthId,
          client_id: r.clientId || null,
          name: r.name || null,
          username: r.username || null,
          mobile_number: r.mobileNumber || null,
          area: r.area || null,
          rt: r.rt || null,
          base_amount: Number(r.baseAmount) || 0,
          cr: Number(r.cr) || 0,
          total_amount: Number(r.totalAmount) || 0,
          billing_day: r.billingDay || '5',
          payment_received: Number(r.paymentReceived) || 0,
          payment_status: r.paymentStatus || 'unpaid',
          comments: r.comments || null,
          occ: r.occ || null,
          ser_nam: r.serNam || null,
          pkg_details: r.pkgDetails || null,
          sag: r.sag || null,
          lai: r.lai || null,
          connection_date: r.connectionDate || null,
          device_price: r.devicePrice || null,
          abl: r.abl || null,
          network: r.network || null,
          dealer_id: dealerId || 'main',
          updated_at: Date.now()
        };
      });

      for (let index = 0; index < dbRows.length; index += 50) {
        const chunk = dbRows.slice(index, index + 50);
        await supabase.from('users_data').upsert(chunk, { onConflict: 'id' });
      }
    } catch (e) {
      console.error("Failed to sync created billing month rows into users_data:", e);
    }
  },

  saveBillingMonth: async (monthId: string, rows: any[], updatedBy: string, dealerId?: string) => {
    const docId = dealerId ? `billing_month_${dealerId}_${monthId}` : `billing_month_${monthId}`;
    const payload = {
      id: docId,
      dashboard_subtext: JSON.stringify(rows),
      updated_at: Date.now(),
      updated_by: updatedBy
    };
    await supabase.from('branding_config').upsert(payload);

    try {
      const dbRows = rows.map((r, i) => {
        const uniqueId = dealerId 
          ? `bm_${dealerId}_${monthId}_${r.clientId || r.username || i}`
          : `bm_${monthId}_${r.clientId || r.username || i}`;
        return {
          id: uniqueId,
          month_id: monthId,
          client_id: r.clientId || null,
          name: r.name || null,
          username: r.username || null,
          mobile_number: r.mobileNumber || null,
          area: r.area || null,
          rt: r.rt || null,
          base_amount: Number(r.baseAmount) || 0,
          cr: Number(r.cr) || 0,
          total_amount: Number(r.totalAmount) || 0,
          billing_day: r.billingDay || '5',
          payment_received: Number(r.paymentReceived) || 0,
          payment_status: r.paymentStatus || 'unpaid',
          comments: r.comments || null,
          occ: r.occ || null,
          ser_nam: r.serNam || null,
          pkg_details: r.pkgDetails || null,
          sag: r.sag || null,
          lai: r.lai || null,
          connection_date: r.connectionDate || null,
          device_price: r.devicePrice || null,
          abl: r.abl || null,
          network: r.network || null,
          dealer_id: dealerId || 'main',
          updated_at: Date.now()
        };
      });

      for (let index = 0; index < dbRows.length; index += 50) {
        const chunk = dbRows.slice(index, index + 50);
        await supabase.from('users_data').upsert(chunk, { onConflict: 'id' });
      }
    } catch (e) {
      console.error("Failed to sync saved billing month rows into users_data:", e);
    }
  },

  deleteBillingMonth: async (monthId: string, dealerId?: string) => {
    try {
      const docId = dealerId ? `billing_month_${dealerId}_${monthId}` : `billing_month_${monthId}`;
      
      // Fetch users_data rows for this month and dealer before they are deleted
      let uRows: any[] = [];
      try {
        const { data: uData } = await supabase
          .from('users_data')
          .select('*')
          .eq('month_id', monthId)
          .eq('dealer_id', dealerId || 'main');
        if (uData) uRows = uData;
      } catch (err) {
        console.error("Error fetching billing month users_data for recycle bin:", err);
      }

      // Save billing month config to Recycle Bin first, passing uRows as extraData
      try {
        await firebaseService.saveToRecycleBin('branding_config', docId, 'admin', dealerId || 'main', uRows);
      } catch (err) {
        console.error("Error saving billing month to recycle bin:", err);
      }

      await supabase.from('branding_config').delete().eq('id', docId);

      await supabase.from('users_data').delete().eq('month_id', monthId).eq('dealer_id', dealerId || 'main');
    } catch (e) {
      console.error("deleteBillingMonth error:", e);
    }
  },

  // --- Inline Translations ---
  subscribeTranslations: (callback: (translations: Record<string, string> | null) => void) => {
    const fetchTranslations = async () => {
      try {
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', 'translations')
          .maybeSingle();
        
        if (!error && data && data.dashboard_subtext) {
          try {
            callback(JSON.parse(data.dashboard_subtext));
            return;
          } catch (e) {
            console.error("Translations JSON parse failed:", e);
          }
        }
        callback(null);
      } catch (e) {
        callback(null);
      }
    };

    fetchTranslations();

    const translationsChannelId = `translations_realtime_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(translationsChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config', filter: 'id=eq.translations' }, () => {
        fetchTranslations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateTranslations: async (translations: Record<string, string>) => {
    const payload = {
      id: 'translations',
      dashboard_subtext: JSON.stringify(translations),
      updated_at: Date.now()
    };
    await supabase.from('branding_config').upsert(payload);
  },

  // --- Ledger Folders Sync ---
  subscribeLedgerFolders: (callback: (folders: any[]) => void, dealerId?: string) => {
    const docId = dealerId ? `ledger_folders_${dealerId}` : 'ledger_folders_main';
    
    const fetchFolders = async () => {
      try {
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();
        if (error) {
          console.error("Ledger folders fetch error from Supabase:", error);
          return; // Return early, don't execute callback with null/incorrect state
        }
        if (data) {
          if (data.dashboard_subtext) {
            try {
              callback(JSON.parse(data.dashboard_subtext));
            } catch (pErr) {
              console.error("Failed to parse ledger folders JSON:", pErr);
              callback([]);
            }
          } else {
            callback([]);
          }
        } else {
          callback(null as any); // Null indicates completely uninitialized in database (no record)
        }
      } catch (e) {
        console.error("Ledger folders fetch failed:", e);
      }
    };

    fetchFolders();

    const channelId = `ledger_folders_${docId}_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config', filter: `id=eq.${docId}` }, (payload) => {
        if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
          const newData = payload.new as any;
          if (newData.dashboard_subtext) {
            try {
              callback(JSON.parse(newData.dashboard_subtext));
            } catch (pErr) {
              console.error("Failed to parse realtime payload:", pErr);
              fetchFolders();
            }
          } else {
            callback([]);
          }
        } else {
          fetchFolders();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateLedgerFolders: async (folders: any[], dealerId?: string) => {
    const docId = dealerId ? `ledger_folders_${dealerId}` : 'ledger_folders_main';
    
    // Fetch existing first to ensure we don't violate not-null constraints on upsert
    const { data: existing } = await supabase.from('branding_config').select('*').eq('id', docId).maybeSingle();
    
    const payload = {
      ...(existing || {}),
      id: docId,
      dashboard_subtext: JSON.stringify(folders),
      updated_at: Date.now()
    };
    
    let error;
    if (existing) {
      const { error: updateError } = await supabase.from('branding_config').update(payload).eq('id', docId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('branding_config').insert(payload);
      error = insertError;
    }
    
    if (error) {
      console.error("Supabase error in updateLedgerFolders:", error);
      throw error;
    }
  },

  subscribeLedgerSheetFolderMap: (callback: (map: Record<string, string>) => void, dealerId?: string) => {
    const docId = dealerId ? `ledger_sheet_map_${dealerId}` : 'ledger_sheet_map_main';
    
    const fetchMap = async () => {
      try {
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();
        if (error) {
          console.error("Ledger sheet map fetch error from Supabase:", error);
          return; // Return early, don't execute callback with null/incorrect state
        }
        if (data && data.dashboard_subtext) {
          try {
            callback(JSON.parse(data.dashboard_subtext));
          } catch (pErr) {
            console.error("Failed to parse ledger sheet map JSON:", pErr);
            callback({});
          }
        } else if (data) {
          callback({});
        } else {
          callback(null as any); // Null indicates completely uninitialized in database (no record)
        }
      } catch (e) {
        console.error("Ledger sheet map fetch failed:", e);
      }
    };

    fetchMap();

    const channelId = `ledger_sheet_map_${docId}_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config', filter: `id=eq.${docId}` }, (payload) => {
        if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
          const newData = payload.new as any;
          if (newData.dashboard_subtext) {
            try {
              callback(JSON.parse(newData.dashboard_subtext));
            } catch (pErr) {
              console.error("Failed to parse realtime payload:", pErr);
              fetchMap();
            }
          } else {
            callback({});
          }
        } else {
          fetchMap();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateLedgerSheetFolderMap: async (map: Record<string, string>, dealerId?: string) => {
    const docId = dealerId ? `ledger_sheet_map_${dealerId}` : 'ledger_sheet_map_main';
    
    // Fetch existing first to ensure we don't violate not-null constraints on upsert
    const { data: existing } = await supabase.from('branding_config').select('*').eq('id', docId).maybeSingle();
    
    const payload = {
      ...(existing || {}),
      id: docId,
      dashboard_subtext: JSON.stringify(map),
      updated_at: Date.now()
    };
    
    let error;
    if (existing) {
      const { error: updateError } = await supabase.from('branding_config').update(payload).eq('id', docId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('branding_config').insert(payload);
      error = insertError;
    }
    
    if (error) {
      console.error("Supabase error in updateLedgerSheetFolderMap:", error);
      throw error;
    }
  },

  runOneTimeJulyMigration: async () => {
    try {
      const docIdFolders = 'ledger_folders_main';
      const docIdMap = 'ledger_sheet_map_main';
      
      const { data: sheets } = await supabase.from('ledger_sheets').select('*');
      const { data: mapData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdMap).maybeSingle();
      const { data: foldersData } = await supabase.from('branding_config').select('id, dashboard_subtext').eq('id', docIdFolders).maybeSingle();

      let map = mapData && mapData.dashboard_subtext ? JSON.parse(mapData.dashboard_subtext) : {};
      let folders = foldersData && foldersData.dashboard_subtext ? JSON.parse(foldersData.dashboard_subtext) : [];
      
      if (!Array.isArray(folders)) folders = [];
      
      const julyFolderId = "folder_1782822316447_zm8i1";
      const juneFolderId = "june_data";

      let julyFolder = folders.find((f: any) => f.id === julyFolderId || f.name.toLowerCase().includes('july'));
      if (!julyFolder) {
          julyFolder = { id: julyFolderId, name: '1 July Data', createdAt: Date.now() };
          folders.push(julyFolder);
      } else {
          julyFolder.id = julyFolderId;
          if (!julyFolder.name) julyFolder.name = '1 July Data';
      }

      let juneFolder = folders.find((f: any) => f.id === juneFolderId || f.name.toLowerCase().includes('june'));
      if (!juneFolder) {
          juneFolder = { id: juneFolderId, name: 'June Data', createdAt: Date.now() };
          folders.push(juneFolder);
      } else {
          juneFolder.id = juneFolderId;
          if (!juneFolder.name) juneFolder.name = 'June Data';
      }

      const isJulySheet = (sDate: string): boolean => {
        const clean = sDate.toLowerCase().trim();
        if (clean.includes('july') || clean.includes('jul')) return true;
        const parts = clean.split('-');
        if (parts.length >= 2) {
          const month = parts[1].trim();
          if (month === '07' || month === '7') return true;
        }
        return false;
      };

      if (sheets) {
        sheets.forEach((s: any) => {
          // Map to June or July ONLY if it is currently unmapped!
          if (!map[s.id]) {
            const sheetDate = (s.sheet_date || '').toLowerCase();
            if (isJulySheet(sheetDate)) {
                map[s.id] = julyFolderId;
            } else {
                map[s.id] = juneFolderId;
            }
          }
        });
      }

      await supabase.from('branding_config').upsert({
          id: docIdMap,
          dashboard_subtext: JSON.stringify(map),
          updated_at: Date.now()
      });

      await supabase.from('branding_config').upsert({
          id: docIdFolders,
          dashboard_subtext: JSON.stringify(folders),
          updated_at: Date.now()
      });
      console.log("Completed one-time July migration successfully.");
    } catch (e) {
      console.error("Migration failed:", e);
    }
  },

  // --- Recovery Ledger Sheets ---
  saveLedgerSheet: async (sheet: any) => {
    try {
      const sheetId = sheet.id || `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const dataToSave = {
        ...sheet,
        id: sheetId,
        createdAt: sheet.createdAt || Date.now()
      };
      const dbRow = toDb('ledger_sheets', dataToSave);
      const { error } = await supabase.from('ledger_sheets').upsert(dbRow);
      if (error) throw error;
      return dataToSave;
    } catch (e) {
      console.error("saveLedgerSheet error:", e);
    }
  },

  subscribeLedgerSheets: (callback: (sheets: any[]) => void, dealerId?: string) => {
    return subscribeTable(
      'ledger_sheets',
      (q) => {
        if (dealerId) {
          return q.eq('dealer_id', dealerId);
        }
        return q;
      },
      (sheets) => {
        callback(sheets.sort((a, b) => b.createdAt - a.createdAt));
      },
      (row) => fromDb('ledger_sheets', row),
      dealerId
    );
  },

  deleteLedgerSheet: async (sheetId: string) => {
    try {
      // Save ledger sheet to Recycle Bin first
      try {
        await firebaseService.saveToRecycleBin('ledger_sheets', sheetId, 'admin');
      } catch (err) {
        console.error("Error saving ledger sheet to recycle bin:", err);
      }

      await supabase.from('ledger_sheets').delete().eq('id', sheetId);
    } catch (e) {
      console.error("deleteLedgerSheet error:", e);
    }
  },

  terminateAllLedgerSheets: async (dealerId: string) => {
    try {
      await supabase.from('ledger_sheets').delete().eq('dealer_id', dealerId);
    } catch (e) {
      console.error("terminateAllLedgerSheets error:", e);
    }
  },

  // --- Recycle Bin Service Methods ---
  saveToRecycleBin: async (tableName: string, recordId: string, authorName: string, dealerId?: string, extraData?: any) => {
    try {
      let recordData: any = null;
      const isVirtual = ['billing_row', 'ledger_folder'].includes(tableName);

      if (isVirtual) {
        recordData = extraData?.originalData || extraData || {};
      } else {
        // 1. Fetch current row before deleting
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq(tableName === 'users' ? 'uid' : 'id', recordId)
          .maybeSingle();

        if (error || !data) {
          if (extraData) {
            recordData = extraData.originalData || extraData;
          } else {
            console.warn(`Could not fetch record from ${tableName} with ID ${recordId} for Recycle Bin`);
            return;
          }
        } else {
          // Convert from DB format to client format using existing fromDb if applicable
          recordData = fromDb(tableName, data);
        }
      }

      // 2. Generate a Recycle Bin notification item
      const id = 'recycle_' + tableName + '_' + recordId + '_' + Date.now();
      
      let label = recordId;
      if (tableName === 'users') {
        label = recordData.username || recordData.fullName || recordId;
      } else if (tableName === 'complaints') {
        label = recordData.customerName || recordId;
      } else if (tableName === 'clients') {
        label = recordData.name || recordData.username || recordId;
      } else if (tableName === 'ledger_sheets') {
        label = recordData.sheetDate || recordData.recOfficerLabel || recordId;
      } else if (tableName === 'monitor_targets') {
        label = recordData.label || recordData.domain || recordId;
      } else if (tableName === 'branding_config') {
        // This is used for billing month sheets
        label = recordData.id ? recordData.id.replace('billing_month_', '') : recordId;
      } else if (tableName === 'billing_row') {
        label = recordData.name || recordData.username || recordId;
      } else if (tableName === 'ledger_folder') {
        label = recordData.name || recordId;
      }

      let tableDisplay = tableName.toUpperCase().slice(0, -1) || tableName;
      if (tableName === 'branding_config') {
        tableDisplay = 'Billing Month';
      } else if (tableName === 'billing_row') {
        tableDisplay = 'Billing Row';
      } else if (tableName === 'ledger_folder') {
        tableDisplay = 'Ledger Folder';
      }

      const dbRow = {
        id,
        type: 'recycle_bin',
        message: `Deleted ${tableDisplay}: ${label}`,
        author_name: authorName || 'admin',
        created_at: Date.now(),
        is_read: false,
        dealer_id: dealerId || recordData.dealerId || 'main',
        details: {
          originalTable: tableName,
          originalId: recordId,
          originalData: recordData,
          extraData: extraData || null,
          deletedAt: Date.now()
        }
      };

      await supabase.from('notifications').insert(dbRow);
      console.log(`Saved ${tableName} record to Recycle Bin successfully!`);
      
      // Dispatch custom events to instantly update UI on current client
      window.dispatchEvent(new CustomEvent('gts-table-updated-notifications'));
      window.dispatchEvent(new CustomEvent(`gts-table-updated-${tableName}`));
    } catch (e) {
      console.error("saveToRecycleBin error:", e);
    }
  },

  restoreFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      // 1. Get the recycle bin item from notifications table
      const { data: item, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', recycleBinItemId)
        .maybeSingle();

      if (error || !item) {
        throw new Error("Recycle Bin item not found or error fetching");
      }

      const details = item.details || {};
      const { originalTable, originalId, originalData, extraData } = details;

      if (!originalTable || !originalId || !originalData) {
        throw new Error("Invalid Recycle Bin item details");
      }

      // 2. Restore based on originalTable
      console.log(`Restoring item of type ${originalTable} with ID ${originalId}...`);

      if (originalTable === 'users') {
        const dbRow = toDb('users', originalData);
        await supabase.from('users').upsert(dbRow);
      } else if (originalTable === 'complaints') {
        const dbRow = toDb('complaints', originalData);
        await supabase.from('complaints').upsert(dbRow);
      } else if (originalTable === 'clients') {
        const dbRow = toDb('clients', originalData);
        await supabase.from('clients').upsert(dbRow);
        
        // Restore associated users_data if present
        if (Array.isArray(extraData) && extraData.length > 0) {
          for (const uRow of extraData) {
            await supabase.from('users_data').upsert(uRow);
          }
        }
      } else if (originalTable === 'ledger_sheets') {
        const dbRow = toDb('ledger_sheets', originalData);
        await supabase.from('ledger_sheets').upsert(dbRow);
      } else if (originalTable === 'monitor_targets') {
        const dbRow = toDb('monitor_targets', originalData);
        await supabase.from('monitor_targets').upsert(dbRow);
      } else if (originalTable === 'branding_config') {
        // This is a deleted billing month sheet
        const dbRow = toDb('branding_config', originalData);
        await supabase.from('branding_config').upsert(dbRow);

        // Restore associated users_data billing rows if present
        if (Array.isArray(extraData) && extraData.length > 0) {
          for (let index = 0; index < extraData.length; index += 50) {
            const chunk = extraData.slice(index, index + 50);
            await supabase.from('users_data').upsert(chunk, { onConflict: 'id' });
          }
        }
      } else if (originalTable === 'billing_row') {
        // Restore individual billing row to its billing month sheet
        const { monthId, dealerId } = extraData || {};
        if (monthId) {
          const docId = dealerId ? `billing_month_${dealerId}_${monthId}` : `billing_month_${monthId}`;
          const { data: monthConfig } = await supabase
            .from('branding_config')
            .select('*')
            .eq('id', docId)
            .maybeSingle();

          let currentRows: any[] = [];
          if (monthConfig && monthConfig.dashboard_subtext) {
            try {
              currentRows = JSON.parse(monthConfig.dashboard_subtext);
            } catch (pErr) {
              console.error("Failed to parse billing month rows during restore:", pErr);
            }
          }

          // Check if this row is already there to avoid duplicates
          const isDuplicate = currentRows.some((r: any) => 
            (r.clientId && r.clientId === originalData.clientId) || 
            (r.username && r.username === originalData.username)
          );

          if (!isDuplicate) {
            currentRows.push(originalData);
            await firebaseService.saveBillingMonth(monthId, currentRows, 'System Restore', dealerId);
          }
        }
      } else if (originalTable === 'ledger_folder') {
        // Restore ledger folder to folders config
        const { dealerId, associatedSheetIds } = extraData || {};
        const docId = dealerId ? `ledger_folders_${dealerId}` : 'ledger_folders_main';
        const { data: foldersConfig } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();

        let currentFolders: any[] = [];
        if (foldersConfig && foldersConfig.dashboard_subtext) {
          try {
            currentFolders = JSON.parse(foldersConfig.dashboard_subtext);
          } catch (pErr) {
            console.error("Failed to parse ledger folders during restore:", pErr);
          }
        }

        // Check if already exists
        const exists = currentFolders.some((f: any) => f.id === originalData.id);
        if (!exists) {
          currentFolders.push(originalData);
          await firebaseService.updateLedgerFolders(currentFolders, dealerId);
        }

        // Restore associated sheet mappings
        if (Array.isArray(associatedSheetIds) && associatedSheetIds.length > 0) {
          const mapDocId = dealerId ? `ledger_sheet_map_${dealerId}` : 'ledger_sheet_map_main';
          const { data: mapConfig } = await supabase
            .from('branding_config')
            .select('*')
            .eq('id', mapDocId)
            .maybeSingle();

          let currentMap: Record<string, string> = {};
          if (mapConfig && mapConfig.dashboard_subtext) {
            try {
              currentMap = JSON.parse(mapConfig.dashboard_subtext);
            } catch (pErr) {
              console.error("Failed to parse ledger sheet map during restore:", pErr);
            }
          }

          associatedSheetIds.forEach((sheetId: string) => {
            currentMap[sheetId] = originalData.id;
          });

          await firebaseService.updateLedgerSheetFolderMap(currentMap, dealerId);
        }
      }

      // 3. Delete the recycle bin item notification so it is removed from Recycle Bin
      const { error: deleteError } = await supabase.from('notifications').delete().eq('id', recycleBinItemId);
      if (deleteError) {
        console.error("delete error in restore:", deleteError);
        throw new Error(deleteError.message || "Failed to delete notification item from Recycle Bin");
      }
      
      // Update local cache directly to ensure instant updates in UI
      try {
        const cacheKey = 'gts_cache_v3_notifications';
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((n: any) => n.id !== recycleBinItemId);
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to update cache on restore delete:", cacheErr);
      }

      console.log(`Item successfully restored and removed from Recycle Bin!`);
      
      // Dispatch custom events to instantly update UI on current client
      window.dispatchEvent(new CustomEvent('gts-table-updated-notifications'));
      if (originalTable) {
        window.dispatchEvent(new CustomEvent(`gts-table-updated-${originalTable}`));
      }
    } catch (e) {
      console.error("restoreFromRecycleBin error:", e);
      throw e;
    }
  },

  permanentlyDeleteFromRecycleBin: async (recycleBinItemId: string) => {
    try {
      if (!recycleBinItemId) {
        throw new Error("Recycle bin item ID is required for permanent deletion");
      }
      const { error } = await supabase.from('notifications').delete().eq('id', recycleBinItemId);
      if (error) {
        console.error("permanentlyDeleteFromRecycleBin database error:", error);
        throw new Error(error.message || "Failed to permanently delete item from Recycle Bin");
      }

      // Update local cache directly to ensure instant updates in UI
      try {
        const cacheKey = 'gts_cache_v3_notifications';
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((n: any) => n.id !== recycleBinItemId);
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to update cache on permanent delete:", cacheErr);
      }

      // Dispatch custom events to instantly update UI on current client
      window.dispatchEvent(new CustomEvent('gts-table-updated-notifications'));
    } catch (e) {
      console.error("permanentlyDeleteFromRecycleBin error:", e);
      throw e;
    }
  },

  cleanOldRecycleBinItems: async () => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'recycle_bin')
        .lt('created_at', sevenDaysAgo);
      if (error) console.error("Error during 7-day Recycle Bin cleanup:", error);
    } catch (e) {
      console.error("cleanOldRecycleBinItems error:", e);
    }
  }
};
