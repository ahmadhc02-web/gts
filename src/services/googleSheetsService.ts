// src/services/googleSheetsService.ts
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { safeStringify } from '../lib/utils';
import { safeLocalStorage } from '../lib/safeLocalStorage';

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('.run.app') ||
    host.includes('hf.space') ||
    host.includes('huggingface.co')
  ) {
    return endpoint;
  }
  // Production URL of the provisioned Cloud Run backend
  return `https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app${endpoint}`;
};

export interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

const TOKEN_KEY = 'gts_google_tokens';
const SHEET_ID_KEY = 'gts_spreadsheet_id';
const SHEET_NAME_KEY = 'gts_sheet_name';
const SHEET_RANGE_KEY = 'gts_sheet_range';

interface SheetsConfigCache {
  tokens: GoogleTokens | null;
  spreadsheetId: string | null;
  sheetName: string;
  sheetRange: string;
}

// Global in-memory configuration cache, kept fresh via Firestore live subscription 24/7
const configCache: SheetsConfigCache = {
  tokens: null,
  spreadsheetId: null,
  sheetName: 'Sheet1',
  sheetRange: 'A1',
};

// Fill from local storage immediately as a synchronous boot fallback
try {
  const localTokens = safeLocalStorage.getItem(TOKEN_KEY);
  if (localTokens) configCache.tokens = JSON.parse(localTokens);
  configCache.spreadsheetId = safeLocalStorage.getItem(SHEET_ID_KEY);
  configCache.sheetName = safeLocalStorage.getItem(SHEET_NAME_KEY) || 'Sheet1';
  configCache.sheetRange = safeLocalStorage.getItem(SHEET_RANGE_KEY) || 'A1';
} catch (e) {
  console.warn("Storage fallbacks parsing failed:", e);
}

// Provider setup for Google Workspace
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

