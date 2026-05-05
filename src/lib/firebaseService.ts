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
  onSnapshot,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Identity Integrity check helper
function checkIdentity(uid: string) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('Identity verification failed');
  }
}

export const firebaseService = {
  // --- Users ---
  getUsers: async (): Promise<UserProfile[]> => {
    const path = 'users';
    try {
      const q = collection(db, path);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  getUser: async (uid: string): Promise<UserProfile | null> => {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? snapshot.data() as UserProfile : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  createUser: async (uid: string, username: string, pass: string, role: 'admin' | 'member', authorName?: string): Promise<UserProfile> => {
    const path = `users/${uid}`;
    const newUser: UserProfile = {
      uid,
      username,
      password: pass,
      role,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'users', uid), newUser);
      if (authorName) {
        await firebaseService.createNotification({
          type: 'user_created',
          message: `New identity registered: ${username} (${role.toUpperCase()})`,
          authorName
        });
      }
      return newUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  deleteUser: async (uid: string, authorName: string) => {
    const path = `users/${uid}`;
    try {
      await deleteDoc(doc(db, 'users', uid));
      await firebaseService.createNotification({
        type: 'user_deleted',
        message: `Identity revoked: Access node ${uid} purged`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  updateUserPassword: async (uid: string, newPass: string, authorName: string) => {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { password: newPass });
      await firebaseService.createNotification({
        type: 'user_updated',
        message: `Security credentials updated for user: ${uid}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateUser: async (uid: string, data: Partial<UserProfile>, authorName: string) => {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, data);
      await firebaseService.createNotification({
        type: 'user_created',
        message: `User Profile updated: ${uid}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- Notifications ---
  createNotification: async (data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> => {
    const id = `notif_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const path = `notifications/${id}`;
    const newNotification: Notification = {
      ...data,
      id,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'notifications', id), newNotification);
      return newNotification;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  subscribeNotifications: (callback: (notifications: Notification[]) => void) => {
    const path = 'notifications';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => doc.data() as Notification);
      callback(notifications);
    }, (error) => {
      console.error('Subscription error for notifications:', error instanceof Error ? error.message : String(error));
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // --- Complaints ---
  getComplaints: async (): Promise<Complaint[]> => {
    const path = 'complaints';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Complaint);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    const id = Math.random().toString(36).substr(2, 9);
    const path = `complaints/${id}`;
    const newComplaint: Complaint = {
      ...data,
      id,
      memberId: member.uid,
      memberName: member.username,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'complaints', id), newComplaint);
      await firebaseService.createNotification({
        type: 'complaint_created',
        message: `New registry: ${newComplaint.customerName} - ${newComplaint.category}`,
        authorName: member.username
      });
      return newComplaint;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  deleteComplaint: async (id: string, authorName: string) => {
    const path = `complaints/${id}`;
    try {
      await deleteDoc(doc(db, 'complaints', id));
      await firebaseService.createNotification({
        type: 'complaint_deleted',
        message: `Registry removed: ID ${id}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, authorName: string) => {
    const path = `complaints/${id}`;
    try {
      const complaintRef = doc(db, 'complaints', id);
      await updateDoc(complaintRef, { status });
      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Status updated to ${status.toUpperCase()} for ID ${id}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, authorName: string) => {
    const path = `complaints/${id}`;
    try {
      const complaintRef = doc(db, 'complaints', id);
      await updateDoc(complaintRef, data);
      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Registry modified: ID ${id}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void) => {
    const path = 'complaints';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const complaints = snapshot.docs.map(doc => doc.data() as Complaint);
      callback(complaints);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // --- Config ---
  getSettings: async () => {
    const path = 'config/settings';
    try {
      const docRef = doc(db, 'config', 'settings');
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  subscribeConfig: (callback: (config: any) => void) => {
    const path = 'config/app';
    const docRef = doc(db, 'config', 'app');
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  updateConfig: async (config: any, authorName: string) => {
    const path = 'config/app';
    try {
      await setDoc(doc(db, 'config', 'app'), config);
      await firebaseService.createNotification({
        type: 'config_updated',
        message: `System matrix configuration updated`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- Chat ---
  sendMessage: async (sender: UserProfile, text: string, replyTo?: ChatMessage['replyTo'], recipientId?: string): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const path = `chat/${id}`;
    const now = Date.now();
    const newMessage: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.username,
      text,
      createdAt: now,
      seenBy: {
        [sender.uid]: { username: sender.username, time: now }
      },
      ...(replyTo && { replyTo }),
      ...(recipientId && { recipientId })
    };
    try {
      await setDoc(doc(db, 'chat', id), newMessage);
      return newMessage;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  sendVoiceMessage: async (sender: UserProfile, audioBase64: string, duration: number, replyTo?: ChatMessage['replyTo'], recipientId?: string): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const path = `chat/${id}`;
    const now = Date.now();
    const newMessage: ChatMessage = {
      id,
      senderId: sender.uid,
      senderName: sender.username,
      audioUrl: audioBase64,
      type: 'voice',
      duration,
      createdAt: now,
      seenBy: {
        [sender.uid]: { username: sender.username, time: now }
      },
      ...(replyTo && { replyTo }),
      ...(recipientId && { recipientId })
    };
    try {
      await setDoc(doc(db, 'chat', id), newMessage);
      return newMessage;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  markMessageAsSeen: async (messageId: string, user: UserProfile) => {
    const path = `chat/${messageId}`;
    try {
      const msgRef = doc(db, 'chat', messageId);
      await updateDoc(msgRef, {
        [`seenBy.${user.uid}`]: { username: user.username, time: Date.now() }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteMessage: async (messageId: string) => {
    const path = `chat/${messageId}`;
    try {
      await deleteDoc(doc(db, 'chat', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  clearAllMessages: async () => {
    const path = 'chat';
    try {
      const q = collection(db, path);
      const snapshot = await getDocs(q);
      const batch: Promise<any>[] = [];
      snapshot.docs.forEach(docSnap => {
        batch.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void) => {
    const path = 'chat';
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  getClients: async (): Promise<Client[]> => {
    const path = 'clients';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Client);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string): Promise<Client> => {
    const id = Math.random().toString(36).substr(2, 9);
    const path = `clients/${id}`;
    const newClient: Client = {
      ...data,
      id,
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'clients', id), newClient);
      await firebaseService.createNotification({
        type: 'client_added',
        message: `New client added to registry: ${newClient.name}`,
        authorName
      });
      return newClient;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  updateClient: async (id: string, data: Partial<Client>, authorName: string) => {
    const path = `clients/${id}`;
    try {
      const clientRef = doc(db, 'clients', id);
      await updateDoc(clientRef, data);
      await firebaseService.createNotification({
        type: 'client_updated',
        message: `Client record modified: ID ${id}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteClient: async (id: string, authorName: string) => {
    const path = `clients/${id}`;
    try {
      await deleteDoc(doc(db, 'clients', id));
      await firebaseService.createNotification({
        type: 'client_deleted',
        message: `Client record removed: ID ${id}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeClients: (callback: (clients: Client[]) => void) => {
    const path = 'clients';
    const q = query(collection(db, path));
    
    return onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(doc => ({ ...doc.data() as Client }));
      // Robust in-memory sort to avoid composite index requirement
      clients.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(clients);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  }
};
