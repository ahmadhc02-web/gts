import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Google Sheets Integration ---
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    '' // Redirect URI will be set dynamically
  );

  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

  app.get("/api/auth/google/url", (req, res) => {
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const redirectUri = `${origin}/auth/google/callback`;
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: redirectUri,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const origin = `https://${req.headers.host}`;
    const redirectUri = `${origin}/auth/google/callback`;

    try {
      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      
      // In a real app, we would save these tokens to a database associated with the user/app
      // For now, we'll return a success page that posts a message back to the opener
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_AUTH_SUCCESS', 
                  tokens: ${JSON.stringify(tokens)} 
                }, '*');
                window.close();
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
      const auth = new google.auth.OAuth2(
        process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
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
      console.error('Error appending to sheet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- End Google Sheets Integration ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
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