export const googleSheetsService = {
  syncConfigToFirestore: async (updates: any) => {
    try {
      const { db } = await import('../lib/firebase');
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'config', 'google_sheets');
      const snap = await getDoc(docRef);
      const existing = snap.exists() ? snap.data() : {};
      await setDoc(docRef, {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("Failed syncing Google Sheets config to Firestore or permission denied:", e);
    }
  },

  loadConfigFromFirestore: async () => {
    try {
      const { db } = await import('../lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'config', 'google_sheets');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.tokens) {
          configCache.tokens = data.tokens;
          safeLocalStorage.setItem(TOKEN_KEY, safeStringify(data.tokens));
          window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: data.tokens }));
        }
        if (data.spreadsheetId) {
          configCache.spreadsheetId = data.spreadsheetId;
          safeLocalStorage.setItem(SHEET_ID_KEY, data.spreadsheetId);
        }
        if (data.sheetName) {
          configCache.sheetName = data.sheetName;
          safeLocalStorage.setItem(SHEET_NAME_KEY, data.sheetName);
        }
        if (data.sheetRange) {
          configCache.sheetRange = data.sheetRange;
          safeLocalStorage.setItem(SHEET_RANGE_KEY, data.sheetRange);
        }
        return data;
      }
    } catch (e) {
      console.warn("Failed loading Google Sheets config from Firestore:", e);
    }
    return null;
  },

  subscribeGoogleSheetsConfig: (callback: (data: any) => void) => {
    let unsubscribe = () => {};
    // Dynamic import to stay clean and modular
    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        const docRef = doc(db, 'config', 'google_sheets');
        unsubscribe = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            
            // Update the live in-memory global configCache
            if (data.tokens) {
              configCache.tokens = data.tokens;
              safeLocalStorage.setItem(TOKEN_KEY, safeStringify(data.tokens));
            } else {
              configCache.tokens = null;
              safeLocalStorage.removeItem(TOKEN_KEY);
            }
            
            if (data.spreadsheetId) {
              configCache.spreadsheetId = data.spreadsheetId;
              safeLocalStorage.setItem(SHEET_ID_KEY, data.spreadsheetId);
            } else {
              configCache.spreadsheetId = null;
              safeLocalStorage.removeItem(SHEET_ID_KEY);
            }
            
            if (data.sheetName) {
              configCache.sheetName = data.sheetName;
              safeLocalStorage.setItem(SHEET_NAME_KEY, data.sheetName);
            } else {
              configCache.sheetName = 'Sheet1';
              safeLocalStorage.removeItem(SHEET_NAME_KEY);
            }
            
            if (data.sheetRange) {
              configCache.sheetRange = data.sheetRange;
              safeLocalStorage.setItem(SHEET_RANGE_KEY, data.sheetRange);
            } else {
              configCache.sheetRange = 'A1';
              safeLocalStorage.removeItem(SHEET_RANGE_KEY);
            }

            // Immediately dispatch the local auth changed state so UI elements re-render with active synchronization badge
            window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: data.tokens || null }));
            callback(data);
          } else {
            callback(null);
          }
        }, (error) => {
          console.warn("Error subscribing to Google Sheets config:", error);
        });
      }).catch(err => console.warn("Failed loading firestore inside subscription:", err));
    }).catch(err => console.warn("Failed loading firebase inside subscription:", err));

    return () => unsubscribe();
  },

  getTokens: (): GoogleTokens | null => {
    if (configCache.tokens) return configCache.tokens;
    const tokens = safeLocalStorage.getItem(TOKEN_KEY);
    if (tokens) {
      try {
        const parsed = JSON.parse(tokens);
        configCache.tokens = parsed;
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  saveTokens: (tokens: GoogleTokens) => {
    const existing = googleSheetsService.getTokens();
    const updated = { ...existing, ...tokens };
    if (existing && existing.refresh_token && !updated.refresh_token) {
      updated.refresh_token = existing.refresh_token;
    }
    configCache.tokens = updated;
    safeLocalStorage.setItem(TOKEN_KEY, safeStringify(updated));
    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: updated }));
    googleSheetsService.syncConfigToFirestore({ tokens: updated });
  },

  processResponseJson: (json: any) => {
    if (json && json.refreshedTokens) {
      console.log('Successfully captured auto-refreshed Google credentials.');
      googleSheetsService.saveTokens(json.refreshedTokens);
    }
    return json;
  },

  getSpreadsheetId: (): string | null => {
    if (configCache.spreadsheetId) return configCache.spreadsheetId;
    return safeLocalStorage.getItem(SHEET_ID_KEY);
  },

  saveSpreadsheetId: (id: string) => {
    configCache.spreadsheetId = id;
    safeLocalStorage.setItem(SHEET_ID_KEY, id);
    googleSheetsService.syncConfigToFirestore({ spreadsheetId: id });
  },

  getSheetName: (): string => {
    if (configCache.sheetName && configCache.sheetName !== 'Sheet1') return configCache.sheetName;
    return safeLocalStorage.getItem(SHEET_NAME_KEY) || 'Sheet1';
  },

  saveSheetName: (name: string) => {
    configCache.sheetName = name;
    safeLocalStorage.setItem(SHEET_NAME_KEY, name);
    googleSheetsService.syncConfigToFirestore({ sheetName: name });
  },

  getSheetRange: (): string => {
    if (configCache.sheetRange && configCache.sheetRange !== 'A1') return configCache.sheetRange;
    return safeLocalStorage.getItem(SHEET_RANGE_KEY) || 'A1';
  },

  saveSheetRange: (range: string) => {
    configCache.sheetRange = range;
    safeLocalStorage.setItem(SHEET_RANGE_KEY, range);
    googleSheetsService.syncConfigToFirestore({ sheetRange: range });
  },

  clearAuth: () => {
    configCache.tokens = null;
    safeLocalStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: null }));
    googleSheetsService.syncConfigToFirestore({ tokens: null });
  },

  initiateAuth: async (): Promise<GoogleTokens> => {
    return new Promise<GoogleTokens>((resolve, reject) => {
      try {
        console.log("Initiating server-side Google OAuth for permanent offline refresh access token...");
        // Check if user is offline
        if (!navigator.onLine) {
          throw new Error("You are currently offline. Please connect to the internet first.");
        }

        const oauthBaseUrl = getApiUrl('/api/auth/google');
        const oauthUrl = `${oauthBaseUrl}${oauthBaseUrl.includes('?') ? '&' : '?'}origin=${encodeURIComponent(window.location.origin)}`;
        const width = 600;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        console.log("Opening Google Sheets OAuth popup:", oauthUrl);
        const popup = window.open(
          oauthUrl,
          'GoogleSheetsOAuth',
          `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
        );

        if (!popup) {
          throw new Error("Popup blocked. Please allow popups for this website/iframe to connect your Google Account.");
        }

        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'google-oauth-success' && event.data.tokens) {
            const tokens = event.data.tokens;
            console.log("googleSheetsService: Received Google Auth tokens via message!");
            googleSheetsService.saveTokens(tokens);
            cleanup();
            try { if (popup && !popup.closed) popup.close(); } catch (e) {}
            resolve(tokens);
          }
        };

        const checkTimer = setInterval(() => {
          try {
            const directTokensStr = safeLocalStorage.getItem('gts_sync_google_tokens_direct');
            if (directTokensStr) {
              const tokens = JSON.parse(directTokensStr);
              safeLocalStorage.removeItem('gts_sync_google_tokens_direct');
              googleSheetsService.saveTokens(tokens);
              console.log("googleSheetsService: Found direct Google Auth tokens in localStorage fallback.");
              cleanup();
              try { if (!popup.closed) popup.close(); } catch (e) {}
              resolve(tokens);
              return;
            }
          } catch (e) {}

          if (popup.closed) {
            setTimeout(() => {
              try {
                const directTokensStr = safeLocalStorage.getItem('gts_sync_google_tokens_direct');
                if (directTokensStr) {
                  const tokens = JSON.parse(directTokensStr);
                  safeLocalStorage.removeItem('gts_sync_google_tokens_direct');
                  googleSheetsService.saveTokens(tokens);
                  cleanup();
                  resolve(tokens);
                  return;
                }
              } catch (e) {}
              cleanup();
              reject(new Error("Google connection window was closed before completion. Please try again."));
            }, 1000);
          }
        }, 500);

        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkTimer);
        };

        window.addEventListener('message', messageHandler);
      } catch (err: any) {
        console.error("InitiateAuth Error:", err);
        reject(err);
      }
    });
  },

  initiateFirebaseAuth: async (): Promise<GoogleTokens> => {
    try {
      console.log("Initiating Google connection via native Firebase Auth service...");
      // Check if user is offline
      if (!navigator.onLine) {
        throw new Error("You are currently offline. Please connect to the internet first.");
      }

      // Configure provider with custom parameters for a smooth popup experience
      const customProvider = new GoogleAuthProvider();
      customProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
      customProvider.addScope('https://www.googleapis.com/auth/drive.file');
      customProvider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });

      // Execute smooth native Firebase Sign-In popup with Google Provider
      const result = await signInWithPopup(auth, customProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential || !credential.accessToken) {
        throw new Error("Failed to retrieve Google Access Token from Firebase credentials.");
      }
      
      // Calculate token expiry (typically 3600 seconds from now)
      const expiry_date = Date.now() + 3590 * 1000;
      
      // Retrieve modern credentials tokens
      const tokens: GoogleTokens = {
        access_token: credential.accessToken,
        refresh_token: (credential as any).refreshToken || undefined,
        token_type: "Bearer",
        expiry_date: expiry_date,
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
      };
      
      googleSheetsService.saveTokens(tokens);
      console.log("Firebase Google Sheets credentials retrieved and saved successfully!");
      return tokens;
    } catch (fbAuthError: any) {
      console.error("Firebase Auth Google connection failed:", fbAuthError);
      
      let friendlyMessage = fbAuthError.message || "Google Sheets connection failed.";
      
      // Construct intuitive instructions for common iframe & environment blockers
      if (fbAuthError.code === 'auth/popup-blocked') {
        friendlyMessage = "Popup blocked. Please allow popups for this website/iframe to connect Google Sheets.";
      } else if (fbAuthError.code === 'auth/popup-closed-by-user') {
        friendlyMessage = "Auth window closed before completion. Please try again.";
      } else if (window.self !== window.top) {
        friendlyMessage = "This app is running in an iframe, which restricts popups. Please open the app directly in a new tab to authorize with Firebase!";
      } else if (fbAuthError.code === 'auth/unauthorized-domain') {
        friendlyMessage = `This domain is not authorized in your Firebase Console. Please add '${window.location.hostname}' to the Authorized Domains list in Firebase Auth Settings.`;
      }
      
      throw new Error(friendlyMessage);
    }
  },

  appendComplaint: async (complaint: any) => {
    return googleSheetsService.syncActivity('Operational Logs', complaint);
  },

  syncActivity: async (tabName: string, data: any) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();

    if (!tokens || !spreadsheetId) {
      console.warn(`Google Sheets not configured. Skipping sync to ${tabName}.`);
      return;
    }

    let values: any[] = [];
    
    if (tabName === 'Operational Logs') {
      values = [
        data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString(),
        data.id || 'N/A',
        data.memberName || 'System',
        data.customerName || 'N/A',
        data.number || 'N/A',
        data.area || 'N/A',
        data.category || 'N/A',
        data.priority || 'Medium',
        data.status || 'Active',
        data.description || data.message || ''
      ];
    } else if (tabName === 'User Register') {
      values = [
        data.uid || 'N/A',
        data.username || 'N/A',
        data.fullName || 'N/A',
        data.role || 'user',
        data.dealerId || 'main',
        data.companyName || 'N/A',
        data.lineCode || 'N/A',
        new Date().toLocaleString(),
        data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString()
      ];
    } else if (tabName === 'Client Database') {
      values = [
        data.id || 'N/A',
        data.username || 'N/A',
        data.name || 'N/A',
        data.number || data.mobileNumber || 'N/A',
        data.area || 'N/A',
        data.address || 'N/A',
        data.priority || 'N/A',
        data.assignedTo || 'N/A',
        data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString()
      ];
    } else if (tabName === 'Login Logs') {
      values = [
        data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString(),
        data.uid || 'N/A',
        data.username || 'N/A',
        data.fullName || 'N/A',
        data.role || 'user',
        data.authType || 'Standard Credentials',
        data.lineCode || 'N/A',
        data.companyName || 'N/A',
        data.status || 'Success'
      ];
    }

    try {
      const response = await fetch(getApiUrl('/api/sheets/append'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          range: `'${tabName}'!A1`,
          values
        })
      });

      if (!response.ok) {
        let errorMsg = `Failed to append to ${tabName}`;
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const json = await response.json();
      return googleSheetsService.processResponseJson(json);
    } catch (error) {
      console.error(`Error syncing to ${tabName}:`, error instanceof Error ? error.message : String(error));
      // Queue for offline sync if it failed
      googleSheetsService.syncQueue.add({ tabName, data });
      throw error;
    }
  },
  
  exportAllComplaintsToSheets: async (complaints: any[]) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();
    const sheetName = googleSheetsService.getSheetName();
    
    if (!tokens || !spreadsheetId) {
      throw new Error('Google Sheets not configured. Please connect your account and set a Spreadsheet ID.');
    }

    // Header row
    const headers = [
      'Date Created',
      'Registry ID',
      'Logged By',
      'Client Name',
      'Contact Number',
      'Operation Area',
      'Category',
      'Priority Level',
      'Current Status',
      'Description / Logs'
    ];

    // Data rows
    const rows = complaints.map(c => [
      c.createdAt ? new Date(c.createdAt).toLocaleString() : 'N/A',
      c.id || 'N/A',
      c.memberName || 'System',
      c.customerName || 'N/A',
      c.number || 'N/A',
      c.area || 'N/A',
      c.category || 'N/A',
      c.priority || 'Medium',
      c.status || 'Resolved',
      c.description || ''
    ]);

    const values = [headers, ...rows];
    // Start from A1 to overwrite headers as well
    const fullRange = `'${sheetName}'!A1`;

    try {
      const response = await fetch(getApiUrl('/api/sheets/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          range: fullRange,
          values
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to export to Google Sheets';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const json = await response.json();
      return googleSheetsService.processResponseJson(json);
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  backupToDrive: async (filename: string, csvContent: string) => {
    const tokens = googleSheetsService.getTokens();
    
    if (!tokens) {
      throw new Error('Google account not connected. Please connect your account first.');
    }

    try {
      const response = await fetch(getApiUrl('/api/drive/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          filename,
          content: csvContent
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to backup to Google Drive';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const json = await response.json();
      return googleSheetsService.processResponseJson(json);
    } catch (error) {
      console.error('Error backing up to Google Drive:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  createNewSpreadsheet: async (title: string) => {
    const tokens = googleSheetsService.getTokens();
    const sheetName = googleSheetsService.getSheetName();
    
    if (!tokens) {
      throw new Error('Google account not connected. Please connect your account first.');
    }

    try {
      const response = await fetch(getApiUrl('/api/sheets/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          title,
          sheetName
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to create Google Sheet';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      googleSheetsService.processResponseJson(result);
      if (result.spreadsheetId) {
        googleSheetsService.saveSpreadsheetId(result.spreadsheetId);
      }
      return result;
    } catch (error) {
      console.error('Error creating Google Sheet:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  performBulkSystemBackup: async (data: { 
    complaints: any[], 
    users: any[], 
    clients: any[], 
    config: any,
    branding?: any
  }) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();
    
    if (!tokens || !spreadsheetId) {
      throw new Error('Google Sheets not configured. Please connect your account and set a Spreadsheet ID.');
    }

    // 1. Complaints Sheet
    const complaintHeaders = ['Date', 'ID', 'Logged By', 'Client', 'Contact', 'Area', 'Category', 'Priority', 'Status', 'Description'];
    const complaintRows = data.complaints.map(c => [
      c.createdAt ? new Date(c.createdAt).toLocaleString() : 'N/A',
      c.id || 'N/A',
      c.memberName || 'N/A',
      c.customerName || 'N/A',
      c.number || 'N/A',
      c.area || 'N/A',
      c.category || 'N/A',
      c.priority || 'N/A',
      c.status || 'N/A',
      c.description || ''
    ]);

    // 2. Users Sheet (User Register)
    const userHeaders = ['UID', 'Username', 'Full Name', 'Role', 'Dealer ID', 'Company', 'Line Code', 'Last Active', 'Created At'];
    const userRows = data.users.map(u => [
      u.uid || 'N/A',
      u.username || 'N/A',
      u.fullName || 'N/A',
      u.role || 'N/A',
      u.dealerId || 'main',
      u.companyName || 'N/A',
      u.lineCode || 'N/A',
      u.lastActive ? new Date(u.lastActive).toLocaleString() : 'Never',
      u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A'
    ]);

    // 3. Clients Sheet (Client Database)
    const clientHeaders = ['ID', 'Username', 'Name', 'Contact', 'Area', 'Address', 'Priority', 'Assigned To', 'Created At'];
    const clientRows = data.clients.map(c => [
      c.id || 'N/A',
      c.username || 'N/A',
      c.name || 'N/A',
      c.number || c.mobileNumber || 'N/A',
      c.area || 'N/A',
      c.address || 'N/A',
      c.priority || 'N/A',
      c.assignedTo || 'N/A',
      c.createdAt ? new Date(c.createdAt).toLocaleString() : 'N/A'
    ]);

    // 4. Config & Branding Sheet (System Config)
    const configHeaders = ['Section', 'Setting Key', 'Value'];
    const configRows: any[][] = [];
    
    // Add App Config
    Object.entries(data.config || {}).forEach(([key, value]) => {
      configRows.push([
        'Application',
        key,
        typeof value === 'object' ? safeStringify(value) : String(value)
      ]);
    });

    // Add Branding Config
    Object.entries(data.branding || {}).forEach(([key, value]) => {
      configRows.push([
        'Branding',
        key,
        typeof value === 'object' ? safeStringify(value) : String(value)
      ]);
    });

    const sheetsData = [
      { title: 'Operational Logs', values: [complaintHeaders, ...complaintRows] },
      { title: 'User Register', values: [userHeaders, ...userRows] },
      { title: 'Client Database', values: [clientHeaders, ...clientRows] },
      { title: 'System Config', values: [configHeaders, ...configRows] }
    ];

    try {
      const response = await fetch(getApiUrl('/api/sheets/bulk-export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          sheetsData
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to perform bulk export';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const resJson = await response.json();
      googleSheetsService.processResponseJson(resJson);
      try {
        await googleSheetsService.syncConfigToFirestore({ lastAutoBackupTime: Date.now() });
      } catch (err) {
        console.warn("Could not save lastAutoBackupTime to Firestore config, skipping...", err);
      }
      return resJson;
    } catch (error) {
      console.error('Bulk Export Error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  syncUser: async (user: any) => {
    return googleSheetsService.syncActivity('User Register', user);
  },

  syncClient: async (client: any) => {
    return googleSheetsService.syncActivity('Client Database', client);
  },

  syncLogin: async (user: any, authType: string = 'Standard Credentials') => {
    return googleSheetsService.syncActivity('Login Logs', {
      ...user,
      authType,
      timestamp: Date.now()
    });
  },

  syncSystemConfig: async (config: any, branding: any) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();

    if (!tokens || !spreadsheetId) return;

    try {
      const configRows = [
        ['APPLICATION CONFIGURATION', 'VALUE'],
        ['Complaints Count', config.totalComplaints || 0],
        ['Zones/Areas', (config.zones || []).join(', ')],
        ['Categories', (config.categories || []).join(', ')],
        ['Priorities', (config.priorities || []).join(', ')],
        ['', ''],
        ['BRANDING CONFIGURATION', 'VALUE'],
        ['App Name', branding.appName || 'N/A'],
        ['Main Color', branding.mainColor || 'N/A'],
        ['Secondary Color', branding.secondaryColor || 'N/A']
      ];

      const response = await fetch(getApiUrl('/api/sheets/bulk-export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          sheetsData: [
            {
              title: 'System Config',
              values: configRows
            }
          ]
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed auto-syncing config';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          errorMsg = 'Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.';
        }
        throw new Error(errorMsg);
      }

      const json = await response.json();
      googleSheetsService.processResponseJson(json);
    } catch (err) {
      console.error('Error auto-syncing config:', err);
    }
  },

  // Offline Sync Queue for Sheets
  syncQueue: {
    add: (item: any) => {
      const queue = JSON.parse(safeLocalStorage.getItem('gts_sheet_sync_queue') || '[]');
      queue.push(item);
      safeLocalStorage.setItem('gts_sheet_sync_queue', safeStringify(queue));
    },
    get: () => {
      return JSON.parse(safeLocalStorage.getItem('gts_sheet_sync_queue') || '[]');
    },
    clear: () => {
      safeLocalStorage.removeItem('gts_sheet_sync_queue');
    },
    process: async () => {
      if (!navigator.onLine) return;
      
      const queue = googleSheetsService.syncQueue.get();
      if (queue.length === 0) return;

      console.log(`Processing ${queue.length} queued records for Google Sheets sync categories...`);
      
      const remaining: any[] = [];
      for (const item of queue) {
        try {
          if (item.tabName && item.data) {
            // New categorized sync format
            await googleSheetsService.syncActivity(item.tabName, item.data);
          } else {
            // Legacy format (just the complaint)
            await googleSheetsService.syncActivity('Operational Logs', item);
          }
        } catch (err) {
          console.error('Failed to sync queued item:', err instanceof Error ? err.message : String(err));
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        safeLocalStorage.setItem('gts_sheet_sync_queue', safeStringify(remaining));
      } else {
        googleSheetsService.syncQueue.clear();
      }
    }
  }
};
