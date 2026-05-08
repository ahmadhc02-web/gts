// src/services/googleSheetsService.ts
import { safeStringify } from '../lib/utils';

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

export const googleSheetsService = {
  getTokens: (): GoogleTokens | null => {
    const tokens = localStorage.getItem(TOKEN_KEY);
    return tokens ? JSON.parse(tokens) : null;
  },

  saveTokens: (tokens: GoogleTokens) => {
    // If we already have a refresh token, preserve it if the new response doesn't have one
    // (Google only sends refresh_token on the first consent)
    const existing = googleSheetsService.getTokens();
    const updated = { ...existing, ...tokens };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: updated }));
  },

  getSpreadsheetId: (): string | null => {
    return localStorage.getItem(SHEET_ID_KEY);
  },

  saveSpreadsheetId: (id: string) => {
    localStorage.setItem(SHEET_ID_KEY, id);
  },

  getSheetName: (): string => {
    return localStorage.getItem(SHEET_NAME_KEY) || 'Sheet1';
  },

  saveSheetName: (name: string) => {
    localStorage.setItem(SHEET_NAME_KEY, name);
  },

  getSheetRange: (): string => {
    return localStorage.getItem(SHEET_RANGE_KEY) || 'A1';
  },

  saveSheetRange: (range: string) => {
    localStorage.setItem(SHEET_RANGE_KEY, range);
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: null }));
  },

  initiateAuth: async () => {
    const response = await fetch('/api/auth/google/url');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get auth URL from server');
    }
    const { url } = await response.json();
    
    return new Promise<GoogleTokens>((resolve, reject) => {
      const authWindow = window.open(url, 'google_auth', 'width=600,height=700');
      
      if (!authWindow) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      let checkClosed: NodeJS.Timeout;
      let isHandled = false;

      const handleMessage = (event: MessageEvent) => {
        console.log('Received message event:', event);
        
        // In AI Studio, we trust messages with the correct type
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          console.log('Google Auth Success message received');
          isHandled = true;
          const tokens = event.data.tokens as GoogleTokens;
          googleSheetsService.saveTokens(tokens);
          if (checkClosed) clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          resolve(tokens);
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Basic check if window is closed
      checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          console.log('Auth window closed, checking if handled...');
          
          // Wait a bit to see if the message event fires (popups close themselves on success)
          setTimeout(() => {
            if (!isHandled) {
              console.warn('Auth window closed without success message');
              window.removeEventListener('message', handleMessage);
              reject(new Error('Auth process cancelled: window closed before completion.'));
            }
          }, 1500);
        }
      }, 1000);
    });
  },

  appendComplaint: async (complaint: any) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();
    const sheetName = googleSheetsService.getSheetName();
    const subRange = googleSheetsService.getSheetRange();

    if (!tokens || !spreadsheetId) {
      console.warn('Google Sheets not configured. Skipping sync.');
      return;
    }

    const fullRange = `'${sheetName}'!${subRange}`;

    const values = [
      complaint.createdAt ? new Date(complaint.createdAt).toLocaleString() : new Date().toLocaleString(),
      complaint.id || 'N/A',
      complaint.memberName || 'System',
      complaint.customerName || 'N/A',
      complaint.number || 'N/A',
      complaint.area || 'N/A',
      complaint.category || 'N/A',
      complaint.priority || 'Medium',
      complaint.status || 'Resolved',
      complaint.description || ''
    ];

    try {
      const payload = {
        tokens,
        spreadsheetId,
        range: fullRange,
        values
      };

      const response = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to append to Google Sheets');
      }

      return await response.json();
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error instanceof Error ? error.message : String(error));
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
      const response = await fetch('/api/sheets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          spreadsheetId,
          range: fullRange,
          values
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export to Google Sheets');
      }

      return await response.json();
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
      const response = await fetch('/api/drive/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          filename,
          content: csvContent
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to backup to Google Drive');
      }

      return await response.json();
    } catch (error) {
      console.error('Error backing up to Google Drive:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Offline Sync Queue for Sheets
  syncQueue: {
    add: (complaint: any) => {
      const queue = JSON.parse(localStorage.getItem('gts_sheet_sync_queue') || '[]');
      queue.push(complaint);
      localStorage.setItem('gts_sheet_sync_queue', JSON.stringify(queue));
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

      console.log(`Processing ${queue.length} queued records for Google Sheets...`);
      
      const remaining: any[] = [];
      for (const item of queue) {
        try {
          await googleSheetsService.appendComplaint(item);
        } catch (err) {
          console.error('Failed to sync queued item:', err instanceof Error ? err.message : String(err));
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem('gts_sheet_sync_queue', JSON.stringify(remaining));
      } else {
        googleSheetsService.syncQueue.clear();
      }
    }
  }
};
