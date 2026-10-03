import { safeLocalStorage } from '../lib/safeLocalStorage';

export interface BillingColumnDef {
  id: string;
  label: string;
  subLabel?: string;
  category: 'core' | 'financial' | 'advance';
  description: string;
}

export const BILLING_COLUMNS_LIST: BillingColumnDef[] = [
  { id: 'sr', label: 'Sr#', subLabel: 'Serial Number', category: 'core', description: 'Row index sequence counter' },
  { id: 'name', label: 'FULL NAME', subLabel: 'Customer Full Name', category: 'core', description: 'Primary subscriber title & name' },
  { id: 'username', label: 'USER ID (PPPoE)', subLabel: 'PPPoE Username / Login', category: 'core', description: 'Unique network access credential' },
  { id: 'mobile', label: 'MOBILE #', subLabel: 'Contact Phone Number', category: 'core', description: 'Primary contact for WhatsApp & billing alerts' },
  { id: 'panelDetails', label: 'PANEL DETAILS', subLabel: 'Hardware / AP / Substation', category: 'core', description: 'Network distribution panel or AP identifier' },
  { id: 'area', label: 'AREA', subLabel: 'Locality / Sector', category: 'core', description: 'Geographical routing sector' },
  { id: 'rt', label: 'RT', subLabel: 'Route / Tag Code', category: 'core', description: 'Route tag or collector identifier' },
  { id: 'baseAmount', label: 'B. AMOUNT', subLabel: 'Base Monthly Rate', category: 'financial', description: 'Standard recurring monthly package fees' },
  { id: 'cr', label: 'CR. (ARREARS)', subLabel: 'Outstanding Balance (Arrears)', category: 'financial', description: 'Previous months unpaid overdue balances' },
  { id: 'totalAmount', label: 'T. AMOUNT', subLabel: 'Total Payable Amount', category: 'financial', description: 'Gross payable sum (Base Amount + CR Arrears)' },
  { id: 'billingDay', label: 'BD', subLabel: 'Billing Due Day', category: 'financial', description: 'Day of the month for invoice due date' },
  { id: 'paymentReceived', label: 'RECOVERY', subLabel: 'Payment Collected / Received', category: 'financial', description: 'Cash collected / received for this period' },
  { id: 'paymentStatus', label: 'STATUS', subLabel: 'Payment Status', category: 'financial', description: 'Paid, Unpaid, Partial, TDC, DC classification' },
  { id: 'comments', label: 'COMMENTS', subLabel: 'Notes & Remarks', category: 'advance', description: 'Special collection remarks and customer notes' },
  { id: 'occupation', label: 'OCCUPATION', subLabel: 'Profession / Occupation', category: 'advance', description: 'Customer employment or business nature' },
  { id: 'pkg', label: 'PKG DETAILS', subLabel: 'Package Speed / Plan Details', category: 'advance', description: 'Bandwidth plan & package speed specification' },
  { id: 'date', label: 'DATE', subLabel: 'Service Connection Date', category: 'advance', description: 'Service installation or activation date' },
  { id: 'device', label: 'DEVICE', subLabel: 'Device Cost / Hardware Price', category: 'advance', description: 'Customer-premises hardware device cost' },
  { id: 'abl', label: 'ABL', subLabel: 'Additional Bill / Ledger', category: 'advance', description: 'Extra cabling or installation balance' },
  { id: 'act', label: 'ACT', subLabel: 'Actions & WhatsApp Dispatch', category: 'advance', description: 'WhatsApp dispatch shortcut and row controls' }
];

export type BillingColumnVisibilityMap = Record<string, boolean>;

export const DEFAULT_BILLING_COLUMN_VISIBILITY: BillingColumnVisibilityMap = {
  sr: true,
  name: true,
  username: true,
  mobile: true,
  panelDetails: true,
  area: true,
  rt: true,
  baseAmount: true,
  cr: true,
  totalAmount: true,
  billingDay: true,
  paymentReceived: true,
  paymentStatus: true,
  comments: true,
  occupation: true,
  pkg: true,
  date: true,
  device: true,
  abl: true,
  act: true
};

