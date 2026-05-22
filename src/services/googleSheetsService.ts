// src/services/googleSheetsService.ts
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { safeStringify } from '../lib/utils';

const getApiUrl = (endpoint: string): string => {
  const host = window.location.hostname;
  if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('.run.app') || 
    host.includes('.hf.space') || 
    host.includes('.huggingface.co')
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
  const localTokens = localStorage.getItem(TOKEN_KEY);
  if (localTokens) configCache.tokens = JSON.parse(localTokens);
  configCache.spreadsheetId = localStorage.getItem(SHEET_ID_KEY);
  configCache.sheetName = localStorage.getItem(SHEET_NAME_KEY) || 'Sheet1';
  configCache.sheetRange = localStorage.getItem(SHEET_RANGE_KEY) || 'A1';
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
          localStorage.setItem(TOKEN_KEY, safeStringify(data.tokens));
          window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: data.tokens }));
        }
        if (data.spreadsheetId) {
          configCache.spreadsheetId = data.spreadsheetId;
          localStorage.setItem(SHEET_ID_KEY, data.spreadsheetId);
        }
        if (data.sheetName) {
          configCache.sheetName = data.sheetName;
          localStorage.setItem(SHEET_NAME_KEY, data.sheetName);
        }
        if (data.sheetRange) {
          configCache.sheetRange = data.sheetRange;
          localStorage.setItem(SHEET_RANGE_KEY, data.sheetRange);
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
              localStorage.setItem(TOKEN_KEY, safeStringify(data.tokens));
            } else {
              configCache.tokens = null;
              localStorage.removeItem(TOKEN_KEY);
            }
            
            if (data.spreadsheetId) {
              configCache.spreadsheetId = data.spreadsheetId;
              localStorage.setItem(SHEET_ID_KEY, data.spreadsheetId);
            } else {
              configCache.spreadsheetId = null;
              localStorage.removeItem(SHEET_ID_KEY);
            }
            
            if (data.sheetName) {
              configCache.sheetName = data.sheetName;
              localStorage.setItem(SHEET_NAME_KEY, data.sheetName);
            } else {
              configCache.sheetName = 'Sheet1';
              localStorage.removeItem(SHEET_NAME_KEY);
            }
            
            if (data.sheetRange) {
              configCache.sheetRange = data.sheetRange;
              localStorage.setItem(SHEET_RANGE_KEY, data.sheetRange);
            } else {
              configCache.sheetRange = 'A1';
              localStorage.removeItem(SHEET_RANGE_KEY);
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
    const tokens = localStorage.getItem(TOKEN_KEY);
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
    localStorage.setItem(TOKEN_KEY, safeStringify(updated));
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
    return localStorage.getItem(SHEET_ID_KEY);
  },

  saveSpreadsheetId: (id: string) => {
    configCache.spreadsheetId = id;
    localStorage.setItem(SHEET_ID_KEY, id);
    googleSheetsService.syncConfigToFirestore({ spreadsheetId: id });
  },

  getSheetName: (): string => {
    if (configCache.sheetName && configCache.sheetName !== 'Sheet1') return configCache.sheetName;
    return localStorage.getItem(SHEET_NAME_KEY) || 'Sheet1';
  },

  saveSheetName: (name: string) => {
    configCache.sheetName = name;
    localStorage.setItem(SHEET_NAME_KEY, name);
    googleSheetsService.syncConfigToFirestore({ sheetName: name });
  },

  getSheetRange: (): string => {
    if (configCache.sheetRange && configCache.sheetRange !== 'A1') return configCache.sheetRange;
    return localStorage.getItem(SHEET_RANGE_KEY) || 'A1';
  },

  saveSheetRange: (range: string) => {
    configCache.sheetRange = range;
    localStorage.setItem(SHEET_RANGE_KEY, range);
    googleSheetsService.syncConfigToFirestore({ sheetRange: range });
  },

  clearAuth: () => {
    configCache.tokens = null;
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: null }));
    googleSheetsService.syncConfigToFirestore({ tokens: null });
  },

  initiateAuth: async (): Promise<GoogleTokens> => {
    try {
      console.log("Initiating Google Sheets connection using Firebase Auth...");
      // Check if user is offline
      if (!navigator.onLine) {
        throw new Error("You are currently offline. Please connect to the internet first.");
      }

      // Configure provider with custom prompt to always ensure consent is requested
      provider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });

      // Try the smooth native Firebase Sign-In popup using the user's authorized redirect handler
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential || !credential.accessToken) {
        throw new Error("Failed to retrieve Google Access Token from Firebase credentials.");
      }
      
      // Calculate token expiry (typically 3590 seconds from now)
      const expiry_date = Date.now() + 3590 * 1000;
      
      const tokens: GoogleTokens = {
        access_token: credential.accessToken,
        token_type: "Bearer",
        expiry_date: expiry_date,
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
      };
      
      googleSheetsService.saveTokens(tokens);
      console.log("Firebase Google Sheets credentials retrieved successfully!");
      return tokens;
    } catch (fbAuthError: any) {
      console.warn("Client-side Firebase Auth Google connection had a warning or was blocked, trying server OAuth fallback:", fbAuthError);
      
      // Ultimate robust server-side OAuth flow fallback if Firebase popup fails
      const url = getApiUrl('/api/auth/google');
      
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        'GoogleSheetsOAuth',
        `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this website/iframe to connect Google Sheets.");
      }

      return new Promise<GoogleTokens>((resolve, reject) => {
        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'google-oauth-success' && event.data.tokens) {
            const tokens = event.data.tokens;
            localStorage.removeItem('gts_sync_google_tokens_direct');
            googleSheetsService.saveTokens(tokens);
            cleanup();
            resolve(tokens);
          }
        };

        const checkTimer = setInterval(() => {
          // Check for direct localStorage tokens (bypasses popup window communication issues)
          try {
            const directTokensStr = localStorage.getItem('gts_sync_google_tokens_direct');
            if (directTokensStr) {
              const tokens = JSON.parse(directTokensStr);
              localStorage.removeItem('gts_sync_google_tokens_direct');
              googleSheetsService.saveTokens(tokens);
              cleanup();
              resolve(tokens);
              try {
                if (!popup.closed) popup.close();
              } catch (e) {}
              return;
            }
          } catch (storageErr) {
            console.warn("Direct storage check encountered a harmless warning:", storageErr);
          }

          if (popup.closed) {
            // Give 1 second extension error check to read final tokens from localStorage or Firestore sync
            setTimeout(() => {
              try {
                const directTokensStr = localStorage.getItem('gts_sync_google_tokens_direct');
                if (directTokensStr) {
                  const tokens = JSON.parse(directTokensStr);
                  localStorage.removeItem('gts_sync_google_tokens_direct');
                  googleSheetsService.saveTokens(tokens);
                  cleanup();
                  resolve(tokens);
                  return;
                }
              } catch (e) {}

              const tokens = googleSheetsService.getTokens();
              if (tokens && tokens.access_token) {
                cleanup();
                resolve(tokens);
              } else {
                cleanup();
                reject(new Error("Auth window closed before completion. Please try again."));
              }
            }, 1000);
          }
        }, 500);

        const storageHandler = (e: any) => {
          if (e.detail) {
            cleanup();
            resolve(e.detail);
          }
        };

        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          window.removeEventListener('google-auth-changed' as any, storageHandler);
          clearInterval(checkTimer);
        };

        window.addEventListener('message', messageHandler);
        window.addEventListener('google-auth-changed' as any, storageHandler);
      });
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
        if (response.status === 401 || errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = 'Google authentication has expired or is invalid. Please connect your Google Account again in the Admin Panel.';
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
      const queue = JSON.parse(localStorage.getItem('gts_sheet_sync_queue') || '[]');
      queue.push(item);
      localStorage.setItem('gts_sheet_sync_queue', safeStringify(queue));
    },
    get: () => {
      return JSON.parse(localStorage.getItem('gts_sheet_sync_queue') || '[]');
    },
    clear: () => {
      localStorage.removeItem('gts_sheet_sync_queue');
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
        localStorage.setItem('gts_sheet_sync_queue', safeStringify(remaining));
      } else {
        googleSheetsService.syncQueue.clear();
      }
    }
  }
};
