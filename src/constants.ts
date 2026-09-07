export const DEFAULT_CATEGORIES: string[] = [
  'Speed Issue',
  'No Internet',
  'Wire Damage',
  'Router / ONT Problem',
  'High Ping / Packet Loss',
  'Billing Issue',
  'Other'
];

export const DEFAULT_STATUSES = ['pending', 'in process', 'customer reviews', 'scheduled', 'complete', 'important'];

export const PERMANENT_WORKFLOW_STATUSES = ['pending', 'in process', 'customer reviews', 'complete'];

export const isPermanentWorkflowStatus = (status: string): boolean => {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === 'pending' ||
    s === 'in process' ||
    s === 'customer reviews' ||
    s === 'customer review' ||
    s === 'costumer review' ||
    s === 'costumer reviews' ||
    s === 'complete'
  );
};

export const ensurePermanentStatuses = (statuses?: string[]): string[] => {
  const list = Array.isArray(statuses) && statuses.length > 0 ? [...statuses] : [...DEFAULT_STATUSES];
  
  if (!list.some(s => s.trim().toLowerCase() === 'pending')) {
    list.unshift('pending');
  }
  
  if (!list.some(s => s.trim().toLowerCase() === 'in process')) {
    const pIdx = list.findIndex(s => s.trim().toLowerCase() === 'pending');
    list.splice(pIdx >= 0 ? pIdx + 1 : 1, 0, 'in process');
  }

  if (!list.some(s => {
    const norm = s.trim().toLowerCase();
    return norm === 'customer reviews' || norm === 'customer review' || norm === 'costumer review' || norm === 'costumer reviews';
  })) {
    const ipIdx = list.findIndex(s => s.trim().toLowerCase() === 'in process');
    list.splice(ipIdx >= 0 ? ipIdx + 1 : 2, 0, 'customer reviews');
  }

  if (!list.some(s => s.trim().toLowerCase() === 'complete')) {
    list.push('complete');
  }

  return list;
};

export const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const DEFAULT_ZONES = [
  'TB',
  'Model Town',
  'Gulberg',
  'Satellite Town',
  'Ghosia Chowk',
  'Railway Road',
  'Kutchery Road',
  'Jinnah Park',
  'Commercial Area',
  'Chak 10 NP',
  'Manthar Road',
  'Ahmedpur Road',
  'Mochi Wali Street'
];

export interface AppConfig {
  categories: string[];
  statuses: string[];
  priorities: string[];
  zones: string[];
  billingSecurityKey?: string;
}

export const DEFAULT_BRANDING = {
  projectName: "Green Tech Services",
  accentColor: "#3b82f6",
  themeColor: "#0f172a",
  fontFamily: "Lexend, sans-serif",
  mascotPos: { x: 4, y: 88 },
  chatWelcomeMsg: "Welcome to the Tactical Response Hub. How can I assist you today?",
  dashboardSubtext: "GTS Tactical Command & Response Matrix",
  hiddenTabs: [],
  homeSections: [],
  tabNames: {},
  customNames: {},
  dashboardStats: []
};
