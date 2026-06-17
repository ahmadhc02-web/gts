import { useState, useEffect, useRef, useMemo } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import { safeLocalStorage } from './lib/safeLocalStorage';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import AdminPanel from './components/AdminPanel';
import MemberPanel from './components/MemberPanel';
import WelcomeOverlay from './components/WelcomeOverlay';
import { Complaint, UserProfile, ComplaintStatus, ChatGroup, Notification as AppNotification, BrandingConfig } from './types';
import { firebaseService } from './lib/firebaseService';
import { googleSheetsService } from './services/googleSheetsService';
import { Toaster, toast } from 'sonner';
import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_ZONES, AppConfig, DEFAULT_BRANDING } from './constants';
import { AnimatePresence, motion } from 'motion/react';
import { safeStringify, processScheduledComplaints } from './lib/utils';
import FiberLoading from './components/FiberLoading';
import ServiceMonitor from './components/ServiceMonitor';
import { supabase } from '../supabaseClient';

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
      
      // Sync local offline complaints
      syncOfflineComplaints();
    } else {
      toast.error('Connection Severed', {
        description: 'Switching to Local Access Mode. Data will be cached locally.',
        duration: 5000
      });
    }
  }, [isOnline]);

  const syncOfflineComplaints = async () => {
    const queue = JSON.parse(safeLocalStorage.getItem('offline_complaints') || '[]');
    if (queue.length === 0) return;

    console.log(`App: Initiating sync for ${queue.length} cached complaints...`);
    setIsLoading(true);
    
    // Create a copy to avoid mutation issues during sync
    const itemsToSync = [...queue];
    let syncCount = 0;

    for (const item of itemsToSync) {
      try {
        await handleRegisterComplaint(item, true); // Silent mode
        syncCount++;
      } catch (error) {
        console.error('App: Failed to sync individual complaint:', error);
      }
    }

    setIsLoading(false);

    if (syncCount > 0) {
      toast.success(`Sync Complete: ${syncCount} records synchronized with cloud database.`);
      // Remove successfully synced items (in case of partial success)
      const remaining = JSON.parse(safeLocalStorage.getItem('offline_complaints') || '[]');
      const newQueue = remaining.slice(syncCount);
      if (newQueue.length === 0) {
        safeLocalStorage.removeItem('offline_complaints');
      } else {
        safeLocalStorage.setItem('offline_complaints', safeStringify(newQueue));
      }
    }
  };

  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const savedUser = safeLocalStorage.getItem('complaint_app_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
      return null;
    } catch (e) {
      console.error("Failed to parse saved user:", e);
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<string>('complaints');
  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    try {
      const cached = localStorage.getItem('gts_cache_v3_complaints');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const processedComplaints = useMemo(() => {
    return processScheduledComplaints(complaints);
  }, [complaints]);
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const cached = localStorage.getItem('gts_cache_v3_users');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [userGroups, setUserGroups] = useState<ChatGroup[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    categories: DEFAULT_CATEGORIES,
    statuses: DEFAULT_STATUSES,
    priorities: DEFAULT_PRIORITIES,
    zones: DEFAULT_ZONES,
    billingSecurityKey: '786786'
  });
  const [branding, setBranding] = useState<BrandingConfig>(() => {
    try {
      const cached = safeLocalStorage.getItem('gts_branding');
      const cachedTranslations = safeLocalStorage.getItem('gts_translations');
      
      let brandingData: BrandingConfig = cached 
        ? JSON.parse(cached) 
        : { ...DEFAULT_BRANDING, id: 'global', updatedAt: Date.now(), updatedBy: 'system' } as BrandingConfig;
      
      if (cachedTranslations) {
        try {
          brandingData.translations = {
            ...(brandingData.translations || {}),
            ...JSON.parse(cachedTranslations)
          };
        } catch (e) {
          console.warn("Failed to parse cached translations:", e);
        }
      }
      
      return brandingData;
    } catch (e) {
      console.warn("Failed to load cached branding:", e);
    }
    return { ...DEFAULT_BRANDING, id: 'global', updatedAt: Date.now(), updatedBy: 'system' } as BrandingConfig;
  });
  const [isLoading, setIsLoading] = useState(true); // Default to true until auth/init is done
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [alertAuthorized, setAlertAuthorized] = useState(() => {
    return safeLocalStorage.getItem('gts_alerts_authorized') === 'true';
  });
  const [showTimedAlertHub, setShowTimedAlertHub] = useState(false);

  // Latest states ref setup to avoid resetting background backup interval on state changes
  const backupStateRef = useRef({ complaints, users, appConfig, branding });
  useEffect(() => {
    backupStateRef.current = { complaints, users, appConfig, branding };
  }, [complaints, users, appConfig, branding]);
  const [hideBanner, setHideBanner] = useState(() => {
    return safeLocalStorage.getItem('gts_banner_hidden') === 'true';
  });

  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    return safeLocalStorage.getItem('gts_audio_muted') === 'true';
  });

  const [isMicMuted, setIsMicMuted] = useState(() => {
    return safeLocalStorage.getItem('gts_mic_muted') === 'true';
  });

  const [micAuthorized, setMicAuthorized] = useState(() => {
    return safeLocalStorage.getItem('gts_mic_authorized') === 'true';
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
    safeLocalStorage.setItem('gts_audio_muted', newState.toString());
    
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
    safeLocalStorage.setItem('gts_mic_muted', newState.toString());
    toast.info(newState ? "Microphone Deactivated" : "Microphone Activated", {
      icon: newState ? '🎙️' : '🎤'
    });
  };

  const handleResetBanner = () => {
    setHideBanner(false);
    safeLocalStorage.removeItem('gts_banner_hidden');
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
      safeLocalStorage.setItem('gts_alerts_authorized', 'true');
      setIsAudioMuted(false);
      safeLocalStorage.setItem('gts_audio_muted', 'false');
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
      safeLocalStorage.setItem('gts_mic_authorized', 'true');
      setIsMicMuted(false);
      safeLocalStorage.setItem('gts_mic_muted', 'false');
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

  // Sync branding subscriptions
  useEffect(() => {
    if (!firebaseAuthReady) return;
    
    return firebaseService.subscribeBranding((data) => {
      if (data) {
        setBranding((prev) => {
          const mergedTranslations = {
            ...(prev?.translations || {}),
            ...(data.translations || {})
          };
          return {
            ...prev,
            ...data,
            translations: mergedTranslations
          };
        });
        try {
          safeLocalStorage.setItem('gts_branding', JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to cache branding locally:", e);
        }
      }
    });
  }, [firebaseAuthReady]);

  // Synchronize unbreakable lifetime translations from Firestore and merge them into branding
  useEffect(() => {
    if (!firebaseAuthReady) return;

    return firebaseService.subscribeTranslations((data) => {
      if (data) {
        setBranding((prev) => {
          const mergedTranslations = {
            ...(prev?.translations || {}),
            ...data
          };
          return {
            ...prev,
            translations: mergedTranslations
          };
        });
        try {
          safeLocalStorage.setItem('gts_translations', JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to cache translations locally:", e);
        }
      }
    });
  }, [firebaseAuthReady]);

  // Apply branding design parameters and styles dynamically (both from cache and Firestore)
  useEffect(() => {
    if (!branding) return;
    try {
      const root = document.documentElement;
      if (branding.accentColor) root.style.setProperty('--brand-accent', branding.accentColor);
      if (branding.secondaryColor) root.style.setProperty('--brand-secondary', branding.secondaryColor);
      
      let activeFont = branding.fontFamily;
      if (!activeFont || activeFont.includes('Inter') || activeFont.trim() === 'sans-serif') {
        activeFont = 'Lexend, sans-serif';
      }
      root.style.setProperty('--font-sans', activeFont);
      
      if (branding.borderRadius !== undefined) {
        const radiusMap: Record<string, string> = {
          'none': '0px',
          'sm': '4px',
          'md': '8px',
          'lg': '16px',
          'full': '9999px'
        };
        const radiusVal = typeof branding.borderRadius === 'string' ? (radiusMap[branding.borderRadius] || '8px') : `${branding.borderRadius}px`;
        root.style.setProperty('--radius-global', radiusVal);
      }
      
      if (branding.glassOpacity !== undefined) root.style.setProperty('--glass-opacity', String(branding.glassOpacity));
      
      // Handle animations toggle globally if needed
      if (branding.enableAnimations === false) {
        root.classList.add('no-animations');
      } else {
        root.classList.remove('no-animations');
      }
    } catch (e) {
      console.warn("Failed to set styling root variables:", e);
    }
  }, [branding]);

  // Sync Google Sheets config with real-time updates from Firestore 24/7
  useEffect(() => {
    if (!firebaseAuthReady) return;
    
    const unsubscribe = googleSheetsService.subscribeGoogleSheetsConfig((data) => {
      console.log('App: Live Google Sheets config synced from Firestore real-time.');
    });
    
    return () => unsubscribe();
  }, [firebaseAuthReady]);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;
    let initialized = false;

    const init = async (userAuth: any) => {
      console.log('App: Initializing Data Registry...');
      
      // Load Google Sheets config from Firestore to local storage first
      try {
        await googleSheetsService.loadConfigFromFirestore();
      } catch (e) {
        console.warn("Could not retrieve shared Google Sheets configuration:", e);
      }
      
      // Test Firestore connection
      firebaseService.testConnection();
      
      try {
        // Fetch all users to ensure bootstrap accounts exist
        const initialUsers = await firebaseService.getUsers();
        let currentUsers = [...initialUsers];
        
        // Self-Healing Boot Seed: ONLY activate if the database is brand new and completely empty!
        // This stops the system from constantly restoring deleted or modified default admin profiles on launch.
        let seededAny = false;
        if (initialUsers.length === 0) {
          const requiredCoreUsers = [
            { uid: 'admin_sys_node', username: 'admin', password: 'admin', role: 'super_admin' as const, status: 'active' as const },
            { uid: 'yaseen_sys_node', username: 'yaseen', password: 'yaseen', role: 'super_admin' as const, status: 'active' as const },
            { uid: 'abc_sys_node', username: 'abc', password: 'abc', role: 'super_admin' as const, status: 'active' as const }
          ];

          for (const req of requiredCoreUsers) {
            console.log(`[Database Self-Heal] Seeding default core user: ${req.username}`);
            try {
              const seededUser = await firebaseService.createUser(
                req.uid,
                req.username,
                req.password,
                req.role,
                'system',
                'System Core Boot',
                'main',
                undefined,
                undefined,
                req.status
              );
              currentUsers.push({
                ...seededUser,
                uid: req.uid,
                username: req.username,
                password: req.password,
                role: req.role,
                status: req.status,
                createdAt: Date.now()
              });
              seededAny = true;
            } catch (seedErr) {
              console.error(`Failed to seed user ${req.username}:`, seedErr);
            }
          }
        }

        if (seededAny) {
          setUsers([...currentUsers]);
        } else {
          setUsers(currentUsers);
        }

        // Re-validate current session identity against the fresh registry
        if (user) {
          const freshUser = currentUsers.find(u => u.username.toLowerCase() === user.username.toLowerCase());
          
          if (!freshUser) {
            console.warn("Auth Security: Revoking stale or missing session identity.");
            setUser(null);
            safeLocalStorage.removeItem('complaint_app_user');
          } else if (freshUser) {
            if (freshUser.status === 'blocked') {
              console.warn("Auth Security: Revoking blocked identity session.");
              setUser(null);
              safeLocalStorage.removeItem('complaint_app_user');
              toast.error("Access REVOKED: Your account has been blocked by an administrator.");
            } else if (freshUser.status === 'pending') {
              console.warn("Auth Security: Restricted pending identity session.");
              setUser(null);
              safeLocalStorage.removeItem('complaint_app_user');
              toast.warning("Access RESTRICTED: Your request is still pending approval.");
            } else if (safeStringify(freshUser) !== safeStringify(user)) {
               // Update local state if role or profile changes
               setUser(freshUser);
               safeLocalStorage.setItem('complaint_app_user', safeStringify(freshUser));
            }
          }
        }
      } catch (err) {
        console.error("Initialization error:", err instanceof Error ? err.message : String(err));
        setError("System initialization failed. Some data may be temporarily unavailable.");
      } finally {
        // High-performance loading optimization
        setTimeout(() => {
          setIsLoading(false);
        }, 100);
      }
    };

    // Completely bypass Firebase Auth in favor of direct Supabase loading
    const startBypass = async () => {
      const mockUserAuth = { uid: 'local_anon_user' };
      setFirebaseUser(mockUserAuth);
      setFirebaseAuthReady(true);
      if (!initialized) {
        initialized = true;
        await init(mockUserAuth);
      }
    };
    startBypass();

    return () => {};
  }, []);

  // Real-time user updates for presence and management
  useEffect(() => {
    // Only subscribe to real-time user changes when logged in AND firebase is checked
    if (!user) return;
    if (!firebaseAuthReady) return;
    
    const tenantId = firebaseService.getReadTenantId(user);
    
    // Subscribe to app config for the current tenant
    const unsubscribeConfig = firebaseService.subscribeConfig((data) => {
      if (data) {
        const fetchedStatuses = data.statuses || DEFAULT_STATUSES;
        const finalStatuses = fetchedStatuses.includes('scheduled') ? fetchedStatuses : [...fetchedStatuses, 'scheduled'];
        
        setAppConfig({
          categories: data.categories || DEFAULT_CATEGORIES,
          statuses: finalStatuses,
          priorities: data.priorities || DEFAULT_PRIORITIES,
          zones: data.zones || DEFAULT_ZONES,
          billingSecurityKey: data.billingSecurityKey || '786786',
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

    const unsubscribeUsers = firebaseService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers);
    }, tenantId);

    const unsubscribeGroups = firebaseService.subscribeGroups((updatedGroups) => {
      setUserGroups(updatedGroups);
    }, user.uid, tenantId);

    return () => {
      unsubscribeConfig();
      unsubscribeUsers();
      unsubscribeGroups();
    };
  }, [user, firebaseAuthReady]);

  // Fetch complaints only when a user is logged in
  useEffect(() => {
    if (!user) {
      setComplaints([]);
      return;
    }
    if (!firebaseAuthReady) return;
    
    const tenantId = firebaseService.getReadTenantId(user);
    
    const unsubscribe = firebaseService.subscribeComplaints((data) => {
      setComplaints(data);
    }, tenantId);

    return () => unsubscribe();
  }, [user, firebaseAuthReady]);

  // Real-time data fetch functions to instantly synchronize local states from Supabase
  const fetchComplaints = async () => {
    if (!user) return;
    const tenantId = firebaseService.getReadTenantId(user);
    try {
      console.log("[Supabase Realtime Sync] Fetching updated complaints...");
      const data = await firebaseService.getComplaints(tenantId);
      setComplaints(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error("[Supabase Realtime Sync] fetchComplaints failed:", e);
    }
  };

  const fetchClients = async () => {
    if (!user) return;
    const tenantId = firebaseService.getReadTenantId(user);
    try {
      console.log("[Supabase Realtime Sync] Fetching updated clients...");
      const data = await firebaseService.getClients(tenantId);
      // Dispatch custom window event to trigger updates across ClientManagement and AdminPanel components
      window.dispatchEvent(new CustomEvent('supabase-clients-updated', { detail: data }));
    } catch (e) {
      console.error("[Supabase Realtime Sync] fetchClients failed:", e);
    }
  };

  const fetchBrandingConfig = async () => {
    if (!user) return;
    const tenantId = firebaseService.getReadTenantId(user);
    try {
      console.log("[Supabase Realtime Sync] Fetching updated branding configs...");
      const config = await firebaseService.getAppConfig(tenantId);
      if (config) {
        const fetchedStatuses = config.statuses || DEFAULT_STATUSES;
        const finalStatuses = fetchedStatuses.includes('scheduled') ? fetchedStatuses : [...fetchedStatuses, 'scheduled'];
        
        setAppConfig({
          categories: config.categories || DEFAULT_CATEGORIES,
          statuses: finalStatuses,
          priorities: config.priorities || DEFAULT_PRIORITIES,
          zones: config.zones || DEFAULT_ZONES,
          billingSecurityKey: config.billingSecurityKey || '786786',
        });
      }
    } catch (e) {
      console.error("[Supabase Realtime Sync] fetchBrandingConfig failed:", e);
    }
  };

  // 1. Setup a dynamic useEffect hook / Supabase Channel subscription that listens to ALL events ('*') on 'public.complaints', 'public.clients', and 'public.branding_config'.
  useEffect(() => {
    if (!user || !firebaseAuthReady) return;

    console.log("Setting up parent Supabase Realtime channel for instant table synchronizations...");
    const channelId = `supabase_main_sync_channel_${Math.random().toString(36).substring(2, 11)}`;
    
    const channel = supabase
      .channel(channelId)
      // Listen to complaints table
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        console.log("[Supabase Realtime Event] complaints table postgres_change received:", payload);
        // 2. Whenever an INSERT, UPDATE, or DELETE payload is received from Supabase, immediately trigger the corresponding data fetch function to refresh the local state instantly.
        fetchComplaints();
      })
      // Listen to clients table
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        console.log("[Supabase Realtime Event] clients table postgres_change received:", payload);
        fetchClients();
      })
      // Listen to branding_config table
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, (payload) => {
        console.log("[Supabase Realtime Event] branding_config table postgres_change received:", payload);
        fetchBrandingConfig();
      })
      .subscribe();

    // 3. Ensure that when the components unmount, the .unsubscribe() clean-up function is properly called to prevent any websocket memory leaks.
    return () => {
      console.log("Unsubscribing and removing Supabase sync channel to prevent websocket memory leaks...");
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user, firebaseAuthReady]);

  // 10-Minute Automatic Background Bulk System Backup Scheduler
  useEffect(() => {
    if (!firebaseAuthReady) return;

    let timer: NodeJS.Timeout;
    const TEN_MINUTES = 10 * 60 * 1000;
    const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

    const runCheck = async () => {
      try {
        const tokens = googleSheetsService.getTokens();
        const spreadsheetId = googleSheetsService.getSpreadsheetId();
        if (!tokens || !spreadsheetId) {
          // Silent skip if Google Sheets is not configured or connected yet
          return;
        }

        // Fetch Google sheets config to check last backup timestamp
        const configData = await googleSheetsService.loadConfigFromFirestore();
        const lastBackup = configData?.lastAutoBackupTime || 0;
        const now = Date.now();

        if (now - lastBackup >= TEN_MINUTES) {
          console.log('[Auto-Backup] Last backup was more than 10 minutes ago. Performing bulk background system export...');
          
          // Optimistically update timestamp to prevent overlapping executions
          await googleSheetsService.syncConfigToFirestore({ lastAutoBackupTime: now });
          
          // Fetch all clients (async)
          const clients = await firebaseService.getClients().catch((e) => {
            console.warn("[Auto-Backup] Fetching clients warning:", e);
            return [];
          });
          
          const backupData = {
            complaints: backupStateRef.current.complaints || [],
            users: backupStateRef.current.users || [],
            clients: clients,
            config: backupStateRef.current.appConfig || {},
            branding: backupStateRef.current.branding || {}
          };

          await googleSheetsService.performBulkSystemBackup(backupData);
          console.log('[Auto-Backup] Background Bulk System Export Executed Successfully!');
        }
      } catch (err) {
        console.warn('[Auto-Backup] Error running auto-backup check:', err);
      }
    };

    // Warm-up delay of 15 seconds to let initial loads settle, then run first check
    const initialTimeout = setTimeout(() => {
      runCheck();
      timer = setInterval(runCheck, CHECK_INTERVAL);
    }, 15000);

    return () => {
      clearTimeout(initialTimeout);
      if (timer) clearInterval(timer);
    };
  }, [firebaseAuthReady]);

  // Centralized Notifications Subscription
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    if (!firebaseAuthReady) return;
    
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
          if ((window as any).AndroidInterface) {
            try {
              (window as any).AndroidInterface.showNotification(`GTS: ${latest.type.toUpperCase()}`, `${latest.message} - By ${latest.authorName}`);
            } catch (err) {
              console.error("Android bridge error:", err);
            }
          }

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
  }, [user, firebaseAuthReady, alertAuthorized, isAudioMuted, notificationAudio]);

  // Global Chat Notifications
  useEffect(() => {
    if (!user) return;
    if (!firebaseAuthReady) return;
    
    let isInitialLoad = true;
    let lastMessageId = '';

    const tenantId = user ? firebaseService.getReadTenantId(user) : undefined;
    const userGroupIds = userGroups.map(g => g.id);

    const unsubscribe = firebaseService.subscribeMessages((data) => {
      // Filter out private messages not meant for user
      const visibleData = data.filter(msg => 
        !msg.recipientId || 
        msg.senderId === user.uid || 
        msg.recipientId === user.uid ||
        (msg.isGroup && userGroupIds.includes(msg.recipientId))
      );
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
          if ((window as any).AndroidInterface) {
            try {
              (window as any).AndroidInterface.showNotification(`New from ${latest.senderName}`, latest.text || (latest.type === 'voice' ? '🎤 Voice Message' : 'New Message'));
            } catch (err) {
              console.error("Android bridge error:", err);
            }
          }

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
  }, [user, firebaseAuthReady, alertAuthorized, isAudioMuted, chatAudio, userGroups]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const loginUser = async (email: string, displayName: string, uid: string) => {
      let effectiveUsers = users;
      if (effectiveUsers.length === 0) {
        effectiveUsers = await firebaseService.getUsers();
        setUsers(effectiveUsers);
      }

      // Try to find user by username matching email prefix or exact email
      const emailPrefix = email.split('@')[0].toLowerCase();
      let foundUser = effectiveUsers.find(u => 
        u.username.toLowerCase() === email.toLowerCase() || 
        u.username.toLowerCase() === emailPrefix
      );

      if (!foundUser) {
        // Automatically provision them as a generic member/user with main dealer
        console.log(`Provisioning new identity via Google Auth: ${emailPrefix}`);
        foundUser = await firebaseService.createUser(
          uid, 
          emailPrefix, 
          'google_auth_' + uid.substring(0, 5), 
          'member', 
          'system', 
          displayName || emailPrefix, 
          'main',
          undefined,
          undefined,
          'pending'
        );
        setUsers(prev => [...prev, foundUser!]);
      }

      if (foundUser.status === 'pending') {
        toast.warning("Access Restricted: Request Pending", {
          description: "Your Google account access request has been sent to the Super Admin. Please wait for approval.",
          duration: 10000
        });
        return false;
      }

      if (foundUser.status === 'blocked') {
        setError("Access Denied: Your account has been blocked by an administrator.");
        return false;
      }

      setUser(foundUser);
      safeLocalStorage.setItem('complaint_app_user', safeStringify(foundUser));
      setShowWelcome(true);
      toast.success(`Access Granted: Welcome back, ${foundUser.fullName || foundUser.username}`);

      // Sync Login details to Google Sheet in background
      googleSheetsService.syncLogin(foundUser, 'Google Identity').catch((err) => {
        console.error("Failed background sheets login sync:", err);
      });
      return true;
    };

    const processOAuthTokens = async (tokens: any) => {
      try {
        const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');
        
        if (!tokens || !tokens.id_token) {
          throw new Error("No ID Token found in retrieved authorization tokens.");
        }
        
        const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
        const result = await signInWithCredential(auth, credential);
        
        const email = result.user.email;
        if (!email) throw new Error("No email associated with this Google account.");

        await loginUser(email, result.user.displayName || '', result.user.uid);
      } catch (authErr: any) {
        console.error("Firebase sign in with credential failed:", authErr);
        setError(`Firebase Credential Login Failed: ${authErr.message || authErr}`);
      }
    };

    const runServerOAuthFallback = () => {
      return new Promise<void>((resolve, reject) => {
        const host = window.location.hostname;
        const oauthBaseUrl = (host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app') || host.includes('hf.space') || host.includes('huggingface.co'))
          ? '/api/auth/google'
          : 'https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app/api/auth/google';
        const oauthUrl = `${oauthBaseUrl}?origin=${encodeURIComponent(window.location.origin)}`;
        
        const width = 600;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        console.log("Opening Google Auth redirect popup:", oauthUrl);
        const popup = window.open(
          oauthUrl,
          'GoogleIdentityOAuth',
          `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
        );

        if (!popup) {
          setError("Popup blocked. Please allow popups for this website to connect Google Identity.");
          reject(new Error("Popup blocked"));
          return;
        }

        const messageHandler = async (event: MessageEvent) => {
          if (event.data && event.data.type === 'google-oauth-success' && event.data.tokens) {
            const tokens = event.data.tokens;
            console.log("Received Google Auth tokens via message!");
            googleSheetsService.saveTokens(tokens);
            cleanup();
            try { if (popup && !popup.closed) popup.close(); } catch (e) {}
            await processOAuthTokens(tokens);
            resolve();
          }
        };

        const checkTimer = setInterval(async () => {
          try {
            const directTokensStr = safeLocalStorage.getItem('gts_sync_google_tokens_direct');
            if (directTokensStr) {
              const tokens = JSON.parse(directTokensStr);
              safeLocalStorage.removeItem('gts_sync_google_tokens_direct');
              googleSheetsService.saveTokens(tokens);
              console.log("Found direct Google Auth tokens in storage fallback.");
              cleanup();
              await processOAuthTokens(tokens);
              try { if (!popup.closed) popup.close(); } catch (e) {}
              resolve();
              return;
            }
          } catch (e) {}

          if (popup.closed) {
            setTimeout(async () => {
              try {
                const directTokensStr = safeLocalStorage.getItem('gts_sync_google_tokens_direct');
                if (directTokensStr) {
                  const tokens = JSON.parse(directTokensStr);
                  safeLocalStorage.removeItem('gts_sync_google_tokens_direct');
                  googleSheetsService.saveTokens(tokens);
                  cleanup();
                  await processOAuthTokens(tokens);
                  resolve();
                  return;
                }
              } catch (e) {}
              cleanup();
              setError("Auth window closed before completion. Please try again.");
              reject(new Error("Popup closed"));
            }, 1000);
          }
        }, 500);

        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkTimer);
        };

        window.addEventListener('message', messageHandler);
      });
    };

    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const email = result.user.email;
      if (!email) throw new Error("No email associated with this Google account.");

      await loginUser(email, result.user.displayName || '', result.user.uid);
    } catch (e: any) {
      console.error("Google Auth Exception:", e);
      if (e.code === 'auth/unauthorized-domain' || e.message?.includes('unauthorized-domain')) {
        console.log("Domain is unauthorized in Firebase Auth. Activating robust server-side callback fallback...");
        try {
          await runServerOAuthFallback();
        } catch (fallbackError: any) {
          console.error("OAuth fallback also failed:", fallbackError);
        }
      } else {
        let errorMessage = 'Google Authentication Failed. Please try again.';
        if (e.message) {
           errorMessage = `OAuth Protocol Error: ${e.message}`;
        }
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (username: string, pass: string, lineCode?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let effectiveUsers = users;

      // If user list is empty, performing hot fetch
      if (effectiveUsers.length === 0) {
        console.log("Registry empty, synchronizing with primary infrastructure...");
        effectiveUsers = await firebaseService.getUsers();
        setUsers(effectiveUsers);
      }

      // If a line code is provided, we need to validate it first
      if (lineCode) {
        const networkOwner = await firebaseService.getNetworkOwnerByLineCode(lineCode);
        if (!networkOwner) {
          setError('Invalid Network Code. Access Denied.');
          setIsLoading(false);
          return;
        }
        
        if (networkOwner.role !== 'super_admin') {
           // For non-super admins, check if the username exists in THEIR network
           const dealerId = networkOwner.uid;
           const networkUsers = await firebaseService.getUsers(dealerId);
           effectiveUsers = [networkOwner, ...networkUsers];
        } else {
           // Super admins see all users already in effectiveUsers
        }
      }

      const foundUser = effectiveUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      
      let isCredentialsValid = false;
      if (foundUser) {
        if (foundUser.password === pass) {
          isCredentialsValid = true;
        }
      }
      
      if (foundUser && isCredentialsValid) {
        if (foundUser.status === 'pending') {
          setError('Access Restricted: Your account is pending registration approval.');
          setIsLoading(false);
          return;
        }

        if (foundUser.status === 'blocked') {
          setError('Access Denied: Your account has been blocked by an administrator.');
          setIsLoading(false);
          return;
        }

        setUser(foundUser);
        safeLocalStorage.setItem('complaint_app_user', safeStringify(foundUser));
        setShowWelcome(true);
        toast.success(`Access Granted: Welcome back, ${foundUser.username}`);

        // Sync Login details to Google Sheet in background
        googleSheetsService.syncLogin(foundUser, 'Standard Credentials').catch((err) => {
          console.error("Failed background sheets login sync:", err);
        });
        
        if (!alertAuthorized) {
          toast("Action Required: Enable Audio Notifications", {
            description: "To receive real-time sound alerts for messages and notifications, please initialize the audio matrix in settings or profile.",
            action: {
              label: "Initialize Now",
              onClick: () => handleAuthorizeAlerts()
            },
            duration: 10000,
          });
        }
      } else {
        setError('Invalid Identity Credentials. Access Denied.');
      }
    } catch (e: any) {
      console.error("Login Handshake Exception:", e);
      let errorMessage = 'System Identity Bridge Failure. Please verify your network connection and try again.';
      
      if (e instanceof Error) {
        if (e.message.includes('permission') || e.message.includes('Missing or insufficient permissions')) {
          errorMessage = 'Credential Relay Denied: You do not have the protocol clearances to access the registry.';
        } else if (e.message.includes('network') || e.message.includes('offline')) {
          errorMessage = 'Connectivity Severed: The identity relay cannot reach the central cloud infrastructure.';
        } else {
          try {
            const parsed = JSON.parse(e.message);
            errorMessage = `Infrastructure Protocol Error: ${parsed.error || 'Unknown Exception'}`;
          } catch {
            errorMessage = `System Exception: ${e.message}`;
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('complaints');
    safeLocalStorage.removeItem('complaint_app_user');
    toast.info('Logged out successfully');
  };

  const handleRegisterComplaint = async (data: any, silent: boolean = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    try {
      if (!navigator.onLine) {
        // Run in background for Firestore persistence, don't await network resolution
        firebaseService.createComplaint(data, user).catch(console.error);

        // Treat it as locally persisted for UI
        const dummyComplaint = { ...data, id: 'temp_' + Date.now(), createdAt: Date.now() };
        googleSheetsService.syncQueue.add(dummyComplaint);

        if (!silent) toast.success('Offline mode: Saved locally and will sync when connected.');
        return;
      }

      const newComplaint = await firebaseService.createComplaint(data, user);
      if (!silent) toast.success('Complaint submitted successfully!');
      
      // Auto-sync to Google Sheets if configured (Operational Logs)
      try {
        if (navigator.onLine) {
          await googleSheetsService.syncActivity('Operational Logs', newComplaint);
        } else {
          console.warn('Offline: Queueing sheet sync for reconnection.');
          googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: newComplaint });
        }
      } catch (err) {
        console.error('Failed to auto-sync with Google Sheets, queuing...', err instanceof Error ? err.message : String(err));
        googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: newComplaint });
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      if (!silent) toast.error('Failed to register complaint.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;
      await firebaseService.deleteComplaint(id, customerName, user.fullName || user.username);
      toast.success('Complaint deleted successfully!');

      // Log deletion activity in Operational Logs
      if (complaint) {
        const deletionLog = { 
          ...complaint, 
          status: 'PURGED/DELETED', 
          description: `ALERT: Record permanently removed from central database by ${user.username}` 
        };
        try {
          if (navigator.onLine) {
            await googleSheetsService.syncActivity('Operational Logs', deletionLog);
          } else {
            googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: deletionLog });
          }
        } catch (err) {
          googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: deletionLog });
        }
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to delete complaint.');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, status: ComplaintStatus, remarks?: string, customerReview?: string) => {
    if (!user) return;
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;
      await firebaseService.updateComplaintStatus(id, status, customerName, user.fullName || user.username, user.uid, remarks, customerReview);
      toast.success(`Status updated to ${status}`);

      // Auto-sync for Operational Logs (History)
      if (complaint) {
        const updatedData = { ...complaint, status, remarks: remarks || complaint.remarks };
        try {
          if (navigator.onLine) {
            await googleSheetsService.syncActivity('Operational Logs', updatedData);
          } else {
            googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
          }
        } catch (err) {
          googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
        }
      }
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
      await firebaseService.updateComplaintRemarks(id, remarks, customerName, user.fullName || user.username, user.uid);
      toast.success('Protocol remarks updated successfully');

      // Auto-sync for Operational Logs (History)
      if (complaint) {
        const updatedData = { ...complaint, remarks };
        try {
          if (navigator.onLine) {
            await googleSheetsService.syncActivity('Operational Logs', updatedData);
          } else {
            googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
          }
        } catch (err) {
          googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
        }
      }
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
      await firebaseService.updateComplaint(id, data, customerName, user.fullName || user.username);
      toast.success('Log record updated successfully');

      // Auto-sync for Operational Logs (History/Updates/Remarks)
      if (complaint) {
        const updatedData = { ...complaint, ...data };
        try {
          if (navigator.onLine) {
            await googleSheetsService.syncActivity('Operational Logs', updatedData);
          } else {
            googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
          }
        } catch (err) {
          googleSheetsService.syncQueue.add({ tabName: 'Operational Logs', data: updatedData });
        }
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update record.');
    }
  };

  const handleCreateUser = async (username: string, pass: string, role: UserProfile['role'], dealerId?: string, lineCode?: string, companyName?: string) => {
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
      const newUser = await firebaseService.createUser(uid, trimmedName, pass, role, user.uid, user.fullName || user.username, dealerId, lineCode, companyName);
      toast.success(`${role === 'dealer' ? 'Dealer' : 'User'} ${trimmedName} created successfully!`);

      // Auto-sync to User Register
      try {
        if (navigator.onLine) {
          await googleSheetsService.syncUser(newUser);
        } else {
          googleSheetsService.syncQueue.add({ tabName: 'User Register', data: newUser });
        }
      } catch (err) {
        googleSheetsService.syncQueue.add({ tabName: 'User Register', data: newUser });
      }
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
      await firebaseService.deleteUser(uid, username, user.fullName || user.username);
      toast.success('User deleted successfully');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to delete user.');
    }
  };

  const handleUpdateUser = async (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role'], profilePicture?: string, email?: string) => {
    if (!user) return;
    try {
      await firebaseService.updateUser(uid, { username, password: pass, fullName, role, ...(lineCode && { lineCode }), ...(companyName && { companyName }), ...(profilePicture && { profilePicture }), ...(email && { email: email.trim() }) }, user.fullName || user.username);
      
      const targetUser = users.find(u => u.uid === uid);
      const updatedUserObj = {
        ...(targetUser || {}),
        uid,
        username,
        password: pass,
        fullName,
        role: role || targetUser?.role || 'user',
        ...(lineCode && { lineCode }),
        ...(companyName && { companyName }),
        ...(profilePicture && { profilePicture }),
        ...(email && { email: email.trim() })
      };

      // Ensure a shadow Firebase Auth user exists for sendPasswordResetEmail to work
      if (email && email.trim() !== '') {
        try {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          await createUserWithEmailAndPassword(auth, email.trim(), pass);
          console.log(`Shadow Firebase Auth account ensured for ${email.trim()}`);
        } catch (authErr: any) {
          if (authErr.code !== 'auth/email-already-in-use') {
            console.warn("Defensive shadow account registration message:", authErr.message);
          }
        }
      }

      // If updating self, update local user state too
      if (user && user.uid === uid) {
        const updatedUser = { ...user, username, password: pass, fullName, ...(role && { role }), ...(lineCode && { lineCode }), ...(companyName && { companyName }), ...(profilePicture && { profilePicture }), ...(email && { email: email.trim() }) };
        setUser(updatedUser);
        safeLocalStorage.setItem('complaint_app_user', safeStringify(updatedUser));
      }
      
      toast.success('User details updated successfully!');

      // Auto-sync user details changes to Google Sheets User Register in background
      try {
        if (navigator.onLine) {
          await googleSheetsService.syncUser(updatedUserObj);
        } else {
          googleSheetsService.syncQueue.add({ tabName: 'User Register', data: updatedUserObj });
        }
      } catch (err) {
        googleSheetsService.syncQueue.add({ tabName: 'User Register', data: updatedUserObj });
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to update user details.');
    }
  };

  const handleChangeAdminPass = async (newPass: string) => {
    if (!user) return;
    try {
      await firebaseService.updateUserPassword(user.uid, user.username, newPass, user.fullName || user.username);
      const updatedUsers = await firebaseService.getUsers();
      setUsers(updatedUsers);
      
      // Update local state and persistence
      const updatedUser = { ...user, password: newPass };
      setUser(updatedUser);
      safeLocalStorage.setItem('complaint_app_user', safeStringify(updatedUser));
      
      toast.success(`Admin password changed successfully!`);

      // Auto-sync user details changes to Google Sheets User Register in background
      try {
        if (navigator.onLine) {
          await googleSheetsService.syncUser(updatedUser);
        } else {
          googleSheetsService.syncQueue.add({ tabName: 'User Register', data: updatedUser });
        }
      } catch (err) {
        googleSheetsService.syncQueue.add({ tabName: 'User Register', data: updatedUser });
      }
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
    firebaseService.updateConfig(newConfig, user.fullName || user.username, tenantId);
    toast.success('System configuration updated');
    
    // Auto-sync to Google Sheets (System Config)
    googleSheetsService.syncSystemConfig(newConfig, branding);
  };

  const handleUpdateBranding = async (newBranding: BrandingConfig) => {
    if (!user) return;
    try {
      // Intelligently preserve or update translations based on presence of caller edits
      const mergedTranslations = newBranding.translations !== undefined 
        ? newBranding.translations 
        : (branding?.translations || {});

      const mergedBranding = {
        ...newBranding,
        translations: mergedTranslations
      };
      
      await firebaseService.updateBranding(mergedBranding, user.fullName || user.username);
      
      if (newBranding.translations !== undefined) {
        await firebaseService.updateTranslations(mergedTranslations);
      }

      setBranding(mergedBranding);

      try {
        safeLocalStorage.setItem('gts_branding', JSON.stringify(mergedBranding));
        safeLocalStorage.setItem('gts_translations', JSON.stringify(mergedTranslations));
      } catch (e) {
        console.warn("Failed to cache merged branding:", e);
      }

      toast.success('Global UI Metrics Reconfigured and Synchronized');
      
      // Auto-sync to Google Sheets (System Config)
      googleSheetsService.syncSystemConfig(appConfig, mergedBranding);
    } catch (err) {
      console.error("Branding update failure:", err);
      toast.error('Failed to update system branding protocols');
    }
  };

  const handleUpdateUserStatus = async (uid: string, status: UserProfile['status']) => {
    if (!user) return;
    try {
      await firebaseService.updateUserStatus(uid, status, user.fullName || user.username);
      toast.success(`User status updated to ${status?.toUpperCase()}`);
    } catch (err) {
      console.error("User status update failure:", err);
      toast.error('Failed to update user status');
    }
  };

  return (
    <>
      <Toaster 
        position="bottom-right" 
        theme="system"
        expand={true}
        maxToasts={5}
        toastOptions={{
          classNames: {
            toast: 'group toast !bg-white/95 dark:!bg-slate-900/95 !backdrop-blur-xl !border !border-slate-200/60 dark:!border-slate-800/80 !shadow-2xl dark:!shadow-neutral-950/70 !rounded-2xl !p-4 !font-sans !transition-all !duration-300 hover:!scale-[1.02] active:!scale-[0.98]',
            title: '!text-xs sm:!text-sm !font-black !tracking-tight !text-slate-900 dark:!text-slate-50',
            description: '!text-[10px] sm:!text-xs !font-bold !text-slate-500 dark:!text-slate-400 !leading-relaxed !mt-1',
            actionButton: '!bg-slate-900 dark:!bg-brand-accent !text-white !font-bold !text-[10px] sm:!text-xs !rounded-xl !px-3 !py-1.5 hover:!opacity-95 transition-opacity',
            cancelButton: '!bg-slate-100 dark:!bg-slate-800 !text-slate-600 dark:!text-slate-300 !font-bold !text-[10px] sm:!text-xs !rounded-xl !px-3 !py-1.5 hover:!bg-slate-200 dark:hover:!bg-slate-700 transition-colors',
            success: '!border-emerald-500/30 dark:!border-emerald-500/40 !bg-gradient-to-r !from-emerald-500/[0.04] !to-transparent',
            error: '!border-rose-500/30 dark:!border-rose-500/40 !bg-gradient-to-r !from-rose-500/[0.04] !to-transparent',
            info: '!border-blue-500/30 dark:!border-blue-500/40 !bg-gradient-to-r !from-blue-500/[0.04] !to-transparent',
            warning: '!border-amber-500/30 dark:!border-amber-500/40 !bg-gradient-to-r !from-amber-500/[0.04] !to-transparent',
          }
        }}
      />
      <AnimatePresence>
        {showWelcome && user && (
          <WelcomeOverlay 
            username={user.username} 
            fullName={user.fullName}
            profilePicture={user.profilePicture}
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
        onUpdateUser={handleUpdateUser}
        branding={branding}
        onUpdateBranding={handleUpdateBranding}
        activeTab={activeTab}
        onNavigate={setActiveTab}
      >
        {!firebaseAuthReady ? (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
            <FiberLoading fullScreen />
          </div>
        ) : !user ? (
        <LoginForm onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} isLoading={isLoading} error={error} />
      ) : (user.role === 'admin' || user.role === 'super_admin' || user.role === 'dealer' || user.role === 'editor') ? (
        <AdminPanel
          complaints={processedComplaints}
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
          onUpdateUserStatus={handleUpdateUserStatus}
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
          branding={branding}
          onUpdateBranding={handleUpdateBranding}
          activeTab={activeTab}
          onNavigate={setActiveTab}
        />
      ) : (
        <MemberPanel
          complaints={processedComplaints}
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
          branding={branding}
          activeTab={activeTab}
          onNavigate={setActiveTab}
        />
      )}
    </Layout>
    </>
  );
}
