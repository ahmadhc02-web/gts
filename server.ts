import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
import fs from "fs";
import { whatsappBridge } from "./whatsapp-bridge.ts";

dotenv.config();

console.log('[Server] SERVER STARTING UP...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeStringify(obj: any): string {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return '[Circular]';
        cache.add(value);
      }
      return value;
    });
  } catch (e) {
    return 'null';
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Google Drive & Sheets Integration ---
  
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  const getBaseUrl = (req: express.Request) => {
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, "");
    }
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = req.headers.origin || (host ? `${protocol}://${host}` : 'http://localhost:3000');
    return baseUrl.replace(/\/$/, "");
  };

  const getRedirectUri = (req: express.Request) => {
    return `${getBaseUrl(req)}/auth/google/callback`;
  };

  app.get("/api/auth/google/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ 
        error: "Google OAuth credentials missing. Please add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the project Settings." 
      });
    }

    const redirectUri = getRedirectUri(req);
    console.log(`Generating Auth URL with redirectUri: ${redirectUri}`);
    
    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get("/api/auth/google/config", (req, res) => {
    res.json({
      redirectUri: getRedirectUri(req),
      origin: getBaseUrl(req)
    });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = getRedirectUri(req);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).send("Server configuration error: GOOGLE_CLIENT_ID missing");
    }

    try {
      const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await client.getToken(code as string);
      
      console.log('Google Auth success, tokens received');
      
      // In a real app, we would save these tokens to a database associated with the user/app
      // For now, we'll return a success page that posts a message back to the opener
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_AUTH_SUCCESS', 
                  tokens: ${safeStringify(tokens)} 
                }, '*');
                setTimeout(() => {
                  window.close();
                }, 1000);
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.post("/api/sheets/append", async (req, res) => {
    const { tokens, spreadsheetId, range, values } = req.body;
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId" });
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in environment");
      }

      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: range || 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values]
        },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('Error appending to sheet:', error.response?.data || error);
      res.status(500).json({ error: error.message, details: error.response?.data });
    }
  });

  app.post("/api/sheets/update", async (req, res) => {
    const { tokens, spreadsheetId, range, values } = req.body;
    
    if (!tokens || !spreadsheetId) {
      return res.status(400).json({ error: "Missing tokens or spreadsheetId" });
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in environment");
      }

      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth });
      
      console.log(`Updating sheet ${spreadsheetId} at range ${range}`);
      
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: range || 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('Error updating sheet:', error.response?.data || error);
      res.status(500).json({ error: error.message, details: error.response?.data });
    }
  });

  app.post("/api/drive/backup", async (req, res) => {
    const { tokens, filename, content } = req.body;
    
    if (!tokens || !content) {
      return res.status(400).json({ error: "Missing tokens or content" });
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in environment");
      }

      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials(tokens);

      const drive = google.drive({ version: 'v3', auth });
      
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

      res.json(file.data);
    } catch (error: any) {
      console.error('Error backing up to Drive:', error.response?.data || error);
      res.status(500).json({ error: error.message, details: error.response?.data });
    }
  });

  // --- WhatsApp Automation Routes ---

  app.get("/api/whatsapp/status", (req, res) => {
    const status = whatsappBridge.getStatus();
    if (status.qrCodeUrl) {
      console.log(`[Server] Serving status: ${status.status} (QR Code available)`);
    } else {
      console.log(`[Server] Serving status: ${status.status} (No QR Code)`);
    }
    res.json(status);
  });

  app.post("/api/whatsapp/pairing-code", async (req, res) => {
    const { phoneNumber } = req.body;
    console.log(`[Server] Received pairing code request for: ${phoneNumber}`);
    if (!phoneNumber) {
      console.error('[Server] Pairing code request failed: No phone number provided');
      return res.status(400).json({ error: "Missing phoneNumber" });
    }

    try {
      console.log(`[Server] Calling bridge.requestPairingCode...`);
      const result = await whatsappBridge.requestPairingCode(phoneNumber);
      console.log(`[Server] Bridge returned pairing code: ${result.code}`);
      res.json(result);
    } catch (error: any) {
      console.error('[Server] WhatsApp Pairing Code Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    const { phoneNumber, text } = req.body;
    if (!phoneNumber || !text) {
      return res.status(400).json({ error: "Missing phoneNumber or text" });
    }

    try {
      const result = await whatsappBridge.sendMessage(phoneNumber, text);
      res.json(result);
    } catch (error: any) {
      console.error('WhatsApp Send Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/logout", async (req, res) => {
    console.log('[Server] Received WhatsApp LOGOUT request');
    try {
      const result = await whatsappBridge.logout();
      console.log('[Server] WhatsApp logout successful');
      res.json(result);
    } catch (error: any) {
      console.error('[Server] WhatsApp logout FAILED:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- End WhatsApp Automation Routes ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
      distPath = __dirname;
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
