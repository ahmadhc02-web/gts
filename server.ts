import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
import fs from "fs";

dotenv.config();

let _filename = "";
let _dirname = "";
try {
  _filename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
  _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(_filename);
} catch (e) {
  _dirname = process.cwd();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Robust CORS Middleware supporting Netlify/external frontends
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.raw({ limit: '50mb', type: 'application/octet-stream' }));

  // --- Speed Test Upload Endpoint ---
  app.post("/api/speedtest/upload", (req, res) => {
    // Just consume the data and return success
    res.status(200).send({ status: "ok" });
  });
  // -----------------------------------

  // --- Google Drive & Sheets Integration ---
  
  function getOAuthClient(req: any) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    // Dynamic redirect URI reconstruction matching current domain, supporting custom overrides
    let redirectUri = '';
    if (process.env.GOOGLE_REDIRECT_URI) {
      redirectUri = process.env.GOOGLE_REDIRECT_URI;
    } else if (process.env.APP_URL) {
      const base = process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL;
      redirectUri = `${base}/api/auth/google/callback`;
    } else {
      // Respect reverse proxies (like Hugging Face Spaces) which pass protocol and host headers
      const protocolRaw = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      let protocol = 'https';
      if (typeof protocolRaw === 'string') {
        const parts = protocolRaw.split(',');
        protocol = parts[0].trim();
      }
      
      const rawHost = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      // Ensure host is clean
      const host = rawHost.split(',')[0].trim();
      
      // Force HTTPS for external cloud hosting / spaces environments to match public URLs exactly
      if (
        host.includes('hf.space') || 
        host.includes('huggingface.co') || 
        host.includes('run.app') || 
        host.includes('netlify.app') || 
        host.includes('vercel.app') || 
        host.includes('render.com') ||
        host.includes('herokuapp.com')
      ) {
        protocol = 'https';
      }
      
      redirectUri = `${protocol}://${host}/api/auth/google/callback`;
    }

    return new google.auth.OAuth2(
      clientId || undefined,
      clientSecret || undefined,
      redirectUri
    );
  }

  let firebaseBackendApp: any = null;

  async function getFirebaseAppOnServer() {
    if (firebaseBackendApp) return firebaseBackendApp;
    try {
      const { initializeApp: serverInitApp, getApp: serverGetApp } = await import('firebase/app');
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(firebaseConfigPath)) {
        const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        try {
          firebaseBackendApp = serverGetApp("server-oauth-backend");
        } catch (e) {
          firebaseBackendApp = serverInitApp(configJson, "server-oauth-backend");
        }
        return firebaseBackendApp;
      }
    } catch (err) {
      console.warn("Server: Failed to prepare server-side Firebase app:", err);
    }
    return null;
  }

  async function loadTokensFromFirestore() {
    try {
      const app = await getFirebaseAppOnServer();
      if (!app) return null;
      
      const { getFirestore: serverGetFirestore, doc: serverDoc, getDoc: serverGetDoc } = await import('firebase/firestore');
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      const db = serverGetFirestore(app, configJson.firestoreDatabaseId);
      
      const gsDocRef = serverDoc(db, 'config', 'google_sheets');
      const gsSnap = await serverGetDoc(gsDocRef);
      if (gsSnap.exists()) {
        const data = gsSnap.data();
        if (data && data.tokens) {
          return data.tokens;
        }
      }
    } catch (fbErr) {
      console.warn("Server: Failed load fallback Google credentials from Firestore:", fbErr);
    }
    return null;
  }

  async function saveTokensToFirestore(tokens: any) {
    try {
      const app = await getFirebaseAppOnServer();
      if (!app) return;
      
      const { getFirestore: serverGetFirestore, doc: serverDoc, setDoc: serverSetDoc, getDoc: serverGetDoc } = await import('firebase/firestore');
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      const db = serverGetFirestore(app, configJson.firestoreDatabaseId);
      
      const gsDocRef = serverDoc(db, 'config', 'google_sheets');
      const gsSnap = await serverGetDoc(gsDocRef);
      const gsExisting = gsSnap.exists() ? gsSnap.data() : {};
      
      // Critical: Ensure we always retain any existing refresh_token if the incoming one is missing it
      const finalTokens = { ...tokens };
      if (gsExisting.tokens && gsExisting.tokens.refresh_token && !finalTokens.refresh_token) {
        finalTokens.refresh_token = gsExisting.tokens.refresh_token;
      }

      await serverSetDoc(gsDocRef, {
        ...gsExisting,
        tokens: finalTokens,
        updatedAt: Date.now()
      });
      console.log("Server: Google credentials successfully saved to Firestore.");
    } catch (fbErr: any) {
      console.error("Server: Failed saving Google credentials to Firestore:", fbErr);
    }
  }

  async function getAuthorizedClient(req: any, clientTokens: any) {
    const auth = getOAuthClient(req);
    
    // Auto-resolve tokens using Firestore source-of-truth if client provided no tokens OR if they are stale/incomplete
    const dbTokens = await loadTokensFromFirestore() || {};
    
    // Clean any empty, null or undefined fields from clientTokens to keep them from overwriting valid db values
    const cleanClientTokens: any = {};
    if (clientTokens) {
      Object.entries(clientTokens).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '' && val !== 'undefined') {
          cleanClientTokens[key] = val;
        }
      });
    }

    const tokens = { ...dbTokens, ...cleanClientTokens };

    // Guarantee refresh_token is preserved from DB baseline if missing in request
    if (dbTokens.refresh_token && (!tokens.refresh_token || tokens.refresh_token === 'undefined')) {
      tokens.refresh_token = dbTokens.refresh_token;
    }

    if (!tokens || !tokens.access_token) {
      throw new Error("No Google Connection configuration found in local cache or server-side store.");
    }

    auth.setCredentials(tokens);

    let refreshedTokens: any = null;
    auth.on('tokens', (newTokens) => {
      refreshedTokens = { ...tokens, ...newTokens };
      // Keep refresh_token intact
      if (tokens.refresh_token && !refreshedTokens.refresh_token) {
        refreshedTokens.refresh_token = tokens.refresh_token;
      }
      
      // Persist refreshed tokens to Firestore on the fly!
      saveTokensToFirestore(refreshedTokens).catch(err => {
        console.error("Server: Token refresh save background crash:", err);
      });
    });

    if (tokens && tokens.refresh_token) {
      try {
        await auth.getAccessToken(); // This automatically triggers a refresh if expired!
      } catch (err) {
        console.warn('OAuth token refresh triggered warning:', err);
      }
    }

    return { 
      auth, 
      getTokens: () => refreshedTokens 
    };
  }

  // --- Google OAuth Redirect Flow ---
  app.get("/api/auth/google", (req, res) => {
    try {
      const authClient = getOAuthClient(req);
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'openid',
        'email',
        'profile'
      ];
      const url = authClient.generateAuthUrl({
        access_type: 'offline', // Requests refresh token
        prompt: 'consent',      // Forces consent screen to guarantee refresh token is returned
        scope: scopes
      });
      res.redirect(url);
    } catch (error: any) {
      res.status(500).send(`OAuth initiation error: ${error.message}`);
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      return res.send("<script>window.close();</script>");
    }
    try {
      const authClient = getOAuthClient(req);
      const { tokens } = await authClient.getToken(code);
      
      // Real-time synchronization to Firebase Firestore 24/7 so Hugging Face or any external frontend receives active tokens instantly
      try {
        await saveTokensToFirestore(tokens);
      } catch (fbErr: any) {
        console.error("Server: Failed syncing Google credentials to Firestore:", fbErr);
      }
      
      const escapedTokensStr = JSON.stringify(tokens).replace(/</g, '\\u003c');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Google Connection Success</title>
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0f172a; color: #f8fafc;">
          <div style="text-align: center; padding: 2.5rem; background: #1e293b; border-radius: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 420px; width: 90%; border: 1px solid #334155;">
            <div style="background: rgba(16, 185, 129, 0.1); color: #10b981; width: 4.5rem; height: 4.5rem; border-radius: 50vw; display: inline-flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 1.5rem; border: 2px solid rgba(16, 185, 129, 0.3);">✓</div>
            
            <h1 style="color: #ffffff; margin: 0 0 0.75rem 0; font-size: 1.75rem; font-weight: 900; letter-spacing: -0.025em; text-transform: uppercase;">LINK SYSTEM OK!</h1>
            
            <p style="color: #34d399; margin: 0 0 1rem 0; font-size: 0.95rem; font-weight: 800; line-height: 1.5; direction: rtl; font-family: sans-serif;">
              Aap ka Google Sheets account kamyabi se connect ho chuka hai!
            </p>
            
            <p style="color: #94a3b8; margin: 0 0 2rem 0; font-size: 0.85rem; line-height: 1.6; font-weight: 500;">
              Google account integration successfully completed. The background synchronization stream is now active 24/7.
            </p>

            <button onclick="window.close()" style="width: 100%; cursor: pointer; color: #ffffff; background: #10b981; border: none; padding: 1rem 1.5rem; border-radius: 0.75rem; font-size: 0.85rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s ease; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); outline: none;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
              CLOSE WINDOW / BUND KAREIN
            </button>
            
            <p style="color: #64748b; font-size: 0.75rem; margin: 1.5rem 0 0 0; font-weight: 600;">
              This window should close automatically in 2 seconds...
            </p>
          </div>
          
          <script>
            try {
              var tokens = ${escapedTokensStr};
              localStorage.setItem("gts_sync_google_tokens_direct", JSON.stringify(tokens));
              
              // Direct dispatch of postMessage
              if (window.opener) {
                window.opener.postMessage({ type: "google-oauth-success", tokens: tokens }, "*");
              }
              
              // Try to force close after brief delay
              setTimeout(function() {
                try {
                  window.close();
                } catch(e) {
                  console.warn("Auto close blocked:", e);
                }
              }, 2000);
            } catch (err) {
              console.error("Popup storage execution error:", err);
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: "google-oauth-success", tokens: ${escapedTokensStr} }, "*");
                }
              } catch (inner) {}
              setTimeout(function() {
                try {
                  window.close();
                } catch(e) {}
              }, 2000);
            }
          </script>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Callback code exchange error:", error);
      
      let redirectUriUsed = 'Unknown';
      try {
        const client = getOAuthClient(req);
        redirectUriUsed = (client as any).redirectUri || 'Unknown';
      } catch (e) {}

      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Google Connection Error</title>
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0f172a; color: #f8fafc; padding: 1rem;">
          <div style="text-align: left; padding: 2.5rem; background: #1e293b; border-radius: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 500px; width: 100%; border: 1px solid #f43f5e;">
            <div style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; width: 4.5rem; height: 4.5rem; border-radius: 50vw; display: inline-flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 1.5rem; border: 2px solid rgba(244, 63, 94, 0.3);">!</div>
            
            <h1 style="color: #ffffff; margin: 0 0 0.75rem 0; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.025em; text-transform: uppercase;">CONNECTION ERROR / MISHAP!</h1>
            
            <p style="color: #f43f5e; margin: 0 0 1rem 0; font-size: 0.95rem; font-weight: 800; line-height: 1.5; direction: rtl; font-family: sans-serif;">
              Google account se secure token exchange fail ho gaya hai.
            </p>
            
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.75rem; border: 1px solid #334155; margin-bottom: 1.5rem;">
              <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0.25rem;">Server Code Exchange Error:</div>
              <div style="font-family: monospace; font-size: 0.85rem; color: #f43f5e; word-break: break-all;">${error.message || error}</div>
            </div>

            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.75rem; border: 1px solid #334155; margin-bottom: 1.5rem;">
              <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 0.25rem;">Redirect URI Used by Server:</div>
              <div style="font-family: monospace; font-size: 0.85rem; color: #38bdf8; word-break: break-all;">${redirectUriUsed}</div>
            </div>

            <p style="color: #94a3b8; margin: 0 0 1.5rem 0; font-size: 0.85rem; line-height: 1.5; font-weight: 500;">
              Google require karta hai ke exchange ke waqt dynamic redirect URI exact match kare client configs se. Google Console mein check karein ke upar diya gaya URI authorized callback list mein saved hai.
            </p>

            <button onclick="window.close()" style="width: 100%; cursor: pointer; color: #ffffff; background: #334155; border: none; padding: 0.85rem 1.5rem; border-radius: 0.75rem; font-size: 0.85rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s ease;" onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#334155'">
              CLOSE WINDOW
            </button>
          </div>
        </body>
        </html>
      `);
    }
  });

  function getCleanErrorDetails(error: any) {
    if (!error) return null;
    const data = error.response?.data;
    if (data) {
      if (typeof data === 'object') {
        return {
          message: data.error?.message || data.message || null,
          status: data.error?.status || data.status || null,
          code: data.error?.code || data.code || null,
          errors: data.error?.errors || data.errors || null
        };
      }
      return { raw: String(data) };
    }
    return { message: error.message || String(error) };
  }

  function handleRouteError(res: any, error: any, messagePrefix: string) {
    const errorMsg = error.message || String(error);
    console.error(`${messagePrefix}:`, error.response?.data || errorMsg);
    
    // Safety check for credential or authorization failure
    const isAuthError = 
      error.status === 401 || 
      error.response?.status === 401 || 
      error.code === 401 || 
      error.code === '401' ||
      errorMsg.toLowerCase().includes('credential') || 
      errorMsg.toLowerCase().includes('auth') || 
      errorMsg.toLowerCase().includes('refresh token') || 
      errorMsg.toLowerCase().includes('refresh_token') || 
      errorMsg.toLowerCase().includes('invalid authentication') ||
      (error.response?.data && (
        String(error.response.data).toLowerCase().includes('credential') ||
        String(error.response.data).toLowerCase().includes('refresh token') ||
        (error.response.data.error?.message && (
          error.response.data.error.message.toLowerCase().includes('credential') ||
          error.response.data.error.message.toLowerCase().includes('refresh token')
        ))
      ));

    const statusCode = isAuthError ? 401 : 500;
    
    let finalErrorMsg = errorMsg;
    if (isAuthError && (errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token') || errorMsg.toLowerCase().includes('no refresh_token'))) {
      finalErrorMsg = "Google Account Connection lacks offline refresh permissions or has expired. Please Disconnect and Reconnect your Google Account inside the Admin Panel to refresh credentials.";
    }

    res.status(statusCode).json({
      error: finalErrorMsg,
      details: getCleanErrorDetails(error)
    });
  }

  // Helper to ensure a sheet exists before operating on it
  async function ensureSheetExists(sheets: any, spreadsheetId: string, range: string) {
    if (!range) return;
    
    // Extract sheet name from range (e.g., 'Sheet Name'!A1 or 'Sheet Name')
    let sheetName = range;
    if (range.includes('!')) {
      sheetName = range.split('!')[0];
    }
    
    // Remove single quotes if present
    if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
      sheetName = sheetName.substring(1, sheetName.length - 1);
    }

    try {
      // Get spreadsheet metadata to check if sheet exists
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = spreadsheet.data.sheets.some(
        (s: any) => s.properties.title === sheetName
      );

      if (!sheetExists) {
        console.log(`Sheet "${sheetName}" not found in ${spreadsheetId}. Creating it...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName }
                }
              }
            ]
          }
        });
      }
    } catch (err) {
      console.warn(`Could not verify/create sheet "${sheetName}":`, err);
      // Continue anyway, it might fail later but we tried
    }
  }

  app.post("/api/sheets/append", async (req, res) => {
    let { tokens, spreadsheetId, range, values } = req.body;
    
    // Auto fallback to Firestore-stored credentials if missing in client's request payload
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId. Please connect your Google account in the Admin Panel." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);

      const sheets = google.sheets({ version: 'v4', auth });
      
      // Auto-create sheet if it doesn't exist
      await ensureSheetExists(sheets, spreadsheetId, range);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: range || 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values]
        },
      });

      res.json({
        ...response.data,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error appending to sheet');
    }
  });

  app.post("/api/sheets/update", async (req, res) => {
    let { tokens, spreadsheetId, range, values } = req.body;
    
    // Auto fallback to Firestore-stored credentials if missing in client's request payload
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId. Please connect your Google account in the Admin Panel." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);

      const sheets = google.sheets({ version: 'v4', auth });
      
      // Auto-create sheet if it doesn't exist
      await ensureSheetExists(sheets, spreadsheetId, range);

      console.log(`Updating sheet ${spreadsheetId} at range ${range}`);
      
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: range || 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        },
      });

      res.json({
        ...response.data,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error updating sheet');
    }
  });

  app.post("/api/drive/backup", async (req, res) => {
    let { tokens, filename, content } = req.body;
    
    // Auto fallback to Firestore-stored credentials if missing in client's request payload
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens || !content) {
      return res.status(400).json({ error: "Missing tokens or content. Please connect your Google account in the Admin Panel." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);

      const drive = google.drive({ version: 'v3', auth });
      
      // 1. Find or create folder "GreenTech_Backups"
      const folderName = "GreenTech_Backups";
      let folderId: string;
      
      const folderSearch = await drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
      } else {
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
          requestBody: folderMetadata,
          fields: 'id',
        });
        folderId = folder.data.id!;
      }

      // 2. Upload file
      const fileMetadata = {
        name: filename || `backup_${new Date().toISOString()}.csv`,
        parents: [folderId]
      };
      
      const media = {
        mimeType: 'text/csv',
        body: content
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      res.json({
        ...file.data,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error backing up to Drive');
    }
  });

  app.post("/api/sheets/create", async (req, res) => {
    let { tokens, title, sheetName } = req.body;
    
    // Auto fallback to Firestore-stored credentials if missing in client's request payload
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens || !title) {
      return res.status(400).json({ error: "Missing tokens or title. Please connect your Google account in the Admin Panel." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title || 'WiFi Complaints Log'
          },
          // Optionally create with a specific sheet name by renaming the default first sheet
        }
      });

      const spreadsheetId = response.data.spreadsheetId;

      if (spreadsheetId && sheetName && sheetName !== 'Sheet1') {
        // Rename the first sheet (Sheet1) to the desired sheetName
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: 0, // Default first sheet usually has ID 0
                    title: sheetName
                  },
                  fields: 'title'
                }
              }
            ]
          }
        });
      }

      res.json({ 
        spreadsheetId, 
        spreadsheetUrl: response.data.spreadsheetUrl,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error creating spreadsheet');
    }
  });

  app.post("/api/sheets/bulk-export", async (req, res) => {
    let { tokens, spreadsheetId, sheetsData } = req.body;
    
    // Auto fallback to Firestore-stored credentials if missing in client's request payload
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens || !spreadsheetId || !sheetsData) {
      return res.status(400).json({ error: "Missing required parameters. Please connect your Google account in the Admin Panel." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);
      const sheets = google.sheets({ version: 'v4', auth });

      // 1. Ensure all requested sheets exist
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const existingSheetTitles = spreadsheet.data.sheets.map((s: any) => s.properties.title);
      
      const sheetsToCreate = sheetsData.filter((s: any) => !existingSheetTitles.includes(s.title));
      
      if (sheetsToCreate.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: sheetsToCreate.map((s: any) => ({
              addSheet: { properties: { title: s.title } }
            }))
          }
        });
      }

      // 2. Clear sheets before updating to prevent old data from remaining
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: {
          ranges: sheetsData.map((s: any) => `'${s.title}'!A1:Z10000`)
        }
      });

      // 3. Update all sheets with data
      const dataUpdates = sheetsData.map((s: any) => ({
        range: `'${s.title}'!A1`,
        values: s.values
      }));

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: dataUpdates
        }
      });

      res.json({ 
        success: true,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error in bulk export');
    }
  });

  // --- Server-Side 10-Minute Automatic Background Google Sheets Sync Worker ---
  async function startServerSideAutoBackupScheduler() {
    console.log("[Server Auto-Backup] Initializing 10-minute continuous background sync daemon...");

    async function checkAndRunServerAutoBackup() {
      try {
        const app = await getFirebaseAppOnServer();
        if (!app) {
          console.warn("[Server Auto-Backup] Firebase app not initialized yet. Skipping check.");
          return;
        }

        const { getFirestore: serverGetFirestore, doc: serverDoc, getDoc: serverGetDoc, setDoc: serverSetDoc, collection: serverCollection, getDocs: serverGetDocs } = await import('firebase/firestore');
        const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (!fs.existsSync(firebaseConfigPath)) {
          console.warn("[Server Auto-Backup] firebase-applet-config.json not found on disk. Skipping background check.");
          return;
        }

        const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        const db = serverGetFirestore(app, configJson.firestoreDatabaseId);

        // Load the sheets configuration doc
        const gsDocRef = serverDoc(db, 'config', 'google_sheets');
        const gsSnap = await serverGetDoc(gsDocRef);
        if (!gsSnap.exists()) {
          console.log("[Server Auto-Backup] Google Sheets has not been configured in the system. Skipping.");
          return;
        }

        const configData = gsSnap.data();
        if (!configData || !configData.tokens || !configData.spreadsheetId) {
          console.log("[Server Auto-Backup] Google Sheets configuration or authorization credentials missing/under-construction. Skipping.");
          return;
        }

        if (!configData.tokens.refresh_token) {
          console.warn("[Server Auto-Backup] Saved Google connection lacks an offline refresh_token. Please disconnect and reconnect your Google Account in the Admin Panel to grant permanent offline refresh permissions. Skipping continuous background backup.");
          return;
        }

        const TEN_MINUTES = 10 * 60 * 1000;
        const lastBackup = configData.lastAutoBackupTime || 0;
        const now = Date.now();

        if (now - lastBackup < TEN_MINUTES) {
          console.log(`[Server Auto-Backup] Next automatic loop run skipped. Last execution was ${Math.round((now - lastBackup) / 1000)}s ago (needs 10M check).`);
          return;
        }

        console.log("[Server Auto-Backup] Last execution was more than 10 minutes ago. Triggering 24/7 background system sync...");

        // Fetch users, complaints, clients, config, and branding
        const [usersSnap, complaintsSnap, clientsSnap, configSnap, brandingSnap] = await Promise.all([
          serverGetDocs(serverCollection(db, 'users')),
          serverGetDocs(serverCollection(db, 'complaints')),
          serverGetDocs(serverCollection(db, 'clients')),
          serverGetDoc(serverDoc(db, 'config', 'app')),
          serverGetDoc(serverDoc(db, 'config', 'branding'))
        ]);

        const users = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id }));
        const complaints = complaintsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const clients = clientsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const appConfig = configSnap.exists() ? configSnap.data() : {};
        const branding = brandingSnap.exists() ? brandingSnap.data() : {};

        // Format to spreadsheet rows (Operational Logs, User Register, Client Database, System Config)
        const complaintHeaders = ['Date', 'ID', 'Logged By', 'Client', 'Contact', 'Area', 'Category', 'Priority', 'Status', 'Description'];
        const complaintRows = complaints.map((c: any) => [
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

        const userHeaders = ['UID', 'Username', 'Full Name', 'Role', 'Dealer ID', 'Company', 'Line Code', 'Last Active', 'Created At'];
        const userRows = users.map((u: any) => [
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

        const clientHeaders = ['ID', 'Username', 'Name', 'Contact', 'Area', 'Address', 'Priority', 'Assigned To', 'Created At'];
        const clientRows = clients.map((c: any) => [
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

        const configHeaders = ['Section', 'Setting Key', 'Value'];
        const configRows: any[][] = [];
        
        Object.entries(appConfig || {}).forEach(([key, value]) => {
          configRows.push([
            'Application',
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          ]);
        });

        Object.entries(branding || {}).forEach(([key, value]) => {
          configRows.push([
            'Branding',
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          ]);
        });

        const sheetsData = [
          { title: 'Operational Logs', values: [complaintHeaders, ...complaintRows] },
          { title: 'User Register', values: [userHeaders, ...userRows] },
          { title: 'Client Database', values: [clientHeaders, ...clientRows] },
          { title: 'System Config', values: [configHeaders, ...configRows] }
        ];

        // Authorize sheets API using getAuthorizedClient mock req
        const mockReq = { headers: {} };
        const { auth, getTokens: refreshTokensCb } = await getAuthorizedClient(mockReq, configData.tokens);
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = configData.spreadsheetId;

        // Ensure all sheets exist
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const existingSheetTitles = spreadsheet.data.sheets.map((s: any) => s.properties.title);
        
        const sheetsToCreate = sheetsData.filter((s: any) => !existingSheetTitles.includes(s.title));
        
        if (sheetsToCreate.length > 0) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: sheetsToCreate.map((s: any) => ({
                addSheet: { properties: { title: s.title } }
              }))
            }
          });
        }

        // Clear existing rows
        await sheets.spreadsheets.values.batchClear({
          spreadsheetId,
          requestBody: {
            ranges: sheetsData.map((s: any) => `'${s.title}'!A1:Z10000`)
          }
        });

        // Write row data
        const dataUpdates = sheetsData.map((s: any) => ({
          range: `'${s.title}'!A1`,
          values: s.values
        }));

        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: dataUpdates
          }
        });

        // Sync local updated tokens if produced, and update timestamp
        const finalTokens = refreshTokensCb() || configData.tokens;
        await serverSetDoc(gsDocRef, {
          ...configData,
          tokens: finalTokens,
          lastAutoBackupTime: now,
          updatedAt: Date.now()
        });

        console.log(`[Server Auto-Backup] 10-Minute Google Sheets background sync successful on server: ${spreadsheetId}`);
      } catch (err) {
        console.error("[Server Auto-Backup] Server-side loop failed:", err);
      }
    }

    // Delay run by 30s to let server startup settle
    setTimeout(() => {
      checkAndRunServerAutoBackup();
      setInterval(checkAndRunServerAutoBackup, 60000); // Check once every minute
    }, 30000);
  }

  startServerSideAutoBackupScheduler().catch(daemonErr => {
    console.error("[Server Auto-Backup Daemon] Background sync scheduler startup failed:", daemonErr);
  });

  // --- End Google Drive & Sheets Integration ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, the server might be bundled into /dist/ or run from the root
    let distPath = path.join(process.cwd(), "dist");
    
    // If we're running from inside dist/ already (bundled server.js), 
    // or if the dist folder isn't where we expect, try to find it relative to this file
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      distPath = _dirname;
      if (!fs.existsSync(path.join(distPath, "index.html"))) {
        // Fallback or log error
        console.warn("Could not find index.html in dist paths. Static serving might fail.");
      }
    }
    
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
