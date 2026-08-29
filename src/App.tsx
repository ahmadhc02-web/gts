import { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy, ComponentType } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { getTabFromPathname, getPathnameFromTab } from './lib/routingUtils';
import { safeLocalStorage } from './lib/safeLocalStorage';
import Layout from './components/Layout';
import WelcomeOverlay from './components/WelcomeOverlay';
import { Complaint, UserProfile, ComplaintStatus, ChatGroup, Notification as AppNotification, BrandingConfig, ComplaintReview } from './types';
import { pocketbaseService, supabaseService, fromDb } from './lib/supabaseService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { googleSheetsService } from './services/googleSheetsService';
import { Toaster, toast } from 'sonner';
import { DEFAULT_CATEGORIES, DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_ZONES, AppConfig, DEFAULT_BRANDING } from './constants';
import { AnimatePresence, motion } from 'motion/react';
import { safeStringify, processScheduledComplaints } from './lib/utils';
import RouteLoadingFallback from './components/RouteLoadingFallback';
import ServiceMonitor from './components/ServiceMonitor';
import GlobalProgressLoader from './components/GlobalProgressLoader';
import { Clock } from 'lucide-react';

import { useOnlineStatus } from './hooks/useOnlineStatus';

function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.warn('Dynamic module import failed, attempting fallback reload...', error);
      // Wait 300ms and retry once
      await new Promise(res => setTimeout(res, 300));
      try {
        return await importFn();
      } catch (retryErr) {
        console.error('Dynamic module reload failed:', retryErr);
        throw retryErr;
      }
    }
  });
}

