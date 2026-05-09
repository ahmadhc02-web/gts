import { useState, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import AdminPanel from './components/AdminPanel';
import MemberPanel from './components/MemberPanel';
import WelcomeOverlay from './components/WelcomeOverlay';
import { Complaint, UserProfile, ComplaintStatus } from './types';
import { firebaseService } from './lib/firebaseService';
import { googleSheetsService } from './services/googleSheetsService';
import { Toaster, toast } from 'sonner';
import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_ZONES, AppConfig } from './constants';
import { AnimatePresence, motion } from 'motion/react';
import { safeStringify } from './lib/utils';

import { useOnlineStatus } from './hooks/useOnlineStatus';

export default function App() {
  const isOnline = useOnlineStatus();

  // Watch for connection changes
  useEffect(() => {
    if (isOnline) {
      toast.success('Connection Restored', {
        description: 'Synchronizing local operational data with server relay...',
        duration: 3000
      });
      // Process pending Google Sheets syncs
      googleSheetsService.syncQueue.process().catch(e => console.error(e instanceof Error ? e.message : String(e)));
    } else {
      toast.error('Connection Severed', {
        description: 'Switching to Local Access Mode. Data will be cached locally.',
        duration: 5000
      });
    }
  }, [isOnline]);

  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('complaint_app_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    categories: DEFAULT_CATEGORIES,
    statuses: DEFAULT_STATUSES,
    priorities: DEFAULT_PRIORITIES,
    zones: DEFAULT_ZONES
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [alertAuthorized, setAlertAuthorized] = useState(() => {
    return localStorage.getItem('gts_alerts_authorized') === 'true';
  });
  const [showTimedAlertHub, setShowTimedAlertHub] = useState(false);

  const [hideBanner, setHideBanner] = useState(() => {
    return localStorage.getItem('gts_banner_hidden') === 'true';
  });

  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    return localStorage.getItem('gts_audio_muted') === 'true';
  });

  const [isMicMuted, setIsMicMuted] = useState(() => {
    return localStorage.getItem('gts_mic_muted') === 'true';
  });

  const [micAuthorized, setMicAuthorized] = useState(() => {
    return localStorage.getItem('gts_mic_authorized') === 'true';
  });

  // Global Audio Objects to prevent garbage collection issues
  const [notificationAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const [chatAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3'));

  // Sync initial audio states
  useEffect(() => {
    notificationAudio.muted = isAudioMuted;
    chatAudio.muted = isAudioMuted;
  }, [notificationAudio, chatAudio, isAudioMuted]);

  useEffect(() => {
    notificationAudio.load();
    chatAudio.load();
  }, [notificationAudio, chatAudio]);

  // Timed Hub Visibility Logic
  useEffect(() => {
    if (!user) {
      setShowTimedAlertHub(false);
      return;
    }

    const showTimer = setTimeout(() => {
      setShowTimedAlertHub(true);
    }, 60000); // 1 minute after login

    const hideTimer = setTimeout(() => {
      setShowTimedAlertHub(false);
    }, 120000); // Hide 1 minute later (2 mins total from login)

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [user]);

  const handleToggleAudio = () => {
    const newState = !isAudioMuted;
    setIsAudioMuted(newState);
    localStorage.setItem('gts_audio_muted', newState.toString());
    
    // Explicitly update muted state on global audio objects
    notificationAudio.muted = newState;
    chatAudio.muted = newState;
    
    toast.info(newState ? "Audio Notifications Muted" : "Audio Notifications Unmuted", {
      icon: newState ? '🔇' : '🔊'
    });
  };

  const handleToggleMic = () => {
    const newState = !isMicMuted;
    setIsMicMuted(newState);
    localStorage.setItem('gts_mic_muted', newState.toString());
    toast.info(newState ? "Microphone Deactivated" : "Microphone Activated", {
      icon: newState ? '🎙️' : '🎤'
    });
  };

  const handleResetBanner = () => {
    setHideBanner(false);
    localStorage.removeItem('gts_banner_hidden');
    toast.success("System Management Banner Restored");
  };

  // Function to initialize permissions and audio
  const handleAuthorizeAlerts = async () => {
    try {
      // 1. Notification Permission
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error("Notification access denied. Notifications will not show on lock screen.");
        }
      }

      // 2. Unlock Audio (Play silent buffer)
      notificationAudio.volume = 0;
      chatAudio.volume = 0;
      await notificationAudio.play();
      await chatAudio.play();
      notificationAudio.pause();
      chatAudio.pause();
      notificationAudio.volume = 0.5;
      chatAudio.volume = 0.5;
      
      // 3. Request Wake Lock (Bonded to user interaction)
      if ('wakeLock' in navigator) {
        try {
          await (navigator as any).wakeLock.request('screen');
          console.log("Wake Lock bond established via user action");
        } catch (e) {
          console.warn("User-initiated Wake Lock failed:", e);
        }
      }

      // 4. Test Vibration
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      setAlertAuthorized(true);
      localStorage.setItem('gts_alerts_authorized', 'true');
      setIsAudioMuted(false);
      localStorage.setItem('gts_audio_muted', 'false');
      toast.success("System Alerts Enabled", { description: "You will now receive sound and background notifications." });
    } catch (err) {
      console.error("Authorization failed:", err instanceof Error ? err.message : String(err));
      toast.error("Failed to unlock system alerts. Please check browser permissions.");
    }
  };

  const handleAuthorizeMic = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media Devices API not supported');
      }

      // Pre-check for audio input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      
      if (!hasMic) {
        throw { name: 'NotFoundError', message: 'No audio input hardware found' };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately
      setMicAuthorized(true);
      localStorage.setItem('gts_mic_authorized', 'true');
      setIsMicMuted(false);
      localStorage.setItem('gts_mic_muted', 'false');
      toast.success("Microphone Authorized", { description: "Tactical voice transmission is now unlocked." });
    } catch (err: any) {
      console.error("Mic Auth Logic Failure:", err instanceof Error ? err.message : String(err));
      let errorMessage = "Microphone access denied. Check your hardware permissions.";
      
      const errorName = err.name || '';
      const errorMsg = err.message || '';

      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || errorMsg.includes('Requested device not found')) {
        errorMessage = "No microphone hardware detected. Connect a device or try opening in a new tab.";
      } else if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError') {
        errorMessage = "Microphone access blocked by browser privacy policy or user denial.";
      } else if (errorName === 'OverconstrainedError') {
        errorMessage = "The requested microphone constraints cannot be met by your hardware.";
      }

      toast.error(errorMessage, {
        description: "Hardware diagnostics failed. Ensure peripheral connection."
      });
    }
  };

  const handleSoundTest = async () => {
    try {
      notificationAudio.currentTime = 0;
      await notificationAudio.play();
      
      // Refresh Wake Lock on every test interaction to keep it alive
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen').catch(() => {});
      }
      
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      toast.success("Pinging System Speakers...", { icon: '🔊' });
    } catch (e) {
      console.warn("Audio test blocked:", e);
      toast.error("Audio execution blocked by browser. Interact with the page again.");
    }
  };

  // Heartbeat to keep connection active and session alive
  useEffect(() => {
    if (!user) return;
    
    // Attempt Wake Lock to prevent screen sleep (if supported)
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log("Wake Lock acquired successfully");
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          console.warn("Wake Lock restricted by browser policy");
        } else {
          console.warn("Wake Lock failed:", err);
        }
      }
    };
    
    requestWakeLock();

    const interval = setInterval(() => {
      // Periodic ping
    }, 30000); 

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        firebaseService.updateUserPresence(user.uid).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Immediate presence update
    firebaseService.updateUserPresence(user.uid).catch(() => {});
    
    const presenceInterval = setInterval(() => {
      firebaseService.updateUserPresence(user.uid).catch(() => {});
    }, 120000); // Pulse every 2 mins

    return () => {
      clearInterval(interval);
      clearInterval(presenceInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, [user]);

  // Auto-login logic and initial data fetch
  useEffect(() => {
    let unsubscribeConfig: (() => void) | undefined;
    let authReady = false;

    const init = async (userAuth: any) => {
      console.log('App: Initializing with auth status:', !!userAuth);
      
      try {
        const fetchTenantId = user ? firebaseService.getReadTenantId(user) : undefined;
        const initialUsers = await firebaseService.getUsers(fetchTenantId);
        
        let currentUsers = [...initialUsers];
        
        if (!fetchTenantId || fetchTenantId === 'main') {
          const hasAbc = currentUsers.some(u => u.username === 'abc');
          
          if (!hasAbc) {
            try {
              const abcAdmin = await firebaseService.createUser('abc-id', 'abc', 'abc', 'super_admin', 'system', 'System Bootstrap', 'main', '000');
              currentUsers.push(abcAdmin);
            } catch(e) {
              console.error("Failed to inject abc user:", e);
            }
          }

          // Bootstrap first admin if no users exist
          if (currentUsers.length === 0) {
            try {
              const admin = await firebaseService.createUser('admin-id', 'admin', 'admin', 'super_admin', 'system', 'System Bootstrap');
              currentUsers.push(admin);
            } catch (e) {
               console.error("Failed to bootstrap admin:", e);
            }
          } 
        }
        
        setUsers(currentUsers);
      } catch (err) {
        console.error("Initialization error:", err instanceof Error ? err.message : String(err));
        setError("System initialization failed. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    };

    import('firebase/auth').then(({ onAuthStateChanged, signInAnonymously }) => {
      const unsubscribeAuth = onAuthStateChanged(auth, (userAuth) => {
        if (userAuth && !authReady) {
          authReady = true;
          setFirebaseAuthReady(true);
          init(userAuth);
        } else if (!userAuth && !authReady) {
          // If not signed in yet, try to sign in anonymously
          signInAnonymously(auth).catch(authErr => {
            console.warn("Auth initialization restricted:", authErr);
            // Even if anonymous auth fails, we should still mark ready 
            // but init(null) will be called if as a absolute fallback 
            // to show login screen or error
            if (!authReady) {
              authReady = true;
              setFirebaseAuthReady(true);
              init(null);
            }
          });
        }
      });

      return () => unsubscribeAuth();
    });

    return () => {
      if (unsubscribeConfig) unsubscribeConfig();
    };
  }, []);

  // Real-time user updates for presence and management
  useEffect(() => {
    // Only subscribe to real-time user changes when logged in
    if (!user) return;
    
    const tenantId = firebaseService.getReadTenantId(user);
    
    // Subscribe to app config for the current tenant
    const unsubscribeConfig = firebaseService.subscribeConfig((data) => {
      if (data) {
        setAppConfig({
          categories: data.categories || DEFAULT_CATEGORIES,
          statuses: data.statuses || DEFAULT_STATUSES,
          priorities: data.priorities || DEFAULT_PRIORITIES,
          zones: data.zones || DEFAULT_ZONES,
        });
      } else {
        console.log('No app config found for tenant, initializing with defaults...');
        // First time initialization for this tenant
        firebaseService.updateConfig({
          categories: DEFAULT_CATEGORIES,
          statuses: DEFAULT_STATUSES,
          priorities: DEFAULT_PRIORITIES,
          zones: DEFAULT_ZONES,
        }, 'System Bootstrap', tenantId).catch(err => {
          console.error('Failed to bootstrap config for tenant:', err instanceof Error ? err.message : String(err));
        });
      }
    }, tenantId);

    const unsubscribe = firebaseService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers);
    }, tenantId);

    return () => {
      unsubscribeConfig();
      unsubscribe();
    };
  }, [user]);

  // Fetch complaints only when a user is logged in
  useEffect(() => {
    if (!user) {
      setComplaints([]);
      return;
    }
    
    const tenantId = user ? firebaseService.getReadTenantId(user) : undefined;
    
    const unsubscribe = firebaseService.subscribeComplaints((data) => {
      setComplaints(data);
    }, tenantId);

    return () => unsubscribe();
  }, [user]);

  // Centralized Notifications Subscription
  useEffect(() => {
    if (!user) return;
    
    const tenantId = user ? firebaseService.getReadTenantId(user) : undefined;
    let isInitialLoad = true;
    let lastNotificationId = '';

    const unsubscribe = firebaseService.subscribeNotifications((data) => {
      setNotifications(data);
      if (data.length > 0) {
        const latest = data[0]; // notifications are descending
        
        // Only notify if not self and after initial load
        if (!isInitialLoad && latest.id !== lastNotificationId && latest.authorName !== user.username) {
          // Sound Alert
          if (alertAuthorized && !isAudioMuted) {
            notificationAudio.currentTime = 0;
            notificationAudio.volume = 0.9;
            notificationAudio.play().catch(e => console.warn("Audio blocked:", e));
            
            // Vibration
            if ("vibrate" in navigator) {
              navigator.vibrate([300, 100, 300]);
            }
          }

          // In-app Toast
          toast.info(`SYSTEM ALERT: ${latest.type.toUpperCase()}`, {
            description: `${latest.message} - By ${latest.authorName}`,
            duration: 8000,
            icon: '🔔',
          });

          // Background Notification
          if ("Notification" in window && Notification.permission === "granted") {
            const options = {
              body: `${latest.message}\nBy: ${latest.authorName}`,
              icon: '/vite.svg',
              badge: '/vite.svg',
              tag: 'gts-notification',
              renotify: true,
              vibrate: [200, 100, 200],
              data: { url: window.location.origin }
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(`GTS: ${latest.type.toUpperCase()}`, options);
              });
            } else {
              new Notification(`GTS: ${latest.type.toUpperCase()}`, options);
            }
          }
        }
        
        lastNotificationId = latest.id;
        isInitialLoad = false;
      }
    }, tenantId);

    return () => unsubscribe();
  }, [user, alertAuthorized, isAudioMuted, notificationAudio]);

  // Global Chat Notifications
  useEffect(() => {
    if (!user) return;
    
    let isInitialLoad = true;
    let lastMessageId = '';

    const tenantId = user ? firebaseService.getReadTenantId(user) : undefined;

    const unsubscribe = firebaseService.subscribeMessages((data) => {
      // Filter out private messages not meant for user
      const visibleData = data.filter(msg => !msg.recipientId || msg.senderId === user.uid || msg.recipientId === user.uid);
      if (visibleData.length > 0) {
        const latest = visibleData[visibleData.length - 1];
        
        // Only notify if not self and after initial load
        if (!isInitialLoad && latest.id !== lastMessageId && latest.senderId !== user.uid) {
          // Sound
          if (alertAuthorized && !isAudioMuted) {
            chatAudio.currentTime = 0;
            chatAudio.volume = 0.8;
            chatAudio.play().catch(e => console.warn("Audio blocked:", e));
          }

          // Mobile Notification
          if ("Notification" in window && Notification.permission === "granted") {
            const options = {
              body: latest.text || (latest.type === 'voice' ? '🎤 Voice Message' : 'New Message'),
              icon: '/vite.svg',
              badge: '/vite.svg',
              tag: 'gts-chat',
              renotify: true,
              vibrate: [200, 50, 200],
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(reg => reg.showNotification(`New from ${latest.senderName}`, options));
            } else {
              new Notification(`New from ${latest.senderName}`, options);
            }
          }

          // Vibration if available
          if ("vibrate" in navigator) {
            navigator.vibrate([100, 50, 100]);
          }

          toast.message(`NEW FROM: ${latest.senderName}`, {
            description: latest.text ? (latest.text.length > 50 ? latest.text.substring(0, 50) + '...' : latest.text) : 'Received a message',
            icon: '💬',
            duration: 5000,
          });
        }
        
        lastMessageId = latest.id;
        isInitialLoad = false;
      }
    }, tenantId);

    return () => unsubscribe();
  }, [user, alertAuthorized, isAudioMuted]);

  const handleLogin = async (username: string, pass: string, lineCode?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let dealerId: string | undefined = undefined;
      let effectiveUsers = users;

      // If a line code is provided, we need to validate it first
      if (lineCode) {
        const networkOwner = await firebaseService.getNetworkOwnerByLineCode(lineCode);
        if (!networkOwner) {
          setError('Invalid Network Code. Access Denied.');
          setIsLoading(false);
          return;
        }
        
        if (networkOwner.role === 'super_admin') {
           effectiveUsers = [networkOwner];
        } else {
           dealerId = networkOwner.uid;
           // Fetch users specifically for this dealer's network and include the dealer themselves
           const networkUsers = await firebaseService.getUsers(dealerId);
           effectiveUsers = [networkOwner, ...networkUsers];
        }
      }

      const foundUser = effectiveUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (foundUser && foundUser.password === pass) {
        setUser(foundUser);
        localStorage.setItem('complaint_app_user', safeStringify(foundUser));
        setShowWelcome(true);
        toast.success(`Welcome back, ${foundUser.username}`);
      } else {
        setError('Invalid username or password');
      }
    } catch (e) {
      setError('Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('complaint_app_user');
    toast.info('Logged out successfully');
  };

  const handleRegisterComplaint = async (data: any) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const newComplaint = await firebaseService.createComplaint(data, user);
      toast.success('Complaint submitted successfully!');
      
      // Auto-sync to Google Sheets if configured
      try {
        if (navigator.onLine) {
          await googleSheetsService.appendComplaint(newComplaint);
        } else {
          console.warn('Offline: Queueing sheet sync for reconnection.');
          googleSheetsService.syncQueue.add(newComplaint);
        }
      } catch (err) {
        console.error('Failed to sync with Google Sheets, queuing...', err instanceof Error ? err.message : String(err));
        googleSheetsService.syncQueue.add(newComplaint);
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;
      await firebaseService.deleteComplaint(id, customerName, user.username);
      toast.success('Complaint deleted successfully!');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to delete complaint.');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, status: ComplaintStatus, remarks?: string) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;
      await firebaseService.updateComplaintStatus(id, status, customerName, user.username, user.uid, remarks);
      toast.success(`Status updated to ${status}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update status.');
    }
  };

  const handleUpdateRemarks = async (id: string, remarks: string) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;
      await firebaseService.updateComplaintRemarks(id, remarks, customerName, user.username, user.uid);
      toast.success('Protocol remarks updated successfully');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update remarks.');
    }
  };

  const handleUpdateComplaint = async (id: string, data: Partial<Complaint>) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = data.customerName || complaint?.customerName || id;
      await firebaseService.updateComplaint(id, data, customerName, user.username);
      toast.success('Log record updated successfully');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update record.');
    }
  };

  const handleCreateUser = async (username: string, pass: string, role: UserProfile['role'], dealerId?: string, lineCode?: string) => {
    if (!user) return;
    const trimmedName = username.trim();
    if (!trimmedName || !pass.trim()) {
      toast.error('Username and password cannot be empty!');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('Username already exists! Please choose a different name.');
      return;
    }
    
    if (trimmedName.toLowerCase() === pass.toLowerCase()) {
      toast.error('Password cannot be the same as username for security reasons.');
      return;
    }

    try {
      const uid = Math.random().toString(36).substr(2, 9);
      await firebaseService.createUser(uid, trimmedName, pass, role, user.uid, user.username, dealerId, lineCode);
      toast.success(`${role === 'dealer' ? 'Dealer' : 'User'} ${trimmedName} created successfully!`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to create account.');
      throw e;
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!user) return;
    try {
      const targetUser = users.find(u => u.uid === uid);
      const username = targetUser?.username || uid;
      await firebaseService.deleteUser(uid, username, user.username);
      toast.success('User deleted successfully');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to delete user.');
    }
  };

  const handleUpdateUser = async (uid: string, username: string, pass: string) => {
    if (!user) return;
    try {
      await firebaseService.updateUser(uid, { username, password: pass }, user.username);
      
      // If updating self, update local user state too
      if (user && user.uid === uid) {
        const updatedUser = { ...user, username, password: pass };
        setUser(updatedUser);
        localStorage.setItem('complaint_app_user', safeStringify(updatedUser));
      }
      
      toast.success('User details updated successfully!');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update user details.');
    }
  };

  const handleChangeAdminPass = async (newPass: string) => {
    if (!user) return;
    try {
      await firebaseService.updateUserPassword(user.uid, user.username, newPass, user.username);
      const updatedUsers = await firebaseService.getUsers();
      setUsers(updatedUsers);
      
      // Update local state and persistence
      const updatedUser = { ...user, password: newPass };
      setUser(updatedUser);
      localStorage.setItem('complaint_app_user', safeStringify(updatedUser));
      
      toast.success(`Admin password changed successfully!`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to change password.');
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const updatedUsers = await firebaseService.getUsers();
      setUsers(updatedUsers);
    } catch (err) {
      console.error("Refresh failed:", err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = (newConfig: AppConfig) => {
    if (!user) return;
    const tenantId = firebaseService.getTenantId(user);
    firebaseService.updateConfig(newConfig, user.username, tenantId);
    toast.success('System configuration updated');
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <AnimatePresence>
        {showWelcome && user && (
          <WelcomeOverlay 
            username={user.username} 
            onComplete={() => setShowWelcome(false)} 
          />
        )}
      </AnimatePresence>
      <Layout 
        user={user} 
        users={users}
        notifications={notifications}
        onLogout={handleLogout} 
        onRefresh={handleRefresh} 
        isLoading={isLoading}
        alertAuthorized={alertAuthorized}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        onResetBanner={handleResetBanner}
      >
        {!firebaseAuthReady ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-mono tracking-wider">ESTABLISHING SECURE UPLINK...</p>
          </div>
        ) : !user ? (
        <LoginForm onLogin={handleLogin} isLoading={isLoading} error={error} />
      ) : (user.role === 'admin' || user.role === 'super_admin' || user.role === 'dealer') ? (
        <AdminPanel
          complaints={complaints}
          users={users}
          currentUser={user}
          onDeleteComplaint={handleDeleteComplaint}
          onUpdateComplaintStatus={handleUpdateComplaintStatus}
          onUpdateRemarks={handleUpdateRemarks}
          onUpdateComplaint={handleUpdateComplaint}
          onCreateUser={handleCreateUser}
          onDeleteUser={handleDeleteUser}
          onUpdateUser={handleUpdateUser}
          onRegisterComplaint={handleRegisterComplaint}
          onChangeAdminPass={handleChangeAdminPass}
          appConfig={appConfig}
          onUpdateConfig={handleUpdateConfig}
          isLoading={isLoading}
          alertAuthorized={alertAuthorized}
          onAuthorizeAlerts={handleAuthorizeAlerts}
          onSoundTest={handleSoundTest}
          isAudioMuted={isAudioMuted}
          onToggleAudio={handleToggleAudio}
          onLogout={handleLogout}
          micAuthorized={micAuthorized}
          onAuthorizeMic={handleAuthorizeMic}
          isMicMuted={isMicMuted}
          onToggleMic={handleToggleMic}
        />
      ) : (
        <MemberPanel
          complaints={complaints}
          currentUser={user}
          onRegisterComplaint={handleRegisterComplaint}
          onUpdateComplaintStatus={handleUpdateComplaintStatus}
          onUpdateRemarks={handleUpdateRemarks}
          onUpdateComplaint={handleUpdateComplaint}
          onUpdateUser={handleUpdateUser}
          appConfig={appConfig}
          isLoading={isLoading}
          alertAuthorized={alertAuthorized}
          onAuthorizeAlerts={handleAuthorizeAlerts}
          onSoundTest={handleSoundTest}
          isAudioMuted={isAudioMuted}
          onToggleAudio={handleToggleAudio}
          onLogout={handleLogout}
          micAuthorized={micAuthorized}
          onAuthorizeMic={handleAuthorizeMic}
          isMicMuted={isMicMuted}
          onToggleMic={handleToggleMic}
        />
      )}
    </Layout>
    </>
  );
}
