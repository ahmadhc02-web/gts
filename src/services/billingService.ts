import { supabase } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { Client, UserProfile, BillingRecord, Invoice } from '../types';

export interface BillingFilterOptions {
  dealerId?: string;
  lineCode?: string | null;
  lineId?: string | null;
  status?: string;
  area?: string;
  searchQuery?: string;
}

export interface BillingSummaryMetrics {
  totalExpected: number;
  totalBase: number;
  totalCr: number;
  totalRecovered: number;
  totalOutstanding: number;
  totalTDC: number;
  totalDC: number;
  totalPending: number;
  totalPaid: number;
  activeCustomersCount: number;
  recoveryRate: number;
}

export const billingService = {
  /**
   * Fetches billing months with strict line isolation.
   */
  getBillingMonths: async (
    dealerId?: string,
    lineCodeFilter?: string | null,
    lineIdFilter?: string | null
  ) => {
    return supabaseService.getBillingMonths(dealerId, lineCodeFilter);
  },

  /**
   * Fetches rows for a specific month with strict line isolation.
   */
  getBillingRowsForMonth: async (
    monthId: string,
    currentUser?: UserProfile | null,
    filters?: BillingFilterOptions
  ): Promise<any[]> => {
    try {
      if (!supabase) return [];
      let query = supabase.from('billing_rows').select('*').eq('month_id', monthId);

      const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
      const userLineCode = currentUser?.lineCode ? String(currentUser.lineCode).trim() : '';
      const userLineId = currentUser?.lineId ? String(currentUser.lineId).trim() : '';

      if (!isSuperAdmin) {
        // Strict line isolation for dealers
        if (userLineId) {
          query = query.eq('line_id', userLineId);
        } else if (userLineCode) {
          query = query.eq('line_code', userLineCode);
        } else {
          query = query.or('line_id.is.null,line_code.is.null,line_code.eq.');
        }

        if (currentUser?.dealerId && currentUser.dealerId !== 'main' && currentUser.dealerId !== 'all') {
          query = query.eq('dealer_id', currentUser.dealerId);
        }
      } else {
        // Super Admin query
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

      const { data, error } = await query;
      if (error || !data) return [];
      return data;
    } catch (e) {
      console.error('billingService.getBillingRowsForMonth error:', e);
      return [];
    }
  },

  /**
   * Generates new billing rows for a new month cycle from master clients list,
   * guaranteeing that line_id and line_code are copied from each client record.
   */
  generateBillingRowsFromClients: (
    masterClients: Client[],
    previousMonthRows: any[] = []
  ): any[] => {
    const prevRowsMap = new Map<string, any>();
    previousMonthRows.forEach(r => {
      const uKey = r.username ? `u_${String(r.username).toLowerCase().trim()}` : null;
      const iKey = r.clientId ? `i_${String(r.clientId).toLowerCase().trim()}` : null;
      if (uKey) prevRowsMap.set(uKey, r);
      if (iKey) prevRowsMap.set(iKey, r);
    });

    return masterClients.map((client, idx) => {
      const uKey = client.username ? `u_${String(client.username).toLowerCase().trim()}` : null;
      const iKey = client.id ? `i_${String(client.id).toLowerCase().trim()}` : null;
      const prev = (uKey && prevRowsMap.get(uKey)) || (iKey && prevRowsMap.get(iKey)) || null;

      let prevUnpaid = 0;
      let prevStatus = 'unpaid';

      if (prev) {
        const prevTotal = parseFloat(prev.totalAmount ?? prev.total_amount ?? 0) || 0;
        const prevReceived = parseFloat(prev.paymentReceived ?? prev.payment_received ?? 0) || 0;
        prevStatus = prev.paymentStatus ?? prev.payment_status ?? 'unpaid';

        if (prevStatus === 'tdc' || prevStatus === 'dc') {
          prevUnpaid = 0;
        } else if (prevStatus === 'paid') {
          prevUnpaid = 0;
        } else {
          prevUnpaid = Math.max(0, prevTotal - prevReceived);
        }
      }

      // Calculate clean base amount from package details or baseAmount
      let base = typeof client.baseAmount === 'number' ? client.baseAmount : parseFloat(String(client.baseAmount || 0));
      if (!base || base <= 0) {
        if (client.pkgDetails) {
          const digits = client.pkgDetails.match(/\d{3,5}/g);
          if (digits && digits.length > 0) {
            base = parseInt(digits[digits.length - 1], 10);
          } else {
            const lowDigits = client.pkgDetails.replace(/[^0-9]/g, '');
            if (lowDigits && lowDigits.length >= 3) {
              base = parseInt(lowDigits, 10);
            } else {
              base = 1000;
            }
          }
        } else {
          base = 1000;
        }
      }

      const isSuspended = prevStatus === 'tdc' || prevStatus === 'dc';
      const actualBase = isSuspended ? 0 : base;
      const totalAmount = actualBase + prevUnpaid;

      const clientLineCode = client.lineCode || client.line_code || null;
      const clientLineId = client.lineId || client.line_id || null;

      return {
        id: client.id,
        clientId: client.id,
        client_id: client.id,
        name: client.name || 'Subscriber',
        username: client.username || `user_${idx}`,
        mobileNumber: client.mobileNumber || client.number || '',
        mobile_number: client.mobileNumber || client.number || '',
        phone: client.mobileNumber || client.number || '',
        area: client.area || '',
        rt: client.rt || 'BILL',
        baseAmount: actualBase,
        base_amount: actualBase,
        cr: prevUnpaid,
        totalAmount: totalAmount,
        total_amount: totalAmount,
        billingDay: String(client.billingDay || '5'),
        billing_day: String(client.billingDay || '5'),
        paymentReceived: 0,
        payment_received: 0,
        paymentStatus: isSuspended ? prevStatus : 'unpaid',
        payment_status: isSuspended ? prevStatus : 'unpaid',
        comments: '',
        occ: 'personal',
        pkgDetails: client.pkgDetails || '8Mb',
        pkg_details: client.pkgDetails || '8Mb',
        panelDetails: client.panelDetails || '',
        panel_details: client.panelDetails || '',
        dealerId: client.dealerId || 'main',
        dealer_id: client.dealerId || 'main',
        // CRITICAL MULTI-TENANCY ATTACHMENT:
        lineCode: clientLineCode,
        line_code: clientLineCode,
        lineId: clientLineId,
        line_id: clientLineId,
        connectionDate: client.createdAt ? new Date(client.createdAt).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '01/01/26'
      };
    });
  },

  /**
   * Computes summary metrics for a list of rows with strict tenancy scoping.
   */
  calculateMetrics: (rows: any[]): BillingSummaryMetrics => {
    let totalExpected = 0;
    let totalBase = 0;
    let totalCr = 0;
    let totalRecovered = 0;
    let totalOutstanding = 0;
    let totalTDC = 0;
    let totalDC = 0;
    let totalPending = 0;
    let totalPaid = 0;

    rows.forEach(r => {
      const base = Number(r.baseAmount ?? r.base_amount ?? 0) || 0;
      const cr = Number(r.cr ?? 0) || 0;
      const total = Number(r.totalAmount ?? r.total_amount ?? (base + cr)) || 0;
      const rec = Number(r.paymentReceived ?? r.payment_received ?? 0) || 0;
      const status = String(r.paymentStatus ?? r.payment_status ?? 'unpaid').toLowerCase();

      totalBase += base;
      totalCr += cr;
      totalExpected += total;
      totalRecovered += rec;

      if (status === 'tdc') totalTDC++;
      else if (status === 'dc') totalDC++;
      else if (status === 'paid') totalPaid++;
      else totalPending++;

      const pendingBalance = Math.max(0, total - rec);
      totalOutstanding += pendingBalance;
    });

    const recoveryRate = totalExpected > 0 ? (totalRecovered / totalExpected) * 100 : 0;

    return {
      totalExpected,
      totalBase,
      totalCr,
      totalRecovered,
      totalOutstanding,
      totalTDC,
      totalDC,
      totalPending,
      totalPaid,
      activeCustomersCount: rows.length,
      recoveryRate
    };
  }
};
