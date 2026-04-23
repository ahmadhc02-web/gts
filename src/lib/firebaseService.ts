import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Complaint, UserProfile, ComplaintStatus } from '../types';

export const firebaseService = {
  // --- Users ---
  getUsers: async (): Promise<UserProfile[]> => {
    const q = collection(db, 'users');
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    const docRef = doc(db, 'users', uid);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() as UserProfile : null;
  },

  createUser: async (uid: string, username: string, pass: string, role: 'admin' | 'member'): Promise<UserProfile> => {
    const newUser: UserProfile = {
      uid,
      username,
      password: pass, // For demo purposes, we still store this in the profile
      role,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'users', uid), newUser);
    return newUser;
  },

  deleteUser: async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid));
  },

  updateUserPassword: async (uid: string, newPass: string) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { password: newPass });
  },

  // --- Complaints ---
  getComplaints: async (): Promise<Complaint[]> => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Complaint);
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    const id = Math.random().toString(36).substr(2, 9);
    const newComplaint: Complaint = {
      ...data,
      id,
      memberId: member.uid,
      memberName: member.username,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'complaints', id), newComplaint);
    return newComplaint;
  },

  deleteComplaint: async (id: string) => {
    await deleteDoc(doc(db, 'complaints', id));
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus) => {
    const complaintRef = doc(db, 'complaints', id);
    await updateDoc(complaintRef, { status });
  },

  // --- Config ---
  getSettings: async () => {
    const docRef = doc(db, 'config', 'settings');
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() : null;
  }
};
