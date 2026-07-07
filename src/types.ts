/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ComplaintStatus = string;

export type ComplaintCategory = string;

export type ComplaintPriority = string;

export interface ComplaintReview {
  id: string;
  text: string;
  createdAt: number;
  authorId?: string;
  authorName?: string;
}

export interface Complaint {
  id: string;
  memberId: string;
  memberName: string;
  customerName: string;
  customerUsername: string;
  area: string;
  description: string;
  number: string;
  status: ComplaintStatus;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  pkgDetails?: string;
  userNearby?: string;
  panelDetails?: string;
  createdAt: number;
  updatedAt?: number;
  remarks?: string;
  remarkAuthorId?: string;
  remarkAuthorName?: string;
  customerReview?: string; // Deprecated single review field, but kept for database mapping
  reviews?: ComplaintReview[]; // Chronological array of reviews
  dealerId?: string; // Multi-tenancy support
  scheduledAt?: number; // millisecond timestamp
}

export interface UserProfile {
  uid: string;
  username: string;
  password?: string; // Added for simplified demo auth
  role: 'admin' | 'member' | 'dealer' | 'super_admin' | 'liteadmin' | 'editor';
  fullName?: string;
  createdAt: number;
  lastActive?: number;
  dealerId?: string; // For dealers and users created by dealers
  lineCode?: string; // Specific code for dealer identification
  createdBy?: string; // UID of creator
  createdByName?: string; // Name of creator
  companyName?: string; // Dealer company name
  status?: 'active' | 'pending' | 'blocked';
  profilePicture?: string;
  email?: string;
}

export interface Client {
  id: string;
  name: string;
  username: string;
  number: string;
  mobileNumber: string;
  seriesNumber: string;
  area: string;
  pkgDetails: string;
  userNearby: string;
  panelDetails?: string;
  createdBy: string;
  createdAt: number;
  dealerId?: string; // Multi-tenancy support
  lat?: number;
  lng?: number;
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[]; // array of uids
  createdBy: string;
  createdAt: number;
  dealerId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  audioUrl?: string;
  type?: 'text' | 'voice';
  recipientId?: string; // userId or groupId
  isGroup?: boolean;
  duration?: number;
  replyTo?: {
    id: string;
    text?: string;
    senderName: string;
    type?: 'text' | 'voice';
  };
  createdAt: number;
  seenBy?: Record<string, { username: string; time: number }>;
  dealerId?: string; // Multi-tenancy support
}

export interface BrandingConfig {
  id: string;
  projectName: string;
  accentColor: string;
  secondaryColor?: string;
  themeColor: string;
  fontFamily: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  cardStyle?: 'flat' | 'bordered' | 'elevated' | 'glass';
  glassOpacity?: number;
  enableAnimations?: boolean;
  logoUrl?: string;
  sidebarTheme?: 'dark' | 'light' | 'accent' | 'glass';
  mascotPos: { x: number; y: number };
  hideBot?: boolean;
  chatWelcomeMsg?: string;
  dashboardSubtext?: string;
  customNames?: Record<string, string>; // Legacy
  tabNames?: Record<string, string>; // For customizing navigation tabs
  hiddenTabs?: string[]; // Sidebar tabs that should be hidden for all users
  translations?: Record<string, string>; // For global inline text translation mapping
  dashboardStats?: string[]; // Array of stat labels to show in order
  homeSections?: { id: string; visible: boolean; order: number }[]; // For homepage sections (Stats, Charts, Registry)
  updatedAt: number;
  updatedBy: string;
}

export interface Notification {
  id: string;
  type: 'complaint_created' | 'complaint_updated' | 'complaint_deleted' | 'client_added' | 'client_updated' | 'client_deleted' | 'config_updated' | 'user_created' | 'user_updated' | 'user_deleted' | 'recycle_bin';
  message: string;
  authorName: string;
  createdAt: number;
  isRead?: boolean;
  dealerId?: string; // Multi-tenancy support
  details?: any;
}

export interface MonitorTarget {
  id: string;
  domain: string;
  createdBy: string;
  createdAt: any;
  dealerId?: string;
  lat?: number;
  lng?: number;
  label?: string;
}

export interface LedgerTable1Row {
  sr: number;
  cId: string;
  name: string;
  comments: string;
  amount: number;
  ch: boolean;
  originalAmount?: number;
  receiptCode?: string;
}

export interface LedgerTable2Row {
  sr: number;
  name: string;
  amount: number;
  ch: boolean;
}

export interface LedgerSheet {
  id: string;
  recOfficer: string;
  recOfficerLabel: string;
  area: string;
  areaLabel: string;
  sheetDate: string;
  dateLabel: string;
  table1Rows: LedgerTable1Row[];
  table2Rows: LedgerTable2Row[];
  cashReceived: string;
  sign: string;
  submitted: string;
  cashReceivedLabel: string;
  signLabel: string;
  submittedLabel: string;
  footnoteLeft: string;
  footnoteRight: string;
  dealerId: string;
  createdAt: number;
}

