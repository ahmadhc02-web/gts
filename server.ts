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
    
    // Dynamic redirect URI reconstruction matching current domain
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

    return new google.auth.OAuth2(
      clientId || undefined,
      clientSecret || undefined,
      redirectUri
    );
  }

  async function getAuthorizedClient(req: any, tokens: any) {
    const auth = getOAuthClient(req);
    auth.setCredentials(tokens);

    let refreshedTokens: any = null;
    auth.on('tokens', (newTokens) => {
      refreshedTokens = { ...tokens, ...newTokens };
    });

    if (tokens.refresh_token) {
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
        const { initializeApp: serverInitApp } = await import('firebase/app');
        const { getFirestore: serverGetFirestore, doc: serverDoc, setDoc: serverSetDoc, getDoc: serverGetDoc } = await import('firebase/firestore');
        const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(firebaseConfigPath)) {
          const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
          const tempApp = serverInitApp(configJson, "server-oauth-sync-" + Date.now());
          const tempDb = serverGetFirestore(tempApp, configJson.firestoreDatabaseId);
          
          const gsDocRef = serverDoc(tempDb, 'config', 'google_sheets');
          const gsSnap = await serverGetDoc(gsDocRef);
          const gsExisting = gsSnap.exists() ? gsSnap.data() : {};
          
          await serverSetDoc(gsDocRef, {
            ...gsExisting,
            tokens,
            updatedAt: Date.now()
          });
          console.log("Server: Google Sheets connection credentials successfully synchronized to Firestore.");
        }
      } catch (fbErr: any) {
        console.error("Server: Failed syncing Google credentials to Firestore:", fbErr);
      }
      
      const escapedTokensStr = JSON.stringify(tokens).replace(/</g, '\\u003c');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Google Connection Success</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <div style="color: #10b981; font-size: 3rem; margin-bottom: 1rem;">✓</div>
            <h1 style="color: #1e293b; margin: 0 0 0.5rem 0; font-size: 1.5rem;">Connection Successful!</h1>
            <p style="color: #64748b; margin: 0 0 1.5rem 0;">You have securely connected your Google account permanently.</p>
            <p style="color: #94a3b8; font-size: 0.875rem; margin: 0;">Closing this window now...</p>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: "google-oauth-success", tokens: ${escapedTokensStr} }, "*");
                setTimeout(() => window.close(), 1500);
              } else {
                setTimeout(() => window.close(), 2000);
              }
            } catch (err) {
              console.error(err);
            }
          </script>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Callback code exchange error:", error);
      res.status(500).send(`Authentication helper error: ${error.message}`);
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
      errorMsg.toLowerCase().includes('invalid authentication') ||
      (error.response?.data && (
        String(error.response.data).toLowerCase().includes('credential') ||
        (error.response.data.error?.message && error.response.data.error.message.toLowerCase().includes('credential'))
      ));

    const statusCode = isAuthError ? 401 : 500;
    
    res.status(statusCode).json({
      error: errorMsg,
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
    const { tokens, spreadsheetId, range, values } = req.body;
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId" });
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
    const { tokens, spreadsheetId, range, values } = req.body;
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId" });
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
    const { tokens, filename, content } = req.body;
    
    if (!tokens || !content) {
      return res.status(400).json({ error: "Missing tokens or content" });
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
    const { tokens, title, sheetName } = req.body;
    
    if (!tokens || !title) {
      return res.status(400).json({ error: "Missing tokens or title" });
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
    const { tokens, spreadsheetId, sheetsData } = req.body;
    
    if (!tokens || !spreadsheetId || !sheetsData) {
      return res.status(400).json({ error: "Missing required parameters" });
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
