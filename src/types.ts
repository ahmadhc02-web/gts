/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ComplaintStatus = string;

export type ComplaintCategory = string;

export type ComplaintPriority = string;

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
}

export interface UserProfile {
  uid: string;
  username: string;
  password?: string; // Added for simplified demo auth
  role: 'admin' | 'member';
  createdAt: number;
  lastActive?: number;
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
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  audioUrl?: string;
  type?: 'text' | 'voice';
  recipientId?: string;
  duration?: number;
  replyTo?: {
    id: string;
    text?: string;
    senderName: string;
    type?: 'text' | 'voice';
  };
  createdAt: number;
  seenBy?: Record<string, { username: string; time: number }>;
}

export interface Notification {
  id: string;
  type: 'complaint_created' | 'complaint_updated' | 'complaint_deleted' | 'client_added' | 'client_updated' | 'client_deleted' | 'config_updated' | 'user_created' | 'user_updated' | 'user_deleted';
  message: string;
  authorName: string;
  createdAt: number;
  isRead?: boolean;
  details?: any; // To store associated object data if needed
}
