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
  getDocFromServer,
  or,
  and,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Complaint, UserProfile, ComplaintStatus, ChatMessage, Client, Notification, ChatGroup } from '../types';
import { safeStringify } from './utils';

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
  // Ensure we only extract string values for the error
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    try {
      errorMessage = String(error);
    } catch (e) {
      errorMessage = 'Error object could not be stringified';
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId || null,
        email: provider.email || null,
      })) || []
    },
    operationType,
    path
  }

  let serializedErr: string;
  try {
    serializedErr = safeStringify(errInfo);
  } catch (stringifyError) {
    // Ultimate fallback if even the safeStringify fails (shouldn't happen now)
    serializedErr = `{ "error": "${errorMessage.replace(/"/g, '\\"')}", "note": "ultimate_fallback" }`;
  }

  console.error('Firestore Error Detailed: ', serializedErr);
  throw new Error(serializedErr);
}

// Identity Integrity check helper
function checkIdentity(uid: string) {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('Identity verification failed');
  }
}

// Utility to remove undefined keys from an object (Firestore doesn't like undefined)
function sanitize<T>(obj: T): T {
  const result: any = {};
  Object.keys(obj as any).forEach((key) => {
    const value = (obj as any)[key];
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
}

export const firebaseService = {
  testConnection: async () => {
    try {
      await getDocFromServer(doc(db, 'config', 'app'));
      console.log('Firebase connection verified');
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  },

  // Helper to get effect dealer ID for multi-tenancy
  getTenantId: (user: UserProfile) => {
    if (user.role === 'dealer') return user.uid;
    return user.dealerId || 'main'; // Write tenant ID
  },
  
  getReadTenantId: (user: UserProfile) => {
    if (user.role === 'super_admin') return undefined;
    if (user.role === 'dealer') return user.uid;
    return user.dealerId || 'main';
  },

  // Utility to ensure auth is ready before performing operations
  waitForAuth: async (): Promise<any> => {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      });
      // Also check immediate current user
      if (auth.currentUser) {
        unsubscribe();
        resolve(auth.currentUser);
      }
    });
  },

  // --- Users ---
  getUsers: async (dealerId?: string): Promise<UserProfile[]> => {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      let users = snapshot.docs.map(doc => doc.data() as UserProfile);
      
      if (dealerId && dealerId !== 'main') {
        users = users.filter(u => u.dealerId === dealerId || u.uid === dealerId);
      } else if (dealerId === 'main') {
        users = users.filter(u => !u.dealerId || u.dealerId === 'main');
      }
      
      return users;
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

  getNetworkOwnerByLineCode: async (lineCode: string): Promise<UserProfile | null> => {
    const path = 'users';
    try {
      const snapshot = await getDocs(collection(db, path));
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      return users.find(u => u.lineCode === lineCode) || null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  createUser: async (uid: string, username: string, pass: string, role: UserProfile['role'], authorId?: string, authorName?: string, dealerId: string = 'main', lineCode?: string, companyName?: string): Promise<UserProfile> => {
    const path = `users/${uid}`;
    const newUser: any = {
      uid,
      username,
      password: pass,
      role,
      createdAt: serverTimestamp(),
      dealerId,
      createdBy: authorId,
      createdByName: authorName,
      ...(lineCode && { lineCode }),
      ...(companyName && { companyName })
    };
    try {
      await setDoc(doc(db, 'users', uid), newUser);
      if (authorName) {
        await firebaseService.createNotification({
          type: 'user_created',
          message: `New identity registered: ${username} (${role.toUpperCase()})`,
          authorName,
          dealerId
        });
      }
      return newUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  deleteUser: async (uid: string, username: string, authorName: string) => {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() as UserProfile | undefined;

      if (userData && userData.role === 'dealer') {
        const dealerId = uid;
        const collectionsToDelete = ['users', 'complaints', 'clients', 'groups', 'chat', 'notifications'];

        for (const collName of collectionsToDelete) {
          const q = query(collection(db, collName), where('dealerId', '==', dealerId));
          const snap = await getDocs(q);
          
          const docs = snap.docs;
          // Process in batches of 400 to stay well within the 500 limit
          for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 400);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // Use standard delete for the user itself to be safe
        await deleteDoc(userRef);
      } else {
        // Just delete the single user if not a dealer
        await deleteDoc(userRef);
      }

      await firebaseService.createNotification({
        type: 'user_deleted',
        message: `Identity revoked: Access node for "${username}" purged`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  updateUserPassword: async (uid: string, username: string, newPass: string, authorName: string) => {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { password: newPass });
      await firebaseService.createNotification({
        type: 'user_updated',
        message: `Security credentials updated for user: ${username}`,
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
      const cleanData = sanitize(data);
      await updateDoc(userRef, cleanData);
      await firebaseService.createNotification({
        type: 'user_created',
        message: `User Profile updated: ${data.username || uid}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateUserPresence: async (uid: string) => {
    const path = `users/${uid}`;
    try {
      // Don't wait for auth here, just skip if not ready
      if (!auth.currentUser) return;
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { lastActive: Date.now() });
    } catch (error) {
      // Fail silently for presence to avoid noise
    }
  },

  setTypingStatus: async (uid: string, username: string, isTyping: boolean, fullName?: string) => {
    const path = `typing/${uid}`;
    try {
      if (!auth.currentUser) return;
      if (isTyping) {
        await setDoc(doc(db, 'typing', uid), {
          uid,
          username,
          fullName,
          timestamp: Date.now()
        });
      } else {
        await deleteDoc(doc(db, 'typing', uid));
      }
    } catch (error) {
      // Fail silently
    }
  },

  subscribeTypingStatus: (callback: (typingUsers: { uid: string, username: string, fullName?: string }[]) => void) => {
    const path = 'typing';
    const q = collection(db, path);
    return onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const typing = snapshot.docs
        .map(doc => doc.data() as { uid: string, username: string, fullName?: string, timestamp: number })
        // Filter out stale typing indicators (older than 10 seconds)
        .filter(t => now - t.timestamp < 10000)
        .map(t => ({ uid: t.uid, username: t.username, fullName: t.fullName }));
      callback(typing);
    }, (error) => {
      // Fail silently for typing
    });
  },

  subscribeUsers: (callback: (users: UserProfile[]) => void, dealerId?: string) => {
    const path = 'users';
    return onSnapshot(collection(db, path), (snapshot) => {
      let users = snapshot.docs.map(doc => doc.data() as UserProfile);
      
      if (dealerId && dealerId !== 'main') {
        users = users.filter(u => u.dealerId === dealerId || u.uid === dealerId);
      } else if (dealerId === 'main') {
        users = users.filter(u => !u.dealerId || u.dealerId === 'main');
      }
      
      callback(users);
    }, (error) => {
      // Only handle error if we ARE signed in
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  // --- Notifications ---
  createNotification: async (data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> => {
    const id = `notif_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const path = `notifications/${id}`;
    
    // Clean potential undefined values
    const cleanData = sanitize(data);
    
    const newNotification: any = {
      ...cleanData,
      id,
      createdAt: serverTimestamp(),
      isRead: false,
      dealerId: data.dealerId || 'main'
    };
    
    try {
      await setDoc(doc(db, 'notifications', id), newNotification);
      return newNotification;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  clearAllNotifications: async (dealerId?: string) => {
    const path = 'notifications';
    try {
      const snapshot = await getDocs(collection(db, path));
      const batch: Promise<any>[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!dealerId || data.dealerId === dealerId) {
          batch.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeNotifications: (callback: (notifications: Notification[]) => void, dealerId?: string) => {
    const path = 'notifications';
    return onSnapshot(collection(db, path), (snapshot) => {
      let notifications = snapshot.docs.map(doc => doc.data() as Notification);
      
      if (dealerId && dealerId !== 'main') {
        notifications = notifications.filter(n => n.dealerId === dealerId);
      } else if (dealerId === 'main') {
        notifications = notifications.filter(n => !n.dealerId || n.dealerId === 'main');
      }
      
      callback(notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, (error) => {
      // Only report if we are supposed to be signed in
      if (auth.currentUser) {
        console.error('Subscription error for notifications:', error instanceof Error ? error.message : String(error));
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  // --- Complaints ---
  getComplaints: async (dealerId?: string): Promise<Complaint[]> => {
    const path = 'complaints';
    try {
      const snapshot = await getDocs(collection(db, path));
      let complaints = snapshot.docs.map(doc => doc.data() as Complaint);
      
      if (dealerId && dealerId !== 'main') {
        complaints = complaints.filter(c => c.dealerId === dealerId);
      } else if (dealerId === 'main') {
        complaints = complaints.filter(c => !c.dealerId || c.dealerId === 'main');
      }
      
      return complaints.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  createComplaint: async (data: any, member: UserProfile): Promise<Complaint> => {
    const id = Math.random().toString(36).substr(2, 9);
    const path = `complaints/${id}`;
    
    const tenantId = firebaseService.getTenantId(member);
    
    const newComplaint: any = sanitize({
      ...data,
      id,
      memberId: member.uid,
      memberName: member.fullName || member.username,
      createdAt: serverTimestamp(),
      dealerId: tenantId
    });
    try {
      await setDoc(doc(db, 'complaints', id), newComplaint);
      await firebaseService.createNotification({
        type: 'complaint_created',
        message: `New registry: ${newComplaint.customerName} - ${newComplaint.category}`,
        authorName: member.fullName || member.username,
        details: newComplaint,
        dealerId: tenantId || undefined
      });
      return newComplaint;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  deleteComplaint: async (id: string, customerName: string, authorName: string) => {
    const path = `complaints/${id}`;
    try {
      await deleteDoc(doc(db, 'complaints', id));
      await firebaseService.createNotification({
        type: 'complaint_deleted',
        message: `Registry removed: "${customerName}" protocol terminated`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  updateComplaintStatus: async (id: string, status: ComplaintStatus, customerName: string, authorName: string, authorId: string, remarks?: string) => {
    const path = `complaints/${id}`;
    try {
      const complaintRef = doc(db, 'complaints', id);
      const updateData: any = { status, updatedAt: Date.now() };
      if (remarks) {
        updateData.remarks = remarks;
        updateData.remarkAuthorId = authorId;
        updateData.remarkAuthorName = authorName;
      }
      
      await updateDoc(complaintRef, updateData);
      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Status updated to ${status.toUpperCase()} for "${customerName}"${remarks ? ` - Remarks: ${remarks}` : ''}`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateComplaintRemarks: async (id: string, remarks: string, customerName: string, authorName: string, authorId: string) => {
    const path = `complaints/${id}`;
    try {
      const complaintRef = doc(db, 'complaints', id);
      const updateData = { 
        remarks, 
        remarkAuthorId: authorId, 
        remarkAuthorName: authorName,
        updatedAt: Date.now() 
      };
      
      await updateDoc(complaintRef, updateData);
      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Protocol remarks revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updateComplaint: async (id: string, data: Partial<Complaint>, customerName: string, authorName: string) => {
    const path = `complaints/${id}`;
    try {
      const complaintRef = doc(db, 'complaints', id);
      const cleanData = sanitize(data);
      await updateDoc(complaintRef, cleanData);
      await firebaseService.createNotification({
        type: 'complaint_updated',
        message: `Registry modified: Data revised for "${customerName}"`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void, dealerId?: string) => {
    const path = 'complaints';
    return onSnapshot(collection(db, path), (snapshot) => {
      let complaints = snapshot.docs.map(doc => doc.data() as Complaint);
      
      if (dealerId && dealerId !== 'main') {
        complaints = complaints.filter(c => c.dealerId === dealerId);
      } else if (dealerId === 'main') {
        complaints = complaints.filter(c => !c.dealerId || c.dealerId === 'main');
      }
      
      callback(complaints.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
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

  subscribeConfig: (callback: (config: any) => void, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app' : tenantId;
    const path = `config/${docId}`;
    const docRef = doc(db, 'config', docId);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        callback(null);
      }
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    });
  },

  updateConfig: async (config: any, authorName: string, tenantId: string = 'main') => {
    const docId = tenantId === 'main' ? 'app' : tenantId;
    const path = `config/${docId}`;
    try {
      // Clean config object
      const cleanConfig = sanitize(config);
      await setDoc(doc(db, 'config', docId), cleanConfig);
      await firebaseService.createNotification({
        type: 'config_updated',
        message: `System matrix configuration updated`,
        authorName,
        dealerId: tenantId === 'main' ? undefined : tenantId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- Chat ---
  sendMessage: async (sender: UserProfile, text: string, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const path = `chat/${id}`;
    const now = serverTimestamp();
    const clientNow = Date.now();
    
    const tenantId = firebaseService.getTenantId(sender);
    
    const newMessage: any = sanitize({
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      text,
      createdAt: now,
      seenBy: {
        [sender.uid]: { username: sender.fullName || sender.username, time: clientNow }
      },
      replyTo,
      recipientId,
      isGroup,
      dealerId: tenantId
    } as any);

    try {
      await setDoc(doc(db, 'chat', id), newMessage);
      return newMessage;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  sendVoiceMessage: async (sender: UserProfile, audioBase64: string, duration: number, replyTo?: ChatMessage['replyTo'], recipientId?: string, isGroup?: boolean): Promise<ChatMessage> => {
    const id = `msg_${Math.random().toString(36).substr(2, 12)}`;
    const path = `chat/${id}`;
    const now = serverTimestamp();
    const clientNow = Date.now();
    
    const tenantId = firebaseService.getTenantId(sender);

    const newMessage: any = sanitize({
      id,
      senderId: sender.uid,
      senderName: sender.fullName || sender.username,
      audioUrl: audioBase64,
      type: 'voice',
      duration,
      createdAt: now,
      seenBy: {
        [sender.uid]: { username: sender.fullName || sender.username, time: clientNow }
      },
      replyTo,
      recipientId,
      isGroup,
      dealerId: tenantId
    } as any);

    try {
      await setDoc(doc(db, 'chat', id), newMessage);
      return newMessage;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  createGroup: async (name: string, members: string[], creator: UserProfile): Promise<ChatGroup> => {
    const id = `group_${Math.random().toString(36).substr(2, 9)}`;
    const path = `groups/${id}`;
    const tenantId = firebaseService.getTenantId(creator);

    const newGroup: any = {
      id,
      name,
      members: Array.from(new Set([...members, creator.uid])),
      createdBy: creator.uid,
      createdAt: serverTimestamp(),
      dealerId: tenantId
    };

    try {
      await setDoc(doc(db, 'groups', id), newGroup);
      return newGroup;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  subscribeGroups: (callback: (groups: ChatGroup[]) => void, userId: string, dealerId?: string) => {
    const path = 'groups';
    const q = query(collection(db, path), where('members', 'array-contains', userId));
    
    return onSnapshot(q, (snapshot) => {
      let groups = snapshot.docs.map(doc => doc.data() as ChatGroup);
      
      if (dealerId) {
        if (dealerId === 'main') {
          groups = groups.filter(g => !g.dealerId || g.dealerId === 'main');
        } else {
          groups = groups.filter(g => g.dealerId === dealerId);
        }
      }
      
      callback(groups);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  },

  markAsSeen: async (messageId: string, uid: string, username: string) => {
    const path = `chat/${messageId}`;
    try {
      const msgRef = doc(db, 'chat', messageId);
      await updateDoc(msgRef, {
        [`seenBy.${uid}`]: { username, time: Date.now() }
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

  clearAllMessages: async (dealerId?: string) => {
    const path = 'chat';
    try {
      const snapshot = await getDocs(collection(db, path));
      const batch: Promise<any>[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!dealerId || data.dealerId === dealerId) {
          batch.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    const path = `groups/${groupId}`;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  clearMessagesByScope: async (userId: string, scopeId: string, isGroup: boolean) => {
    const path = 'chat';
    try {
      const snapshot = await getDocs(collection(db, path));
      const batch: Promise<any>[] = [];
      snapshot.docs.forEach(docSnap => {
        const msg = docSnap.data() as ChatMessage;
        const matches = isGroup 
          ? (msg.isGroup && msg.recipientId === scopeId)
          : (!msg.isGroup && (
              (msg.senderId === userId && msg.recipientId === scopeId) ||
              (msg.senderId === scopeId && msg.recipientId === userId)
            ));
        
        if (matches) {
          batch.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeMessages: (callback: (messages: ChatMessage[]) => void, dealerId?: string) => {
    const path = 'chat';
    return onSnapshot(collection(db, path), (snapshot) => {
      let messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
      
      if (dealerId && dealerId !== 'main') {
        messages = messages.filter(m => m.dealerId === dealerId);
      } else if (dealerId === 'main') {
        messages = messages.filter(m => !m.dealerId || m.dealerId === 'main');
      }
      
      callback(messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    });
  },

  getClients: async (dealerId?: string): Promise<Client[]> => {
    const path = 'clients';
    try {
      const snapshot = await getDocs(collection(db, path));
      let clients = snapshot.docs.map(doc => doc.data() as Client);
      
      if (dealerId && dealerId !== 'main') {
        clients = clients.filter(c => c.dealerId === dealerId);
      } else if (dealerId === 'main') {
        clients = clients.filter(c => !c.dealerId || c.dealerId === 'main');
      }
      
      return clients.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  createClient: async (data: Omit<Client, 'id' | 'createdAt'>, authorName: string, dealerId: string = 'main'): Promise<Client> => {
    const id = Math.random().toString(36).substr(2, 9);
    const path = `clients/${id}`;
    const newClient: any = sanitize({
      ...data,
      id,
      createdAt: serverTimestamp(),
      dealerId
    });
    try {
      await setDoc(doc(db, 'clients', id), newClient);
      await firebaseService.createNotification({
        type: 'client_added',
        message: `New client added to registry: ${newClient.name}`,
        authorName,
        details: newClient,
        dealerId
      });
      return newClient;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  updateClient: async (id: string, data: Partial<Client>, clientName: string, authorName: string) => {
    const path = `clients/${id}`;
    try {
      const clientRef = doc(db, 'clients', id);
      const cleanData = sanitize(data);
      await updateDoc(clientRef, cleanData);
      await firebaseService.createNotification({
        type: 'client_updated',
        message: `Client record modified: Updated info for "${clientName}"`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  deleteClient: async (id: string, clientName: string, authorName: string) => {
    const path = `clients/${id}`;
    try {
      await deleteDoc(doc(db, 'clients', id));
      await firebaseService.createNotification({
        type: 'client_deleted',
        message: `Client record removed: "${clientName}" purged from database`,
        authorName
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  subscribeClients: (callback: (clients: Client[]) => void, dealerId?: string) => {
    const path = 'clients';
    return onSnapshot(collection(db, path), (snapshot) => {
      let clients = snapshot.docs.map(doc => ({ ...doc.data() as Client }));
      
      if (dealerId) {
        if (dealerId === 'main') {
          clients = clients.filter(c => !c.dealerId || c.dealerId === 'main');
        } else {
          clients = clients.filter(c => c.dealerId === dealerId);
        }
      }
      
      // Robust in-memory sort to avoid composite index requirement
      clients.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(clients);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    });
  }
};
