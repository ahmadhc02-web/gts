export const DEFAULT_CATEGORIES = [
  'Fiber Break', 
  'Router Configuration', 
  'Slow Connection', 
  'WiFi Issue', 
  'Billing', 
  'Installation Request',
  'New User Setup',
  'Offline',
  'New Connection',
  'Disconnecting',
  'Shifting',
  'Networking',
  'Redlight',
  'Upgrading'
];

export const DEFAULT_STATUSES = ['pending', 'in process', 'complete', 'important'];

export const DEFAULT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const DEFAULT_ZONES = [
  'Downtown',
  'North Sector',
  'South Sector',
  'West Wing',
  'East Side',
  'Industrial Zone',
  'Suburb A',
  'Suburb B'
];

export interface AppConfig {
  categories: string[];
  statuses: string[];
  priorities: string[];
  zones: string[];
}
