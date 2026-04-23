// src/services/googleSheetsService.ts

export interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

const TOKEN_KEY = 'gts_google_tokens';
const SHEET_ID_KEY = 'gts_spreadsheet_id';

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
  },

  getSpreadsheetId: (): string | null => {
    return localStorage.getItem(SHEET_ID_KEY);
  },

  saveSpreadsheetId: (id: string) => {
    localStorage.setItem(SHEET_ID_KEY, id);
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  initiateAuth: async () => {
    const response = await fetch('/api/auth/google/url');
    const { url } = await response.json();
    
    return new Promise<GoogleTokens>((resolve, reject) => {
      const authWindow = window.open(url, 'google_auth', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          const tokens = event.data.tokens as GoogleTokens;
          googleSheetsService.saveTokens(tokens);
          window.removeEventListener('message', handleMessage);
          resolve(tokens);
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Basic check if window is closed
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Auth window closed'));
        }
      }, 500);
    });
  },

  appendComplaint: async (complaint: any) => {
    const tokens = googleSheetsService.getTokens();
    const spreadsheetId = googleSheetsService.getSpreadsheetId();

    if (!tokens || !spreadsheetId) {
      console.warn('Google Sheets not configured. Skipping sync.');
      return;
    }

    const values = [
      new Date(complaint.createdAt).toLocaleString(),
      complaint.id,
      complaint.memberName,
      complaint.customerName,
      complaint.phone,
      complaint.area,
      complaint.description,
      complaint.status
    ];

    try {
      const response = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          spreadsheetId,
          values
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to append to Google Sheets');
      }

      return await response.json();
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error;
    }
  }
};
