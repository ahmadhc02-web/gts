// src/services/googleSheetsService.ts
import { safeStringify } from '../lib/utils';
import { safeLocalStorage } from '../lib/safeLocalStorage';
import { pb } from '../lib/pocketbase';

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

export const googleSheetsService = {
  syncConfigToFirestore: async (updates: any) => {
    try {
      let existing = {};
      try {
        const record = await pb.collection('branding_config').getFirstListItem('config_type = "google_sheets"');
        if (record && record.dashboard_subtext) {
          existing = JSON.parse(record.dashboard_subtext);
        }
      } catch (e) {}

      const merged = { ...existing, ...updates, updatedAt: Date.now() };

      const payload = {
        config_type: 'google_sheets',
        dashboard_subtext: JSON.stringify(merged),
        updated_at: Date.now()
      };

      try {
        const record = await pb.collection('branding_config').getFirstListItem('config_type = "google_sheets"');
        await pb.collection('branding_config').update(record.id, payload);
      } catch (e) {
        await pb.collection('branding_config').create(payload);
      }
    } catch (e) {
      console.warn("Failed syncing Google Sheets config to PocketBase:", e);
    }
  },

  loadConfigFromFirestore: async () => {
    try {
      const record = await pb.collection('branding_config').getFirstListItem('config_type = "google_sheets"');
      if (record && record.dashboard_subtext) {
        const parsed = JSON.parse(record.dashboard_subtext);
        if (parsed.tokens) {
          configCache.tokens = parsed.tokens;
          safeLocalStorage.setItem(TOKEN_KEY, safeStringify(parsed.tokens));
          window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: parsed.tokens }));
        }
        if (parsed.spreadsheetId) {
          configCache.spreadsheetId = parsed.spreadsheetId;
          safeLocalStorage.setItem(SHEET_ID_KEY, parsed.spreadsheetId);
        }
        if (parsed.sheetName) {
          configCache.sheetName = parsed.sheetName;
          safeLocalStorage.setItem(SHEET_NAME_KEY, parsed.sheetName);
        }
        if (parsed.sheetRange) {
          configCache.sheetRange = parsed.sheetRange;
          safeLocalStorage.setItem(SHEET_RANGE_KEY, parsed.sheetRange);
        }
        return parsed;
      }
    } catch (e) {
      console.warn("Failed loading Google Sheets config from PocketBase:", e);
    }
    return null;
  },

  subscribeGoogleSheetsConfig: (callback: (data: any) => void) => {
    const fetchConfig = async () => {
      try {
        const record = await pb.collection('branding_config').getFirstListItem('config_type = "google_sheets"');
        if (record && record.dashboard_subtext) {
          const parsed = JSON.parse(record.dashboard_subtext);
          
          if (parsed.tokens) {
            configCache.tokens = parsed.tokens;
            safeLocalStorage.setItem(TOKEN_KEY, safeStringify(parsed.tokens));
          } else {
            configCache.tokens = null;
            safeLocalStorage.removeItem(TOKEN_KEY);
          }
          
          if (parsed.spreadsheetId) {
            configCache.spreadsheetId = parsed.spreadsheetId;
            safeLocalStorage.setItem(SHEET_ID_KEY, parsed.spreadsheetId);
          } else {
            configCache.spreadsheetId = null;
            safeLocalStorage.removeItem(SHEET_ID_KEY);
          }
          
          if (parsed.sheetName) {
            configCache.sheetName = parsed.sheetName;
            safeLocalStorage.setItem(SHEET_NAME_KEY, parsed.sheetName);
          } else {
            configCache.sheetName = 'Sheet1';
            safeLocalStorage.removeItem(SHEET_NAME_KEY);
          }
          
          if (parsed.sheetRange) {
            configCache.sheetRange = parsed.sheetRange;
            safeLocalStorage.setItem(SHEET_RANGE_KEY, parsed.sheetRange);
          } else {
            configCache.sheetRange = 'A1';
            safeLocalStorage.removeItem(SHEET_RANGE_KEY);
          }

          window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: parsed.tokens || null }));
          callback(parsed);
        } else {
          callback(null);
        }
      } catch (e) {
        console.warn("Failed loading PocketBase config inside subscription:", e);
      }
    };

    fetchConfig();

    console.log(`[Realtime] Subscribing to PocketBase branding_config for google_sheets changes`);
    
    pb.collection('branding_config').subscribe('*', (e) => {
      if (e.record && e.record.config_type === 'google_sheets') {
        fetchConfig();
      }
    }).catch((err) => {
      console.warn("Failed subscribing to PocketBase branding_config realtime updates:", err);
    });

    return () => {
      console.log(`[Realtime] Unsubscribing from PocketBase branding_config`);
      pb.collection('branding_config').unsubscribe('*').catch(() => {});
    };
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

  getOAuthUrl: (): string => {
    const oauthBaseUrl = getApiUrl('/api/auth/google');
    return `${oauthBaseUrl}${oauthBaseUrl.includes('?') ? '&' : '?'}origin=${encodeURIComponent(window.location.origin)}`;
  },

  initiateAuth: async (): Promise<GoogleTokens> => {
    return new Promise<GoogleTokens>(async (resolve, reject) => {
      try {
        console.log("Initiating server-side Google OAuth for permanent offline refresh access token...");
        // Check if user is offline
        if (!navigator.onLine) {
          throw new Error("You are currently offline. Please connect to the internet first.");
        }

        const startTime = Date.now();
        const oauthBaseUrl = getApiUrl('/api/auth/google');
        const oauthUrl = `${oauthBaseUrl}${oauthBaseUrl.includes('?') ? '&' : '?'}origin=${encodeURIComponent(window.location.origin)}`;
        const width = 600;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        console.log("Opening Google Sheets OAuth popup:", oauthUrl);
        
        // Try opening popup. In Electron context or inside certain frames, this might fail or open a restricted frame.
        let popup: Window | null = null;
        try {
          popup = window.open(
            oauthUrl,
            'GoogleSheetsOAuth',
            `width=${width},height=${height},left=${left},top=${top},status=yes,resizable=yes`
          );
        } catch (popupErr) {
          console.warn("Standard popup blocked or failed:", popupErr);
        }

        // Active PocketBase realtime synchronization listener so that even if the popup was opened in Chrome/Brave/Edge or externally,
        // we detect the new tokens written to PocketBase immediately!
        let unsubPocketBase = () => {};
        try {
          console.log(`[Realtime] Subscribing to PocketBase branding_config for google_sheets auth polling`);
          pb.collection('branding_config').subscribe('*', (e) => {
            if (e.record && e.record.config_type === 'google_sheets' && e.record.dashboard_subtext) {
              try {
                const data = JSON.parse(e.record.dashboard_subtext);
                if (data && data.tokens && data.updatedAt && data.updatedAt >= startTime - 15000) {
                  console.log("googleSheetsService: Detected fresh tokens written to PocketBase in real-time!");
                  googleSheetsService.saveTokens(data.tokens);
                  cleanup();
                  try { if (popup && !popup.closed) popup.close(); } catch (err) {}
                  resolve(data.tokens);
                }
              } catch (pe) {}
            }
          }).catch(() => {});

          unsubPocketBase = () => {
            console.log(`[Realtime] Unsubscribing from PocketBase branding_config auth polling`);
            pb.collection('branding_config').unsubscribe('*').catch(() => {});
          };
        } catch (fsErr) {
          console.warn("Could not register live PocketBase oauth listener fallback:", fsErr);
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
              try { if (popup && !popup.closed) popup.close(); } catch (e) {}
              resolve(tokens);
              return;
            }
          } catch (e) {}

          if (popup && popup.closed) {
            // Wait 2 more seconds in case PocketBase pushes the fresh tokens or directTokensStr is arriving
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
            }, 2000);
          }
        }, 500);

        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkTimer);
          unsubPocketBase();
        };

        window.addEventListener('message', messageHandler);
      } catch (err: any) {
        console.error("InitiateAuth Error:", err);
        reject(err);
      }
    });
  },

  initiateFirebaseAuth: async (): Promise<GoogleTokens> => {
    console.log("Redirecting to permanent server-side oauth gateway (Supabase system integration)...");
    return googleSheetsService.initiateAuth();
  },

  readSheetRows: async (tabName: string): Promise<any[][]> => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();

    if (!tokens || !spreadsheetId) {
      throw new Error("Google Sheets is not configured or authenticated in the Admin Panel.");
    }

    try {
      const response = await fetch(getApiUrl('/api/sheets/read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          range: `'${tabName}'!A2:J5000`
        })
      });

      if (!response.ok) {
        let errorMsg = `Failed to read from ${tabName}`;
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const json = await response.json();
      googleSheetsService.processResponseJson(json);
      return json.values || [];
    } catch (error) {
      console.error(`Error reading from ${tabName}:`, error);
      throw error;
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

  getBackupTokens: (): GoogleTokens | null => {
    const tokens = safeLocalStorage.getItem('gts_ledger_backup_google_tokens');
    if (tokens) {
      try {
        return JSON.parse(tokens);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  saveBackupTokens: (tokens: GoogleTokens) => {
    safeLocalStorage.setItem('gts_ledger_backup_google_tokens', safeStringify(tokens));
  },

  getBackupSpreadsheetId: (): string | null => {
    return safeLocalStorage.getItem('gts_ledger_backup_spreadsheet_id');
  },

  saveBackupSpreadsheetId: (id: string) => {
    safeLocalStorage.setItem('gts_ledger_backup_spreadsheet_id', id);
  },

  initiateBackupAuth: async (): Promise<GoogleTokens> => {
    console.log("Redirecting backup OAuth request to permanent server-side gateway (Supabase system integration)...");
    return googleSheetsService.initiateAuth();
  },

  createBackupSpreadsheet: async (title: string, tokens: any) => {
    try {
      const response = await fetch(getApiUrl('/api/sheets/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          title,
          sheetName: 'Ledger Backups'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create custom Backup Google Sheet');
      }

      const result = await response.json();
      if (result.spreadsheetId) {
        googleSheetsService.saveBackupSpreadsheetId(result.spreadsheetId);
      }
      return result;
    } catch (error) {
      console.error('Error creating custom Spreadsheet backup:', error);
      throw error;
    }
  },

  exportLedgerSheetsToSheets: async (sheets: any[], tokens: any, spreadsheetId: string) => {
    if (!tokens || !spreadsheetId) {
      throw new Error('Google backup account or Spreadsheet ID is missing. Please connect account and set ID first.');
    }

    const values: any[][] = [];

    // Header metadata
    values.push(['==================================================']);
    values.push(['SYSTEM MONTH-END RECOVERY LEDGERS FINANCIAL JOURNAL']);
    values.push([`Exported on: ${new Date().toLocaleString()}`]);
    values.push([`Total Ledger Cards: ${sheets.length}`]);
    values.push(['==================================================']);
    values.push(['']);

    const sortedSheets = [...sheets].sort((a, b) => a.createdAt - b.createdAt);

    sortedSheets.forEach((sheet, idx) => {
      values.push([`CARD #${idx + 1} // OFFICER: ${(sheet.recOfficer || '').toUpperCase()}`]);
      values.push([`DATE: ${sheet.sheetDate} // AREA: ${sheet.area || 'N/A'}`]);
      values.push(['--------------------------------------------------']);
      
      values.push(['Monthly Recoveries (Table 1)']);
      values.push(['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT']);
      const validT1 = (Array.isArray(sheet.table1Rows) ? sheet.table1Rows : []).filter((r: any) => r.cId || r.name || r.amount > 0);
      if (validT1.length > 0) {
        validT1.forEach((r: any) => {
          values.push([r.sr, r.cId || '', r.name || '', r.comments || '', r.amount || 0]);
        });
      } else {
        values.push(['No Table 1 entries completed']);
      }
      values.push(['']);

      values.push(['Extra Adjustments (Table 2)']);
      values.push(['SR', 'NAME', 'AMOUNT']);
      const validT2 = (Array.isArray(sheet.table2Rows) ? sheet.table2Rows : []).filter((r: any) => r.name || r.amount > 0);
      if (validT2.length > 0) {
        validT2.forEach((r: any) => {
          values.push([r.sr, r.name || '', r.amount || 0]);
        });
      } else {
        values.push(['No Table 2 entries completed']);
      }
      
      const sumT1 = validT1.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      const sumT2 = validT2.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
      
      values.push(['']);
      values.push([`Total Recoveries (T1): ${sumT1} // Total Adjustments (T2): ${sumT2}`]);
      values.push([`Cash Received Amount: ${sheet.cashReceived || '0'}`]);
      if (sheet.footnoteLeft || sheet.footnoteRight) {
        values.push([`Metadata: ${sheet.footnoteLeft || ''} - ${sheet.footnoteRight || ''}`]);
      }
      values.push(['==================================================']);
      values.push(['']);
      values.push(['']);
    });

    try {
      const response = await fetch(getApiUrl('/api/sheets/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({
          tokens,
          spreadsheetId,
          range: `'Ledger Backups'!A1`,
          values
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to write ledger backups to Google Sheets';
        try {
          const json = await response.json();
          errorMsg = json.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const json = await response.json();
      return googleSheetsService.processResponseJson(json);
    } catch (error) {
      console.error('Error backing up ledger sheets:', error);
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

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('The secure gateway returned an HTML document instead of JSON data. Please verify your Google Account link in the Gmail Integrations section.');
      }

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

      const resText = await response.text();
      if (resText.trim().startsWith('<!doctype') || resText.trim().startsWith('<html')) {
        throw new Error('Access credentials expired or unrouted. Please link your Google Account in the Gmail Center.');
      }
      const resJson = JSON.parse(resText);
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

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('The sync gateway returned an HTML document instead of JSON. Ensure your server endpoints are running and Gmail is connected.');
      }

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

      const resText = await response.text();
      if (resText.trim().startsWith('<!doctype') || resText.trim().startsWith('<html')) {
        throw new Error('Configuration backup encountered HTML response. Please reconnect your Google Account.');
      }
      const json = JSON.parse(resText);
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
