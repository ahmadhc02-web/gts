import { supabase } from '../lib/supabase';
import { supabaseService, fromDb, toDb } from '../lib/supabaseService';
import { Client, UserProfile } from '../types';

export interface ClientQueryFilters {
  dealerId?: string;
  lineCode?: string | null;
  lineId?: string | null;
  area?: string;
  searchQuery?: string;
}

export const clientService = {
  /**
   * Fetches clients strictly isolated by active tenant and line context.
   * - Super Admin can view all or filter by specific line / without line.
   * - Sub-dealers / Line Admins only ever receive records matching their line_code / line_id.
   * - Unassigned / Without Line viewers only receive records where line_code / line_id is NULL or empty.
   */
  getClients: async (
    currentUser?: UserProfile | null,
    filters?: ClientQueryFilters
  ): Promise<Client[]> => {
    try {
      if (!supabase) return [];
      let query = supabase.from('clients').select('*');

      const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
      const userLineCode = currentUser?.lineCode ? String(currentUser.lineCode).trim() : '';
      const userLineId = currentUser?.lineId ? String(currentUser.lineId).trim() : '';

      if (!isSuperAdmin) {
        // Enforce strict line isolation for non-super admins
        if (userLineId) {
          query = query.eq('line_id', userLineId);
        } else if (userLineCode) {
          query = query.eq('line_code', userLineCode);
        } else {
          // User has no line: strictly isolated to "Without Line / Unassigned"
          query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
        }

        // Additional dealerId restriction if applicable
        if (currentUser?.dealerId && currentUser.dealerId !== 'main' && currentUser.dealerId !== 'all') {
          query = query.eq('dealer_id', currentUser.dealerId);
        }
      } else {
        // Super Admin query handling
        if (filters?.lineId) {
          query = query.eq('line_id', filters.lineId.trim());
        } else if (filters?.lineCode === '__without_line__' || filters?.lineCode === null) {
          query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
        } else if (filters?.lineCode && filters.lineCode !== 'all') {
          query = query.eq('line_code', filters.lineCode.trim());
        }

        if (filters?.dealerId && filters.dealerId !== 'all' && filters.dealerId !== 'main') {
          query = query.eq('dealer_id', filters.dealerId);
        }
      }

      if (filters?.area && filters.area !== 'all') {
        query = query.eq('area', filters.area);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) {
        console.warn('clientService.getClients error:', error?.message);
        return [];
      }

      return data.map(r => fromDb('clients', r));
    } catch (e) {
      console.error('clientService.getClients exception:', e);
      return [];
    }
  },

  /**
   * Creates a client record with enforced multi-tenancy tags (line_id, line_code, dealer_id).
   */
  addClient: async (
    data: Omit<Client, 'id' | 'createdAt'>,
    authorName: string,
    currentUser?: UserProfile | null
  ): Promise<Client> => {
    const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
    const isSubDealerOrLineAdmin = !isSuperAdmin && (Boolean(currentUser?.lineCode) || Boolean(currentUser?.lineId) || currentUser?.role === 'dealer');

    let assignedLineId: string | null = null;
    let assignedLineCode: string | null = null;
    let assignedDealerId: string = data.dealerId || 'main';

    if (isSubDealerOrLineAdmin) {
      // FORCE line admin's line_id and line_code
      assignedLineId = currentUser?.lineId || currentUser?.line_id || null;
      assignedLineCode = currentUser?.lineCode || currentUser?.line_code || null;
      assignedDealerId = currentUser?.uid || currentUser?.dealerId || 'main';
    } else {
      // Super Admin: respects explicit lineCode / lineId selection or defaults to null ("Without Line")
      if (data.lineCode && data.lineCode !== '__without_line__') {
        assignedLineCode = String(data.lineCode).trim();
      } else {
        assignedLineCode = null;
      }
      assignedLineId = data.lineId ? String(data.lineId).trim() : null;
    }

    const newClient: Client = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      dealerId: assignedDealerId,
      lineId: assignedLineId,
      lineCode: assignedLineCode,
      line_id: assignedLineId,
      line_code: assignedLineCode,
      createdAt: Date.now()
    };

    await supabaseService.createClient(newClient, authorName, assignedDealerId, currentUser || undefined);
    return newClient;
  },

  /**
   * Updates an existing client with strict line security checks.
   */
  updateClient: async (
    id: string,
    data: Partial<Client>,
    clientName: string,
    authorName: string,
    currentUser?: UserProfile | null
  ): Promise<void> => {
    const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
    const payload: Partial<Client> = { ...data };

    if (!isSuperAdmin) {
      // Ensure sub-dealers cannot re-assign or leak records to other lines
      payload.lineId = currentUser?.lineId || currentUser?.line_id || null;
      payload.lineCode = currentUser?.lineCode || currentUser?.line_code || null;
      payload.line_id = payload.lineId;
      payload.line_code = payload.lineCode;
    } else if (payload.lineCode === '__without_line__') {
      payload.lineCode = null;
      payload.lineId = null;
      payload.line_code = null;
      payload.line_id = null;
    }

    await supabaseService.updateClient(id, payload, clientName, authorName, currentUser || undefined);
  },

  /**
   * Deletes a client.
   */
  deleteClient: async (
    id: string,
    clientName: string,
    authorName: string,
    clientData?: Client,
    isPermanent: boolean = false
  ): Promise<void> => {
    await supabaseService.deleteClient(id, clientName, authorName, clientData, isPermanent);
  }
};
