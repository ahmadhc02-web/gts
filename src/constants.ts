export const DEFAULT_CATEGORIES: string[] = [];

export const DEFAULT_STATUSES = ['pending', 'in process', 'scheduled', 'complete', 'important'];

export const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const DEFAULT_ZONES = [
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
