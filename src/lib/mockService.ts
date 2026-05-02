import { Complaint, UserProfile, ComplaintStatus } from '../types';
import { safeStringify } from './utils';

// Simple persistence helper for mock environment
const storage = {
  get: (key: string, fallback: any) => {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  },
  set: (key: string, val: any) => {
    localStorage.setItem(key, safeStringify(val));
  }
};

let mockComplaints: Complaint[] = storage.get('gts_complaints', []);
let mockUsers: UserProfile[] = storage.get('gts_users', [
  { uid: 'admin-id', username: 'admin', password: 'admin', role: 'admin', createdAt: Date.now() }
]);

export const mockService = {
  getComplaints: async () => [...mockComplaints],
  getUsers: async () => [...mockUsers],
  
  createComplaint: async (data: any, member: any) => {
    const newComplaint: Complaint = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      memberId: member.uid,
      memberName: member.username,
      createdAt: Date.now()
    };
    mockComplaints = [newComplaint, ...mockComplaints];
    storage.set('gts_complaints', mockComplaints);
    return newComplaint;
  },

  deleteComplaint: async (id: string) => {
    mockComplaints = mockComplaints.filter(c => c.id !== id);
    storage.set('gts_complaints', mockComplaints);
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus) => {
    mockComplaints = mockComplaints.map(c => c.id === id ? { ...c, status } : c);
    storage.set('gts_complaints', mockComplaints);
  },

  createUser: async (username: string, pass: string, role: 'admin' | 'member') => {
    const newUser: UserProfile = {
      uid: Math.random().toString(36).substr(2, 9),
      username,
      password: pass,
      role,
      createdAt: Date.now()
    };
    mockUsers = [...mockUsers, newUser];
    storage.set('gts_users', mockUsers);
    return newUser;
  },

  deleteUser: async (uid: string) => {
    mockUsers = mockUsers.filter(u => u.uid !== uid);
    storage.set('gts_users', mockUsers);
  },
  
  updateAdminPassword: async (newPass: string) => {
    mockUsers = mockUsers.map(u => u.role === 'admin' ? { ...u, password: newPass } : u);
    storage.set('gts_users', mockUsers);
  }
};
