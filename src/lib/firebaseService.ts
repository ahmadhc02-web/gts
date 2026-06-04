import { supabase } from '../../supabaseClient';
import { auth } from './firebase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification as AppNotification, ChatGroup, BrandingConfig, MonitorTarget } from '../types';
import { safeStringify } from './utils';

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
      result[dbKey] = obj[clientKey];
    }
  }
  // Copy over other unmapped keys as fallback
  for (const [key, val] of Object.entries(obj)) {
    const dbKey = tableMapping[key];
    if (!dbKey) {
      result[key] = val;
    }
  }
  return result;
}

function fromDb(table: string, obj: any): any {
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
  return result;
}

// Global subscription query listener
function subscribeTable(
  tableName: string,
  queryBuilder: (query: any) => any,
  callback: (data: any[]) => void,
  mapRow: (row: any) => any = (row) => row
) {
  const fetchAndCallback = async () => {
    try {
      let q = supabase.from(tableName).select('*');
      q = queryBuilder(q);
      const { data, error } = await q;
      if (error) {
        console.error(`Error loading table ${tableName}:`, error);
        return;
      }
      callback((data || []).map(mapRow));
    } catch (err) {
      console.error(`Exception during query loading on ${tableName}:`, err);
    }
  };

  fetchAndCallback();

  const channelId = `realtime_${tableName}_${Math.random().toString(36).substr(2, 6)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
      fetchAndCallback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'member' || user.role === 'editor' || user.role === 'liteadmin') return undefined;
    if (user.role === 'dealer') return user.uid;
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
      console.error('getUsers error:', error);
      return [];
    }
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
      if (error) throw error;
      return data ? fromDb('users', data) : null;
    } catch (error) {
      console.error('getUser error:', error);
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
      (row) => fromDb('users', row)
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
      (row) => fromDb('notifications', row)
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

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, remarks?: string, customerReview?: string) => {
    try {
      const updateData: any = { 
        status, 
        updatedAt: Date.now(),
        ...(remarks && { remarks, remarkAuthorId: authorId, remarkAuthorName: authorName }),
        ...(customerReview && { customerReview })
      };
      
      const dbRow = toDb('complaints', updateData);
      const { error } = await supabase.from('complaints').update(dbRow).eq('id', id);
      if (error) throw error;

      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Status updated to ${status.toUpperCase()} for "${customerName}"${remarks ? ` - Remarks: ${remarks}` : ''}${customerReview ? ` - Review: ${customerReview}` : ''}`,
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
      (row) => fromDb('complaints', row)
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
      (row) => fromDb('chat_groups', row)
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
      (row) => fromDb('chat_messages', row)
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
    } catch (error) {
      console.error("updateClientComplaints error:", error);
    }
  },

  deleteClient: async (id: string, clientName: string, authorName: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      
      await firebaseService.createNotification({
        type: 'client_deleted',
        message: `Client record removed: "${clientName}" purged from database`,
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
      (row) => fromDb('clients', row)
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
      return newTarget;
    } catch (error) {
      console.error('createMonitorTarget error:', error);
      throw error;
    }
  },

  deleteMonitorTarget: async (id: string): Promise<void> => {
    try {
      await supabase.from('monitor_targets').delete().eq('id', id);
    } catch (error) {
      console.error('deleteMonitorTarget error:', error);
    }
  },

  updateMonitorTarget: async (id: string, updates: Partial<MonitorTarget>): Promise<void> => {
    try {
      const dbRow = toDb('monitor_targets', updates);
      await supabase.from('monitor_targets').update(dbRow).eq('id', id);
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
      (row) => fromDb('monitor_targets', row)
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
  },

  deleteBillingMonth: async (monthId: string, dealerId?: string) => {
    const docId = dealerId ? `billing_month_${dealerId}_${monthId}` : `billing_month_${monthId}`;
    await supabase.from('branding_config').delete().eq('id', docId);
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
      (row) => fromDb('ledger_sheets', row)
    );
  },

  deleteLedgerSheet: async (sheetId: string) => {
    try {
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
  }
};
