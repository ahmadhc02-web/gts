import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper function to get custom or default Supabase configuration
const getStorageItem = (key: string): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || '';
    }
  } catch (e) {}
  return '';
};

const getSupabaseConfig = () => {
  const baseUrl = 'https://167.233.41.7.sslip.io';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';
  return { baseUrl, anonKey };
};

// Generic REST fetch wrapper for Supabase REST API
async function supabaseRestFetch(endpoint: string, options: RequestInit = {}) {
  const { baseUrl, anonKey } = getSupabaseConfig();
  const url = `${baseUrl}/rest/v1/${endpoint}`;

  const headers: Record<string, string> = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST Error (${response.status}): ${errorText}`);
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return null;
}

// Data Service using fetch-based Supabase REST API
export const dataService = {
  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await supabaseRestFetch('complaints?select=count&limit=1', { method: 'GET' });
      console.log('Supabase REST client connected and verified successfully');
      return true;
    } catch (e) {
      console.warn('Supabase REST connection warning:', e);
      return false;
    }
  },

  // COMPLAINTS TABLE OPERATIONS
  async getComplaints(dealerId?: string): Promise<any[]> {
    try {
      let endpoint = 'complaints?select=*&order=created_at.desc';
      if (dealerId && dealerId !== 'all') {
        endpoint += `&dealer_id=eq.${encodeURIComponent(dealerId)}`;
      }
      const data = await supabaseRestFetch(endpoint, { method: 'GET' });
      return (data || []).map((row: any) => ({
        id: row.complaint_id || row.id,
        complaintId: row.complaint_id || row.id,
        customerName: row.customer_name || row.customerName || '',
        customerPhone: row.phone_number || row.customerPhone || '',
        customerAddress: row.address || row.customerAddress || '',
        category: row.category || 'General',
        description: row.description || '',
        status: row.status || 'Pending',
        priority: row.priority || 'Medium',
        zone: row.zone || 'General',
        dealerId: row.dealer_id || dealerId || 'main',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        assignedTo: row.assigned_to || '',
        remarks: row.remarks || '',
        reviews: row.reviews || []
      }));
    } catch (err) {
      console.error('Error fetching complaints via Supabase REST:', err);
      return [];
    }
  },

  async createComplaint(complaintData: any, user?: any): Promise<any> {
    try {
      const payload = [{
        complaint_id: complaintData.id || `CMP-${Date.now()}`,
        customer_name: complaintData.customerName || '',
        phone_number: complaintData.customerPhone || '',
        address: complaintData.customerAddress || '',
        category: complaintData.category || 'General',
        description: complaintData.description || '',
        status: complaintData.status || 'Pending',
        priority: complaintData.priority || 'Medium',
        zone: complaintData.zone || 'General',
        dealer_id: complaintData.dealerId || user?.dealerId || 'main',
        assigned_to: complaintData.assignedTo || '',
        remarks: complaintData.remarks || '',
        created_at: new Date().toISOString()
      }];

      const res = await supabaseRestFetch('complaints', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return res ? res[0] : payload[0];
    } catch (err) {
      console.error('Error creating complaint via Supabase REST:', err);
      throw err;
    }
  },

  async updateComplaint(id: string, updates: any): Promise<any> {
    try {
      const payload: any = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.remarks !== undefined) payload.remarks = updates.remarks;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;
      if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
      if (updates.customerPhone !== undefined) payload.phone_number = updates.customerPhone;
      payload.updated_at = new Date().toISOString();

      const res = await supabaseRestFetch(`complaints?complaint_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return res;
    } catch (err) {
      console.error('Error updating complaint via Supabase REST:', err);
      throw err;
    }
  },

  async deleteComplaint(id: string): Promise<boolean> {
    try {
      await supabaseRestFetch(`complaints?complaint_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.error('Error deleting complaint via Supabase REST:', err);
      return false;
    }
  },

  // USERS TABLE OPERATIONS
  async getUsers(dealerId?: string): Promise<any[]> {
    try {
      let endpoint = 'users_data?select=*';
      if (dealerId && dealerId !== 'all') {
        endpoint += `&dealer_id=eq.${encodeURIComponent(dealerId)}`;
      }
      const data = await supabaseRestFetch(endpoint, { method: 'GET' });
      return (data || []).map((u: any) => ({
        uid: u.uid || u.id,
        username: u.username || u.name,
        fullName: u.full_name || u.name || u.username,
        role: u.role || 'member',
        dealerId: u.dealer_id || 'main',
        lineCode: u.line_code || '',
        companyName: u.company_name || '',
        email: u.email || '',
        status: u.status || 'active',
        createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now()
      }));
    } catch (err) {
      console.error('Error fetching users via Supabase REST:', err);
      return [];
    }
  },

  async createUser(userData: any): Promise<any> {
    try {
      const payload = [{
        uid: userData.uid || `USR-${Date.now()}`,
        username: userData.username,
        password: userData.password,
        full_name: userData.fullName || userData.username,
        role: userData.role || 'member',
        dealer_id: userData.dealerId || 'main',
        line_code: userData.lineCode || '',
        company_name: userData.companyName || '',
        email: userData.email || '',
        status: 'active',
        created_at: new Date().toISOString()
      }];

      const res = await supabaseRestFetch('users_data', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return res ? res[0] : payload[0];
    } catch (err) {
      console.error('Error creating user via Supabase REST:', err);
      throw err;
    }
  },

  async updateUser(uid: string, updates: any): Promise<any> {
    try {
      const payload: any = {};
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.password !== undefined) payload.password = updates.password;
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.dealerId !== undefined) payload.dealer_id = updates.dealerId;
      if (updates.status !== undefined) payload.status = updates.status;

      const res = await supabaseRestFetch(`users_data?uid=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return res;
    } catch (err) {
      console.error('Error updating user via Supabase REST:', err);
      throw err;
    }
  },

  async deleteUser(uid: string): Promise<boolean> {
    try {
      await supabaseRestFetch(`users_data?uid=eq.${encodeURIComponent(uid)}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err) {
      console.error('Error deleting user via Supabase REST:', err);
      return false;
    }
  },

  // CONFIG TABLE OPERATIONS
  async getAppConfig(tenantId: string = 'main'): Promise<any> {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      const data = await supabaseRestFetch(`branding_config?select=*&config_type=eq.${encodeURIComponent(docId)}&limit=1`, {
        method: 'GET'
      });
      if (data && data.length > 0) {
        if (data[0].dashboard_subtext) {
          try { return JSON.parse(data[0].dashboard_subtext); } catch (e) {}
        }
        return data[0];
      }
      return null;
    } catch (err) {
      console.error('Error fetching config via Supabase REST:', err);
      return null;
    }
  },

  async updateConfig(configData: any, tenantId: string = 'main'): Promise<any> {
    const docId = tenantId === 'main' ? 'app_main_config' : `app_config_${tenantId}`;
    try {
      const payload = [{
        tenant_id: tenantId,
        config_type: docId,
        dashboard_subtext: typeof configData === 'string' ? configData : JSON.stringify(configData)
      }];

      const res = await supabaseRestFetch('branding_config', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch (err) {
      console.error('Error updating config via Supabase REST:', err);
      throw err;
    }
  }
};

export default dataService;
