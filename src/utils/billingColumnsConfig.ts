import { safeLocalStorage } from '../lib/safeLocalStorage';

export interface BillingColumnDef {
  id: string;
  label: string;
  subLabel?: string;
  category: 'core' | 'financial' | 'advance';
  description: string;
}

export const BILLING_COLUMNS_LIST: BillingColumnDef[] = [
  { id: 'sr', label: 'Sr#', subLabel: 'Serial Number (نمبر شمار)', category: 'core', description: 'Row index sequence counter' },
  { id: 'name', label: 'FULL NAME', subLabel: 'Customer Full Name (گاہک کا پورا نام)', category: 'core', description: 'Primary subscriber title & name' },
  { id: 'username', label: 'USER ID (PPPoE)', subLabel: 'PPPoE Username / Login (یوزر آئی ڈی)', category: 'core', description: 'Unique network access credential' },
  { id: 'mobile', label: 'MOBILE #', subLabel: 'Contact Phone Number (موبائل نمبر)', category: 'core', description: 'Primary contact for WhatsApp & billing alerts' },
  { id: 'panelDetails', label: 'PANEL DETAILS', subLabel: 'Hardware / AP / Substation (پینل تفصیلات)', category: 'core', description: 'Network distribution panel or AP identifier' },
  { id: 'area', label: 'AREA', subLabel: 'Locality / Sector (علاقہ / سیکٹر)', category: 'core', description: 'Geographical routing sector' },
  { id: 'rt', label: 'RT', subLabel: 'Route / Tag Code (روٹ کوڈ)', category: 'core', description: 'Route tag or collector identifier' },
  { id: 'baseAmount', label: 'B. AMOUNT', subLabel: 'Base Monthly Rate (ماہانہ بنیادی بل)', category: 'financial', description: 'Standard recurring monthly package fees' },
  { id: 'cr', label: 'CR. (ARREARS)', subLabel: 'Outstanding Balance (بقایا جات)', category: 'financial', description: 'Previous months unpaid overdue balances' },
  { id: 'totalAmount', label: 'T. AMOUNT', subLabel: 'Total Payable (کل رقم)', category: 'financial', description: 'Gross payable sum (Base Amount + CR Arrears)' },
  { id: 'billingDay', label: 'BD', subLabel: 'Billing Day of Month (بلنگ تاریخ)', category: 'financial', description: 'Day of the month for invoice due date' },
  { id: 'paymentReceived', label: 'RECOVERY', subLabel: 'Payment Collected (ریکوری رقم)', category: 'financial', description: 'Cash collected / received for this period' },
  { id: 'paymentStatus', label: 'STATUS', subLabel: 'Payment Status (ادائیگی صورتحال)', category: 'financial', description: 'Paid, Unpaid, Partial, TDC, DC classification' },
  { id: 'comments', label: 'COMMENTS', subLabel: 'Notes & Remarks (نوٹس اور ریمارکس)', category: 'advance', description: 'Special collection remarks and customer notes' },
  { id: 'occupation', label: 'OCCUPATION', subLabel: 'Profession (پیشہ)', category: 'advance', description: 'Customer employment or business nature' },
  { id: 'pkg', label: 'PKG DETAILS', subLabel: 'Package Speed / Plan (پیکیج تفصیل)', category: 'advance', description: 'Bandwidth plan & package speed specification' },
  { id: 'date', label: 'DATE', subLabel: 'Connection Date (کنکشن تاریخ)', category: 'advance', description: 'Service installation or activation date' },
  { id: 'device', label: 'DEVICE', subLabel: 'Device Price (ڈیوائس قیمت)', category: 'advance', description: 'Customer-premises hardware device cost' },
  { id: 'abl', label: 'ABL', subLabel: 'Additional Bill / Ledger (اضافی چارجز)', category: 'advance', description: 'Extra cabling or installation balance' },
  { id: 'act', label: 'ACT', subLabel: 'Actions / WhatsApp (ایکشن / واٹس ایپ)', category: 'advance', description: 'WhatsApp dispatch shortcut and row controls' }
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