const LoginForm = lazyWithRetry(() => import('./components/LoginForm'));
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel'));
const MemberPanel = lazyWithRetry(() => import('./components/MemberPanel'));

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

  const [pbAuthReady, setPbAuthReady] = useState(true);
  const [pbUser, setPbUser] = useState<any>({ uid: 'local_anon_user' });

  const [lineCodeReady, setLineCodeReady] = useState(true);

  const [userState, _setUser] = useState<UserProfile | null>(() => {
    try {
      const savedUser = safeLocalStorage.getItem('complaint_app_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        pocketbaseService.setActiveLineCode(parsed?.lineCode);
        return parsed;
      }
      pocketbaseService.setActiveLineCode(undefined);
      return null;
    } catch (e) {
      console.error("Failed to parse saved user:", e);
      pocketbaseService.setActiveLineCode(undefined);
      return null;
    }
  });

  const user = userState;
  const setUser = (newUser: UserProfile | null | ((prev: UserProfile | null) => UserProfile | null)) => {
    if (typeof newUser === 'function') {
      _setUser((prev: UserProfile | null) => {
        const resolved = newUser(prev);
        pocketbaseService.setActiveLineCode(resolved?.lineCode);
        return resolved;
      });
    } else {
      pocketbaseService.setActiveLineCode(newUser?.lineCode);
      _setUser(newUser);
    }
    setLineCodeReady(true);
  };
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    return getTabFromPathname(location.pathname, location.search);
  }, [location.pathname, location.search]);

  const handleNavigate = useCallback((tabId: string) => {
    const targetPath = getPathnameFromTab(tabId);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  }, [location.pathname, navigate]);
  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    try {
      const activeDealerId = userState?.role === 'dealer' || (userState?.dealerId && userState?.dealerId !== 'main') ? (userState?.dealerId !== 'main' ? userState?.dealerId : userState?.uid) : 'all';
      const cached = localStorage.getItem(`gts_cache_v3_complaints_${activeDealerId || 'all'}_${userState?.lineCode || 'nolc'}`) || localStorage.getItem(`gts_cache_v3_complaints_all_${userState?.lineCode || 'nolc'}`);
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
      const activeDealerId = userState?.role === 'dealer' || (userState?.dealerId && userState?.dealerId !== 'main') ? (userState?.dealerId !== 'main' ? userState?.dealerId : userState?.uid) : 'all';
      const cached = localStorage.getItem(`gts_cache_v3_users_${activeDealerId || 'all'}_${userState?.lineCode || 'nolc'}`) || localStorage.getItem(`gts_cache_v3_users_all_${userState?.lineCode || 'nolc'}`);
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const isSuspended = useMemo(() => {
    if (!user) return false;
    
    // 1. If user is a dealer and blocked
    if (user.role === 'dealer' && user.status === 'blocked') {
      return true;
    }
    
    // 2. If user is created by a dealer, and that parent dealer is blocked
    if (user.dealerId && user.dealerId !== 'main') {
      const parentDealer = users.find(u => u.uid === user.dealerId && u.role === 'dealer');
      if (parentDealer && parentDealer.status === 'blocked') {
        return true;
      }
    }

    // 3. Or if user's own status is blocked
    if (user.status === 'blocked') {
      return true;
    }
    
    return false;
  }, [user?.uid, user?.status, user?.dealerId, users]);
  const [userGroups, setUserGroups] = useState<ChatGroup[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const cached = safeLocalStorage.getItem('gts_app_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {
      categories: DEFAULT_CATEGORIES,
      statuses: DEFAULT_STATUSES,
      priorities: DEFAULT_PRIORITIES,
      zones: DEFAULT_ZONES,
      billingSecurityKey: '1239870'
    };
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
  const [isLoading, setIsLoading] = useState(false);
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
  // Use a short, clean two-tone Note-style chime
  const [notificationAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3'));
  const [chatAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3'));

  // Sync initial audio states
  useEffect(() => {
    notificationAudio.muted = isAudioMuted;
    chatAudio.muted = isAudioMuted;
  }, [notificationAudio, chatAudio, isAudioMuted]);

  // Suspension warning effect: recurring 30-minute notifications + immediate beep alert
  useEffect(() => {
    if (!isSuspended) return;

    const showSuspensionAlert = () => {
      toast.error("⚠️ SYSTEM INSTANCE SUSPENDED / FROZEN", {
        description: "ATTENTION: This network branch has been deactivated by Super Admin. All administrative actions and ticket registrations are locked.",
        duration: 10000,
      });
      
      if (!isAudioMuted && typeof AudioContext !== 'undefined') {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(155, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(85, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch (e) {
          console.warn("Audio feedback blocked:", e);
        }
      }
    };

    showSuspensionAlert();
    const intervalId = setInterval(showSuspensionAlert, 30 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isSuspended, isAudioMuted]);

  // Route Guard: Redirect unauthenticated users to /login, and logged in users away from /login
  useEffect(() => {
    if (!pbAuthReady) return;
    const currentPath = location.pathname;
    if (!user && currentPath !== '/login') {
      navigate('/login', { replace: true });
    } else if (user && (currentPath === '/login' || currentPath === '/')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user?.uid, pbAuthReady, location.pathname, navigate]);

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
  }, [user?.uid]);

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
        pocketbaseService.updateUserPresence(user.uid).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Immediate presence update
    pocketbaseService.updateUserPresence(user.uid).catch(() => {});
    
    const presenceInterval = setInterval(() => {
      pocketbaseService.updateUserPresence(user.uid).catch(() => {});
    }, 120000); // Pulse every 2 mins

    return () => {
      clearInterval(interval);
      clearInterval(presenceInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, [user?.uid]);

  // Sync branding subscriptions
  useEffect(() => {
    if (!pbAuthReady) return;
    
    return pocketbaseService.subscribeBranding((data) => {
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
  }, [pbAuthReady]);

  // Synchronize unbreakable lifetime translations from Firestore and merge them into branding
  useEffect(() => {
    if (!pbAuthReady) return;

    return pocketbaseService.subscribeTranslations((data) => {
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
  }, [pbAuthReady]);

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
    if (!pbAuthReady) return;
    
    const unsubscribe = googleSheetsService.subscribeGoogleSheetsConfig((data) => {
      console.log('App: Live Google Sheets config synced from Firestore real-time.');
    });
    
    return () => unsubscribe();
  }, [pbAuthReady]);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;
    let initialized = false;

    const init = async (userAuth: any) => {
      console.log('App: Initializing Data Registry...');
      
      // Load Google Sheets config from Firestore in background
      googleSheetsService.loadConfigFromFirestore().catch(e => {
        console.warn("Could not retrieve shared Google Sheets configuration:", e);
      });
      
      try {
        // Fetch all users in background with safety timeout fallback
        pocketbaseService.getUsers().then((initialUsers) => {
          if (initialUsers && initialUsers.length > 0) {
            const currentUsers = [...initialUsers];
            setUsers(currentUsers);

            // Re-validate current session identity against the fresh registry
            if (user) {
              const freshUser = currentUsers.find(u => u.username.toLowerCase() === user.username.toLowerCase() || u.uid === user.uid);
              
              if (freshUser) {
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
                } else {
                  const mergedUser = {
                    ...user,
                    ...freshUser,
                    profilePicture: freshUser.profilePicture || user.profilePicture
                  };
                  if (safeStringify(mergedUser) !== safeStringify(user)) {
                    setUser(mergedUser);
                    safeLocalStorage.setItem('complaint_app_user', safeStringify(mergedUser));
                  }
                }
              }
            }
          }
        }).catch(err => {
          console.warn("Background user fetch warning:", err);
        });
      } catch (err) {
        console.error("Initialization error:", err instanceof Error ? err.message : String(err));
      }
    };

    // Direct database loading
    const startBypass = async () => {
      const mockUserAuth = { uid: 'local_anon_user' };
      setPbUser(mockUserAuth);
      setPbAuthReady(true);
      if (!initialized) {
        initialized = true;
        await init(mockUserAuth);
      }
    };
    startBypass();

    return () => {};
  }, []);

  // Real-time config updates
  useEffect(() => {
    if (!user) return;
    if (!pbAuthReady) return;
    
    const tenantId = pocketbaseService.getReadTenantId(user);
    
    // Subscribe to app config for the current tenant
    const unsubscribeConfig = pocketbaseService.subscribeConfig((data) => {
      if (data) {
        const fetchedStatuses = data.statuses && data.statuses.length > 0 ? data.statuses : DEFAULT_STATUSES;
        const finalStatuses = fetchedStatuses.includes('scheduled') ? fetchedStatuses : [...fetchedStatuses, 'scheduled'];
        
        setAppConfig({
          categories: data.categories && data.categories.length > 0 ? data.categories : DEFAULT_CATEGORIES,
          statuses: finalStatuses,
          priorities: data.priorities && data.priorities.length > 0 ? data.priorities : DEFAULT_PRIORITIES,
          zones: data.zones && data.zones.length > 0 ? data.zones : DEFAULT_ZONES,
          billingSecurityKey: data.billingSecurityKey || '1239870',
        });
      }
    }, tenantId);

    return () => {
      unsubscribeConfig();
    };
  }, [user?.uid, user?.role, user?.dealerId, pbAuthReady]);

  // Real-time user updates for presence and management (Only active when on users/chat/dealers screen)
  useEffect(() => {
    if (!user) return;
    if (!pbAuthReady) return;

    const tenantId = pocketbaseService.getReadTenantId(user);
    const shouldSubscribeUsers = ['users', 'chat', 'dealers'].includes(activeTab || '');

    if (!shouldSubscribeUsers) {
      // Offline fallback / warm start: fetch once to ensure suspension rules and names are accurate, without real-time listener overhead
      pocketbaseService.getUsers(tenantId).then(setUsers).catch(console.error);
      return;
    }

    const unsubscribeUsers = pocketbaseService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers);
    }, tenantId);

    return () => {
      unsubscribeUsers();
    };
  }, [user?.uid, user?.role, user?.dealerId, pbAuthReady, activeTab]);

  // Real-time chat groups updates (Only active when chat screen is opened)
  useEffect(() => {
    if (!user) return;
    if (!pbAuthReady) return;

    const tenantId = pocketbaseService.getReadTenantId(user);
    const shouldSubscribeGroups = ['chat'].includes(activeTab || '');

    if (!shouldSubscribeGroups) {
      // Offline fallback / warm start: fetch once
      pocketbaseService.getGroups(tenantId).then(setUserGroups).catch(console.error);
      return;
    }

    const unsubscribeGroups = pocketbaseService.subscribeGroups((updatedGroups) => {
      setUserGroups(updatedGroups);
    }, tenantId);

    return () => {
      unsubscribeGroups();
    };
  }, [user?.uid, user?.role, user?.dealerId, pbAuthReady, activeTab]);

  // Fetch and subscribe to complaints for live updates across all tabs
  useEffect(() => {
    if (!user) {
      setComplaints([]);
      return;
    }
    if (!pbAuthReady) return;
    
    const tenantId = pocketbaseService.getReadTenantId(user);
    
    const unsubscribe = pocketbaseService.subscribeComplaints((data) => {
      setComplaints(data);
    }, tenantId);

    return () => unsubscribe();
  }, [user?.uid, user?.role, user?.dealerId, pbAuthReady]);

  // Real-time data fetch functions to instantly synchronize local states from database
  const fetchComplaints = async () => {
    if (!user) return;
    const tenantId = pocketbaseService.getReadTenantId(user);
    try {
      console.log("[Database Sync] Fetching updated complaints...");
      const data = await pocketbaseService.getComplaints(tenantId);
      setComplaints(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error("[Database Sync] fetchComplaints failed:", e);
    }
  };

  const fetchClients = async () => {
    if (!user) return;
    const tenantId = pocketbaseService.getReadTenantId(user);
    try {
      console.log("[Database Sync] Fetching updated clients...");
      const data = await pocketbaseService.getClients(tenantId);
      // Dispatch custom window event to trigger updates across ClientManagement and AdminPanel components
      window.dispatchEvent(new CustomEvent('database-clients-updated', { detail: data }));
      window.dispatchEvent(new CustomEvent('pocketbase-clients-updated', { detail: data }));
    } catch (e) {
      console.error("[Database Sync] fetchClients failed:", e);
    }
  };

  const fetchBrandingConfig = async () => {
    if (!user) return;
    const tenantId = pocketbaseService.getReadTenantId(user);
    try {
      console.log("[Database Sync] Fetching updated branding configs...");
      const config = await pocketbaseService.getAppConfig(tenantId);
      if (config) {
        const fetchedStatuses = config.statuses || DEFAULT_STATUSES;
        const finalStatuses = fetchedStatuses.includes('scheduled') ? fetchedStatuses : [...fetchedStatuses, 'scheduled'];
        
        setAppConfig({
          categories: config.categories || DEFAULT_CATEGORIES,
          statuses: finalStatuses,
          priorities: config.priorities || DEFAULT_PRIORITIES,
          zones: config.zones || DEFAULT_ZONES,
          billingSecurityKey: config.billingSecurityKey || '1239870',
        });
      }
    } catch (e) {
      console.error("[Database Sync] fetchBrandingConfig failed:", e);
    }
  };

  // 10-Minute Automatic Background Bulk System Backup Scheduler
  useEffect(() => {
    if (!pbAuthReady) return;

    let timer: NodeJS.Timeout;
    const TEN_MINUTES = 10 * 60 * 1000;
    const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

    const runCheck = async () => {
      // NOTE: User requested to disable the automatic 10m background backup
      return;
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
  }, [pbAuthReady]);

  // Centralized Notifications Subscription
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    if (!pbAuthReady) return;
    
    const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
    let isInitialLoad = true;
    let lastNotificationId = '';

    const unsubscribe = pocketbaseService.subscribeNotifications((data) => {
      const regularNotifications = data.filter(n => n.type !== 'recycle_bin');
      setNotifications(regularNotifications);
      if (regularNotifications.length > 0) {
        const latest = regularNotifications[0]; // notifications are descending
        
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
      } else {
        isInitialLoad = false;
      }
    }, tenantId);

    return () => unsubscribe();
  }, [user?.uid, pbAuthReady, alertAuthorized, isAudioMuted, notificationAudio]);

  // Global Chat Notifications
  useEffect(() => {
    if (!user) return;
    if (!pbAuthReady) return;
    
    let isInitialLoad = true;
    let lastMessageId = '';

    const tenantId = user ? pocketbaseService.getReadTenantId(user) : undefined;
    const userGroupIds = userGroups.map(g => g.id);

    const unsubscribe = pocketbaseService.subscribeMessages((data) => {
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
  }, [user?.uid, pbAuthReady, alertAuthorized, isAudioMuted, chatAudio, userGroups]);

  // Global Broadcast Channel for Real-time Complaints Sync and Alerts
  useEffect(() => {
    if (!user) return;
    if (!pbAuthReady) return;

    const channelName = 'gts-realtime-channel';
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'complaint_registered' }, (payload: any) => {
        console.log('[BROADCAST] Live complaint notification received:', payload);
        const { complaint, authorName, dealerId } = payload.payload;

        // Check if the complaint belongs to this tenant/dealer
        const currentTenantId = pocketbaseService.getReadTenantId(user);
        const complaintTenantId = dealerId || 'main';

        if (!currentTenantId || currentTenantId === 'all' || currentTenantId === complaintTenantId) {
          // Update complaints state (preventing duplicates and alerting user)
          setComplaints(prev => {
            if (prev.some(c => c.id === complaint.id)) return prev;

            const isSelf = authorName === user.username || (user.fullName && authorName === user.fullName);
            // Only notify if not authored by self
            if (!isSelf) {
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
              toast.info(`🔔 NEW COMPLAINT REGISTERED`, {
                description: `New complaint for ${complaint.customerName} (${complaint.area}) - By ${authorName}`,
                duration: 8000,
                icon: '🔔',
              });

              // Background/Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                const options = {
                  body: `New complaint for ${complaint.customerName} (${complaint.area})\nBy: ${authorName}`,
                  icon: '/vite.svg',
                  badge: '/vite.svg',
                  vibrate: [200, 100, 200]
                };
                new Notification(`GTS: NEW COMPLAINT`, options);
              }
            }

            return [complaint, ...prev];
          });
        }
      })
      .on('broadcast', { event: 'complaint_updated' }, (payload: any) => {
        console.log('[BROADCAST] Live complaint update received:', payload);
        const { complaint, authorName, dealerId } = payload.payload;

        // Check if the complaint belongs to this tenant/dealer
        const currentTenantId = pocketbaseService.getReadTenantId(user);
        const complaintTenantId = dealerId || 'main';

        if (!currentTenantId || currentTenantId === 'all' || currentTenantId === complaintTenantId) {
          setComplaints(prev => {
            const isSelf = authorName === user.username || (user.fullName && authorName === user.fullName);
            // Only alert if not authored by self
            if (!isSelf) {
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
              toast.info(`🔄 COMPLAINT STATUS UPDATED`, {
                description: `Complaint #${complaint.id} (${complaint.customerName || 'Customer'}) status updated to ${complaint.status} - By ${authorName}`,
                duration: 8000,
                icon: '🔄',
              });

              // Background/Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                const options = {
                  body: `Complaint #${complaint.id} (${complaint.customerName || 'Customer'}) updated to ${complaint.status}\nBy: ${authorName}`,
                  icon: '/vite.svg',
                  badge: '/vite.svg',
                  vibrate: [200, 100, 200]
                };
                new Notification(`GTS: COMPLAINT UPDATED`, options);
              }
            }

            const exists = prev.some(c => c.id === complaint.id);
            if (!exists) {
              return [complaint, ...prev];
            }
            return prev.map(c => c.id === complaint.id ? { ...c, ...complaint } : c);
          });
        }
      })
      .on('broadcast', { event: 'complaint_deleted' }, (payload: any) => {
        console.log('[BROADCAST] Live complaint deletion received:', payload);
        const { complaintId, authorName, dealerId } = payload.payload;

        // Check if the complaint belongs to this tenant/dealer
        const currentTenantId = pocketbaseService.getReadTenantId(user);
        const complaintTenantId = dealerId || 'main';

        if (!currentTenantId || currentTenantId === 'all' || currentTenantId === complaintTenantId) {
          setComplaints(prev => {
            const target = prev.find(c => c.id === complaintId);
            const isSelf = authorName === user.username || (user.fullName && authorName === user.fullName);
            if (!isSelf) {
              toast.info(`🗑️ COMPLAINT DELETED`, {
                description: `Complaint #${complaintId} ${target?.customerName ? `(${target.customerName})` : ''} was deleted by ${authorName}`,
                duration: 6000,
                icon: '🗑️',
              });
            }
            return prev.filter(c => c.id !== complaintId);
          });
        }
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  }, [user?.uid, user?.username, user?.fullName, user?.role, user?.dealerId, pbAuthReady, alertAuthorized, isAudioMuted, notificationAudio]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const loginUser = async (email: string, displayName: string, uid: string) => {
      let effectiveUsers = users;
      if (effectiveUsers.length === 0) {
        effectiveUsers = await pocketbaseService.getUsers();
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
        foundUser = await pocketbaseService.createUser(
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
        if (!tokens || !tokens.access_token) {
          throw new Error("No Access Token found in retrieved authorization tokens.");
        }
        
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to retrieve Google profile: ${res.statusText}`);
        }
        const userInfo = await res.json();
        const email = userInfo.email;
        if (!email) throw new Error("No email associated with this Google account.");

        await loginUser(email, userInfo.name || userInfo.given_name || email.split('@')[0], userInfo.sub);
      } catch (authErr: any) {
        console.error("Google Profile retrieval failed:", authErr);
        setError(`Google Authentication Failed: ${authErr.message || authErr}`);
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
      await runServerOAuthFallback();
    } catch (e: any) {
      console.error("Google Auth Exception:", e);
      let errorMessage = 'Google Authentication Failed. Please try again.';
      if (e.message) {
         errorMessage = `OAuth Protocol Error: ${e.message}`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (username: string, pass: string, lineCode?: string) => {
    setIsLoading(true);
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPass = pass.trim();

    try {
      // Direct live fetch from database to guarantee up-to-date registry
      let effectiveUsers = [];
      try {
        effectiveUsers = await Promise.race([
          pocketbaseService.getUsers('all'),
          new Promise<UserProfile[]>((_, reject) => setTimeout(() => reject(new Error("Timeout getting users")), 2500))
        ]).catch(() => []);
      } catch (err) {
        console.warn("Could not retrieve users list in login query:", err);
      }

      if (effectiveUsers.length > 0) {
        setUsers(effectiveUsers);
      } else {
        effectiveUsers = users;
      }

      // If a line code is provided, validate it
      if (lineCode) {
        const networkOwner = await pocketbaseService.getNetworkOwnerByLineCode(lineCode).catch(() => null);
        if (!networkOwner) {
          setError('Invalid Network Code. Access Denied.');
          setIsLoading(false);
          return;
        }
        
        if (networkOwner.role !== 'super_admin') {
           const dealerId = networkOwner.uid;
           const networkUsers = await pocketbaseService.getUsers(dealerId).catch(() => []);
           effectiveUsers = [networkOwner, ...networkUsers];
        }
      }

      let foundUser = effectiveUsers.find(u => 
        u.username.trim().toLowerCase() === cleanUsername || 
        (u.email && u.email.trim().toLowerCase() === cleanUsername) ||
        u.uid === username.trim()
      );

      let isCredentialsValid = false;
      if (foundUser) {
        if (foundUser.password === pass || foundUser.password === cleanPass) {
          isCredentialsValid = true;
        }
      }

      // Fallback 1: Direct item query from Supabase if not found in list or password mismatched
      if (!isCredentialsValid) {
        let supabaseUser = null;
        let supabaseError = null;
        let queryExceptionOccurred = false;

        try {
          // Try Supabase First if Configured
          if (isSupabaseConfigured && supabase) {
              // Direct query execution on users_data first
              const { data: userData, error: userErr } = await supabase
                .from("users_data")
                .select("*")
                .or(`username.eq.${username.trim()},email.eq.${username.trim()},uid.eq.${username.trim()}`)
                .limit(1)
                .maybeSingle();

              if (userErr) {
                console.log("Supabase users_data login query error:", userErr);
                supabaseError = userErr;
              } else if (userData) {
                supabaseUser = userData;
              }

              // Fallback to login_profiles if not found in users_data
              if (!supabaseUser && !supabaseError) {
                const { data: profileData, error: profileErr } = await supabase
                  .from("login_profiles")
                  .select("*")
                  .or(`username.eq.${username.trim()},email.eq.${username.trim()},uid.eq.${username.trim()}`)
                  .limit(1)
                  .maybeSingle();

                if (profileErr) {
                  console.log("Supabase login_profiles query error:", profileErr);
                  supabaseError = profileErr;
                } else if (profileData) {
                  supabaseUser = profileData;
                }
              }

              // Fallback to users table if not found in either
              if (!supabaseUser && !supabaseError) {
                const { data: uData, error: uErr } = await supabase
                  .from("users")
                  .select("*")
                  .or(`username.eq.${username.trim()},email.eq.${username.trim()},uid.eq.${username.trim()}`)
                  .limit(1)
                  .maybeSingle();

                if (uErr) {
                  console.log("Supabase users query error:", uErr);
                  supabaseError = uErr;
                } else if (uData) {
                  supabaseUser = uData;
                }
              }
          }
        } catch (dbErr: any) {
          console.warn("Direct database lookup exception:", dbErr);
          supabaseError = dbErr;
          queryExceptionOccurred = true;
        }

        if (supabaseUser) {
          // Support password matching via 'password' or 'comments' field
          if (supabaseUser.password === pass || supabaseUser.password === cleanPass || supabaseUser.comments === pass || supabaseUser.comments === cleanPass) {
            const mappedUser = {
              uid: supabaseUser.uid || supabaseUser.id || username,
              username: supabaseUser.username,
              password: supabaseUser.password || supabaseUser.comments,
              role: supabaseUser.role || 'member',
              fullName: supabaseUser.full_name || supabaseUser.name || '',
              dealerId: supabaseUser.dealer_id || '',
              lineCode: supabaseUser.line_code || '',
              companyName: supabaseUser.company_name || '',
              createdAt: supabaseUser.created_at || Date.now(),
              email: supabaseUser.email || '',
              status: 'active'
            } as UserProfile;
            
            foundUser = mappedUser;
            isCredentialsValid = true;
            console.log("Supabase successful login for:", username);
          } else {
            console.log("Supabase login error: Invalid password", { username });
            setError('Invalid password.');
            setIsLoading(false);
            return;
          }
        }

        if (!isCredentialsValid && supabaseError) {
          console.log("Supabase login query error, falling back to Local/Firebase DB:", supabaseError);
          // Do not return here, allow fallback
        }
      }

      // Fallback 2: Default admin/user bootstrap if credentials match standard system defaults
      if (!isCredentialsValid) {
        if (cleanUsername === 'admin' && cleanPass === 'admin') {
          const sysAdmin = await pocketbaseService.createUser(
            'admin-001',
            'admin',
            'admin',
            'super_admin',
            'system',
            'System Core Boot',
            'main',
            'GTS-001',
            'GTS Global Telecom Services',
            'active'
          ).catch(() => null);
          if (sysAdmin) {
            foundUser = sysAdmin;
            isCredentialsValid = true;
          }
        } else if (cleanUsername === 'user' && cleanPass === 'user') {
          const sysUser = await pocketbaseService.createUser(
            'user-001',
            'user',
            'user',
            'member',
            'system',
            'System Core Boot',
            'main',
            'GTS-002',
            'GTS Partner',
            'active'
          ).catch(() => null);
          if (sysUser) {
            foundUser = sysUser;
            isCredentialsValid = true;
          }
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

        // Line Code Enforcement: Check if user or parent dealer has a Line Code configured
        let expectedLineCode = (foundUser.lineCode || '').trim();
        if (!expectedLineCode && foundUser.dealerId && foundUser.dealerId !== 'main') {
          const parentDealer = effectiveUsers.find(u => 
            u.uid === foundUser?.dealerId || 
            u.username.toLowerCase() === foundUser?.dealerId.toLowerCase()
          );
          if (parentDealer?.lineCode && parentDealer.lineCode.trim()) {
            expectedLineCode = parentDealer.lineCode.trim();
          }
        }

        const enteredLineCode = (lineCode || '').trim();

        // If the user has or inherits a Line Code, it is MANDATORY (lazmi) to provide it
        if (expectedLineCode) {
          if (!enteredLineCode) {
            setError('Line Code is required for this account. Please enter your Line Code to login. (لائن کوڈ درج کرنا لازمی ہے)');
            setIsLoading(false);
            return;
          }
          if (enteredLineCode.toLowerCase() !== expectedLineCode.toLowerCase()) {
            setError('Invalid Line Code: The entered Line Code does not match your account. (غلط لائن کوڈ)');
            setIsLoading(false);
            return;
          }
          foundUser.lineCode = expectedLineCode;
        } else if (enteredLineCode) {
          // If user provided a Line Code even if not directly configured, validate it in network
          const networkOwner = await pocketbaseService.getNetworkOwnerByLineCode(enteredLineCode).catch(() => null);
          if (!networkOwner) {
            setError('Invalid Line Code: Network Code not recognized.');
            setIsLoading(false);
            return;
          }
          foundUser.lineCode = enteredLineCode;
        }

        setUser(foundUser);
        safeLocalStorage.setItem('complaint_app_user', safeStringify(foundUser));
        setShowWelcome(true);
        toast.success(`Access Granted: Welcome back, ${foundUser.username}`);

        // Direct redirection to the GTS ISP Management dashboard
        navigate('/dashboard');

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
    navigate('/login');
    safeLocalStorage.removeItem('complaint_app_user');
    toast.info('Logged out successfully');
  };

  const handleRegisterComplaint = async (data: any, silent: boolean = false) => {
    if (!user) return;
    if (isSuspended) {
      toast.error("🔒 INTEGRITY PROTOCOL LOCKED", {
        description: "Your dealer network node is currently frozen by the Super Admin. All client-registered operations are suspended.",
        duration: 8000
      });
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      if (!navigator.onLine) {
        // Run in background for database persistence, don't await network resolution
        pocketbaseService.createComplaint(data, user).catch(console.error);

        // Treat it as locally persisted for UI
        const dummyComplaint = { ...data, id: 'temp_' + Date.now(), createdAt: Date.now() };
        googleSheetsService.syncQueue.add(dummyComplaint);

        if (!silent) toast.success('Offline mode: Saved locally and will sync when connected.');
        return;
      }

      const newComplaint = await pocketbaseService.createComplaint(data, user);
      
      // Verification step
      const verified = await pocketbaseService.verifyComplaintPersisted(newComplaint.id);
      if (!verified) {
        throw new Error('Verification failed: Complaint could not be verified after creation.');
      }

      // Create database notification for persistent syncing and live alerts
      try {
        await pocketbaseService.createNotification({
          type: 'complaint_created',
          message: `New Complaint registered for ${newComplaint.customerName} (${newComplaint.area})`,
          authorName: user.username,
          dealerId: newComplaint.dealerId || 'main',
          details: {
            complaintId: newComplaint.id,
            customerName: newComplaint.customerName,
            area: newComplaint.area,
            createdAt: Date.now()
          }
        });
      } catch (err) {
        console.warn("Could not create database notification:", err);
      }

      // Broadcast complaint registered event for real-time list update
      try {
        const channel = supabase.channel('gts-realtime-channel');
        channel.send({
          type: 'broadcast',
          event: 'complaint_registered',
          payload: {
            complaint: newComplaint,
            authorName: user.username,
            dealerId: newComplaint.dealerId || 'main'
          }
        }).catch(err => console.warn("Broadcast failed:", err));
      } catch (err) {
        console.warn("Could not broadcast complaint registration:", err);
      }

      if (!silent) toast.success('Complaint submitted and verified successfully!');
      
      // Update local cache manually (with duplicates prevention)
      setComplaints(prev => {
        if (prev.some(c => c.id === newComplaint.id)) return prev;
        return [newComplaint, ...prev];
      });
      
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

  const handleDeleteComplaint = async (id: string, isPermanent: boolean = false) => {
    if (!user) return;
    if (isSuspended) {
      toast.error("🔒 INTEGRITY PROTOCOL LOCKED", {
        description: "Your dealer network node is currently frozen by the Super Admin. Deletion is disabled.",
        duration: 8000
      });
      return;
    }
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;

      // Optimistic state update
      setComplaints(prev => prev.filter(c => c.id !== id));

      await pocketbaseService.deleteComplaint(id, customerName, user.fullName || user.username, complaint, isPermanent);
      if (isPermanent) {
        toast.success('Complaint permanently deleted!');
      } else {
        toast.success('Complaint moved to Recycle Bin!');
      }

      // Log deletion activity in Operational Logs
      if (complaint) {
        const deletionLog = { 
          ...complaint, 
          status: isPermanent ? 'PERMANENTLY DELETED' : 'RECYCLED/DELETED', 
          description: isPermanent 
            ? `ALERT: Record permanently deleted by ${user.username}` 
            : `ALERT: Record moved to Recycle Bin by ${user.username}` 
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

  const handleUpdateComplaintStatus = async (id: string, status: ComplaintStatus, remarks?: string, reviews?: ComplaintReview[]) => {
    if (!user) return;
    if (isSuspended) {
       toast.error("🔒 INTEGRITY PROTOCOL LOCKED", {
        description: "Your dealer network node is currently frozen by the Super Admin. Status updates are disabled.",
        duration: 8000
      });
      return;
    }
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;

      // Optimistic state update
      setComplaints(prev => prev.map(c => c.id === id ? {
        ...c,
        status,
        ...(remarks !== undefined && { remarks }),
        ...(reviews !== undefined && { reviews })
      } : c));

      await pocketbaseService.updateComplaintStatus(id, status, customerName, user.fullName || user.username, user.uid, remarks, reviews);
      toast.success(`Status updated to ${status}`);

      // Auto-sync for Operational Logs (History)
      if (complaint) {
        const updatedData = { ...complaint, status, remarks: remarks || complaint.remarks, reviews: reviews || complaint.reviews };
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
    if (isSuspended) {
      toast.error("🔒 INTEGRITY PROTOCOL LOCKED", {
        description: "Your dealer network node is currently frozen by the Super Admin. Remarks updates are disabled.",
        duration: 8000
      });
      return;
    }
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = complaint?.customerName || id;

      // Optimistic state update
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, remarks } : c));

      await pocketbaseService.updateComplaintRemarks(id, remarks, customerName, user.fullName || user.username, user.uid);
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
    if (isSuspended) {
      toast.error("🔒 INTEGRITY PROTOCOL LOCKED", {
        description: "Your dealer network node is currently frozen by the Super Admin. Editing tickets is disabled.",
        duration: 8000
      });
      return;
    }
    try {
      const complaint = complaints.find(c => c.id === id);
      const customerName = data.customerName || complaint?.customerName || id;
      await pocketbaseService.updateComplaint(id, data, customerName, user.fullName || user.username);
      
      // Verification step
      const verified = await pocketbaseService.verifyComplaintPersisted(id);
      if (!verified) {
        throw new Error('Verification failed: Complaint update could not be verified.');
      }

      toast.success('Log record updated and verified successfully');

      // Update local cache immediately
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));

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

  const handleCreateUser = async (username: string, pass: string, role: UserProfile['role'], dealerId?: string, lineCode?: string, companyName?: string, fullName?: string) => {
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
      
      // Auto-inherit dealer context if created by or under a dealer account
      const creatorDealerId = user.role === 'dealer' ? user.uid : (user.dealerId && user.dealerId !== 'main' ? user.dealerId : undefined);
      const creatorDealerObj = users.find(u => u.uid === creatorDealerId);
      const creatorLineCode = user.role === 'dealer' ? (user.lineCode || '') : (creatorDealerObj?.lineCode || user.lineCode || '');
      const creatorCompanyName = user.role === 'dealer' ? (user.companyName || '') : (creatorDealerObj?.companyName || user.companyName || '');

      const finalDealerId = dealerId || creatorDealerId || 'main';
      const finalLineCode = lineCode || creatorLineCode || '';
      const finalCompanyName = companyName || creatorCompanyName || '';

      const newUser = await pocketbaseService.createUser(
        uid, 
        trimmedName, 
        pass, 
        role, 
        user.uid, 
        user.fullName || user.username, 
        finalDealerId, 
        finalLineCode, 
        finalCompanyName, 
        'active', 
        fullName || trimmedName
      );
      
      // Optimistic UI update
      setUsers(prev => {
        if (prev.some(u => u.uid === newUser.uid)) return prev;
        return [...prev, newUser];
      });

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
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      toast.error(`Failed to create account: ${msg}`);
      throw e;
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!user) return;
    try {
      const targetUser = users.find(u => u.uid === uid);
      const username = targetUser?.username || uid;

      // Optimistic UI update
      setUsers(prev => prev.filter(u => u.uid !== uid));

      await pocketbaseService.deleteUser(uid, username, user.fullName || user.username, targetUser);
      toast.success('User moved to Recycle Bin!');
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      toast.error('Failed to delete user.');
    }
  };

  const handleUpdateUser = async (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role'], profilePicture?: string, email?: string) => {
    if (!user) return;
    try {
      console.log("App.tsx updating user:", uid, "with profilePicture:", profilePicture);
      
      const targetUser = users.find(u => u.uid === uid);
      const updatedUserObj = {
        ...(targetUser || {}),
        uid,
        username,
        password: pass,
        fullName,
        role: role || targetUser?.role || 'user',
        ...(lineCode !== undefined && { lineCode }),
        ...(companyName !== undefined && { companyName }),
        ...(profilePicture !== undefined && { profilePicture }),
        ...(email !== undefined && { email: email.trim() })
      } as any;

      if (profilePicture !== undefined) {
        try {
          const storedPics = JSON.parse(safeLocalStorage.getItem('gts_profile_pictures') || '{}');
          storedPics[uid] = profilePicture;
          safeLocalStorage.setItem('gts_profile_pictures', safeStringify(storedPics));
        } catch (e) {}
      }

      // Optimistic UI update
      setUsers(prev => prev.map(u => u.uid === uid ? updatedUserObj : u));

      await pocketbaseService.updateUser(uid, { username, password: pass, fullName, role, ...(lineCode !== undefined && { lineCode }), ...(companyName !== undefined && { companyName }), ...(profilePicture !== undefined && { profilePicture }), ...(email !== undefined && { email: email.trim() }) }, user.fullName || user.username);
      
      // If updating self, update local user state too
      if (user && user.uid === uid) {
        const updatedUser = { ...user, username, password: pass, fullName, ...(role !== undefined && { role }), ...(lineCode !== undefined && { lineCode }), ...(companyName !== undefined && { companyName }), ...(profilePicture !== undefined && { profilePicture }), ...(email !== undefined && { email: email.trim() }) };
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
      await pocketbaseService.updateUserPassword(user.uid, user.username, newPass, user.fullName || user.username);
      
      // Update local state and persistence
      const updatedUser = { ...user, password: newPass };
      setUser(updatedUser);
      safeLocalStorage.setItem('complaint_app_user', safeStringify(updatedUser));

      const updatedUsers = await pocketbaseService.getUsers();
      setUsers(updatedUsers);
      
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
      const updatedUsers = await pocketbaseService.getUsers();
      setUsers(updatedUsers);
    } catch (err) {
      console.error("Refresh failed:", err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = (newConfig: AppConfig) => {
    if (!user) return;
    setAppConfig(newConfig);
    try {
      safeLocalStorage.setItem('gts_app_config', JSON.stringify(newConfig));
    } catch (e) {}
    const tenantId = pocketbaseService.getTenantId(user);
    pocketbaseService.updateConfig(newConfig, user.fullName || user.username, tenantId);
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
      
      await pocketbaseService.updateBranding(mergedBranding, user.fullName || user.username);
      
      if (newBranding.translations !== undefined) {
        await pocketbaseService.updateTranslations(mergedTranslations);
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
      // Optimistic UI update
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, status } : u));

      await pocketbaseService.updateUserStatus(uid, status, user.fullName || user.username);
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
      <GlobalProgressLoader />
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
        onNavigate={handleNavigate}
        appConfig={appConfig}
        onRegisterComplaint={handleRegisterComplaint}
      >
        <Suspense fallback={<RouteLoadingFallback />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={!user ? 'login-view' : user.status === 'pending' ? 'pending-view' : `app-view-${user.uid || user.username || user.role}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {!user ? (
                <LoginForm onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} isLoading={isLoading} error={error} />
              ) : user.status === 'pending' ? (
                <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-amber-500/5 dark:bg-amber-500/10" />
                  <div className="max-w-md w-full text-center space-y-6 relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-amber-200/50 dark:border-amber-800/50 shadow-2xl">
                    <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Clock size={40} className="animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Registration Pending</h1>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Your network node registration is currently under review by the core administration team. Please wait for clearance.
                    </p>
                    <button 
                      onClick={handleLogout} 
                      className="mt-8 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:scale-105 transition-transform uppercase text-xs tracking-widest shadow-xl cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : lineCodeReady ? (
                (user.role === 'admin' || user.role === 'super_admin' || user.role === 'dealer' || user.role === 'editor') ? (
                  <AdminPanel
                    complaints={processedComplaints}
                    users={users}
                    currentUser={user}
                    isSuspended={isSuspended}
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
                    onNavigate={handleNavigate}
                  />
                ) : (
                  <MemberPanel
                    complaints={processedComplaints}
                    users={users}
                    currentUser={user}
                    isSuspended={isSuspended}
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
                    onNavigate={handleNavigate}
                  />
                )
              ) : null}
            </motion.div>
          </AnimatePresence>
        </Suspense>
    </Layout>
    </>
  );
}
