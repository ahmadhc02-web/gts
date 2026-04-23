/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ComplaintStatus = 'pending' | 'in process' | 'complete' | 'important';

export interface Complaint {
  id: string;
  memberId: string;
  memberName: string;
  customerName: string;
  area: string;
  description: string;
  number: string;
  status: ComplaintStatus;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  username: string;
  password?: string; // Added for simplified demo auth
  role: 'admin' | 'member';
  createdAt: number;
}