const STORAGE_KEY = 'billing_mod_columns_visibility_v1';
const EVENT_NAME = 'billing_mod_columns_changed';

export function getBillingColumnVisibility(): BillingColumnVisibilityMap {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_BILLING_COLUMN_VISIBILITY, ...parsed };
      }
    }
  } catch (e) {
    console.warn('[BillingColumnsConfig] Error loading column visibility:', e);
  }
  return { ...DEFAULT_BILLING_COLUMN_VISIBILITY };
}

export function saveBillingColumnVisibility(vis: BillingColumnVisibilityMap): void {
  try {
    const updated = { ...DEFAULT_BILLING_COLUMN_VISIBILITY, ...vis };
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
    }
  } catch (e) {
    console.error('[BillingColumnsConfig] Error saving column visibility:', e);
  }
}

export function resetBillingColumnVisibility(): BillingColumnVisibilityMap {
  const defaults = { ...DEFAULT_BILLING_COLUMN_VISIBILITY };
  saveBillingColumnVisibility(defaults);
  return defaults;
}

export interface BillingStatusDef {
  id: 'paid' | 'unpaid' | 'partial' | 'tdc' | 'dc' | 'extra';
  label: string;
  badge: string;
  description: string;
  colorClass: string;
}

export const BILLING_STATUSES_LIST: BillingStatusDef[] = [
  { id: 'paid', label: 'PAID', badge: 'Paid', description: 'Fully settled payments for the billing cycle', colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'unpaid', label: 'UNPAID', badge: 'Unpaid', description: 'Pending dues with zero payment received', colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'partial', label: 'PARTIAL', badge: 'Partial', description: 'Partially settled balances with remaining dues', colorClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'tdc', label: 'TDC', badge: 'Temporary DC', description: 'Temporarily disconnected subscriber accounts', colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { id: 'dc', label: 'DC', badge: 'Permanent DC', description: 'Permanently disconnected subscriber accounts', colorClass: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/30' },
  { id: 'extra', label: 'EXTRA', badge: 'Unspecified', description: 'Custom unlinked or manual ledger entries', colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30' },
];

export type BillingStatusVisibilityMap = {
  paid: boolean;
  unpaid: boolean;
  partial: boolean;
  tdc: boolean;
  dc: boolean;
  extra: boolean;
};

export const DEFAULT_BILLING_STATUS_VISIBILITY: BillingStatusVisibilityMap = {
  paid: true,
  unpaid: true,
  partial: true,
  tdc: true,
  dc: true,
  extra: true,
};

const STATUS_STORAGE_KEY = 'billing_mod_status_visibility_v1';
const STATUS_EVENT_NAME = 'billing_mod_status_visibility_changed';

export function getBillingStatusVisibility(): BillingStatusVisibilityMap {
  try {
    const raw = safeLocalStorage.getItem(STATUS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_BILLING_STATUS_VISIBILITY, ...parsed };
      }
    }
  } catch (e) {
    console.warn('[BillingColumnsConfig] Error loading status visibility:', e);
  }
  return { ...DEFAULT_BILLING_STATUS_VISIBILITY };
}

export function saveBillingStatusVisibility(vis: BillingStatusVisibilityMap): void {
  try {
    const updated = { ...DEFAULT_BILLING_STATUS_VISIBILITY, ...vis };
    safeLocalStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STATUS_EVENT_NAME, { detail: updated }));
    }
  } catch (e) {
    console.error('[BillingColumnsConfig] Error saving status visibility:', e);
  }
}

export function resetBillingStatusVisibility(): BillingStatusVisibilityMap {
  const defaults = { ...DEFAULT_BILLING_STATUS_VISIBILITY };
  saveBillingStatusVisibility(defaults);
  return defaults;
}

export function subscribeToBillingColumnVisibility(callback: (vis: BillingColumnVisibilityMap) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<BillingColumnVisibilityMap>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getBillingColumnVisibility());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}

export function subscribeToBillingStatusVisibility(callback: (vis: BillingStatusVisibilityMap) => void): () => void {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<BillingStatusVisibilityMap>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getBillingStatusVisibility());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(STATUS_EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(STATUS_EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}
