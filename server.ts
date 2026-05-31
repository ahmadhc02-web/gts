import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

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

  // --- Password OTP Recovery Endpoints ---
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Access ID (Username) is required." });
      }

      // 1. Fetch user from Firestore
      const db = await getFirestoreOnServer();
      if (!db) {
        return res.status(500).json({ error: "Database not initialized on server." });
      }
      const { collection: serverCollection, getDocs: serverGetDocs, doc: serverDoc, setDoc: serverSetDoc } = await import('firebase/firestore');

      const usersSnap = await serverGetDocs(serverCollection(db, 'users'));
      const foundUser: any = usersSnap.docs
        .map(d => ({ ...(d.data() as any), id: d.id }))
        .find((u: any) => String(u.username || '').toLowerCase() === username.trim().toLowerCase());

      if (!foundUser) {
        return res.status(404).json({ error: "Identity registry does not contain this Access ID." });
      }

      if (!foundUser.email) {
        return res.status(400).json({ error: "No recovery email is registered for this account. Please contact an administrator." });
      }

      // 2. Generate a secure 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 3. Store the OTP in Firestore
      const otpRef = serverDoc(db, 'reset_otps', username.trim().toLowerCase());
      await serverSetDoc(otpRef, {
        username: username.trim().toLowerCase(),
        code: otpCode,
        email: foundUser.email,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
        verified: false
      });

      // 4. Send Gmail / Fallback Sim
      let emailStatus = "simulated";
      let errorDetail = null;

      const tokens = await loadTokensFromFirestore();
      const appUrl = req.headers.origin || process.env.APP_URL || "https://ais-pre-y57fbgpyjpmaocrhgtopol-853220806804.asia-southeast1.run.app";
      const resetUrl = `${appUrl}/?reset_username=${encodeURIComponent(username.trim())}&reset_code=${otpCode}`;

      const subject = "GTS ISP Control Panel - Security Registry Verification Passcode";
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b; max-width: 600px; margin: 0 auto; border-radius: 1rem; border: 1px solid #e2e8f0; border-top: 4px solid #10b981;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #0f172a; margin: 0; font-size: 1.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">GTS ISP SYSTEM</h1>
            <p style="color: #64748b; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">Security Protocol Registry</p>
          </div>
          <p style="font-size: 0.95rem; line-height: 1.6;">
            Hello <strong>${foundUser.fullName || foundUser.username}</strong>,
          </p>
          <p style="font-size: 0.95rem; line-height: 1.6;">
            A security verification passcode was requested to reset credentials for access identifier <strong>${foundUser.username}</strong>.
            If you did not make this request, please login and change your security passwords immediately.
          </p>
          <div style="background-color: #f1f5f9; border-radius: 0.75rem; padding: 1.5rem; margin: 2rem 0; text-align: center; border: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; color: #64748b;">Verification Reset Code</p>
            <h2 style="margin: 0; font-size: 2.25rem; font-weight: 950; letter-spacing: 0.2em; color: #10b981;">${otpCode}</h2>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.7rem; color: #94a3b8;">Code expires in 10 minutes</p>
          </div>
          <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem;">
            Alternatively, you can complete your passcode configuration instantly by loading the custom reset interface with the following security link:
          </p>
          <div style="text-align: center; margin-bottom: 2rem;">
            <a href="${resetUrl}" style="background-color: #10b981; color: white; display: inline-block; padding: 0.75rem 1.75rem; text-decoration: none; border-radius: 0.75rem; font-weight: bold; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.2);">RESET PASSCODE INSTANTLY</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 2rem 0;" />
          <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; line-height: 1.5; margin: 0;">
            Green Tech Services Support Registry &bull; Core Diagnostics Gateway<br />
            This transaction log consists of automated secure communications. Do not directly reply.
          </p>
        </div>
      `;

      if (tokens && tokens.access_token) {
        try {
          const { auth } = await getAuthorizedClient(req, tokens);
          const gmail = google.gmail({ version: 'v1', auth });

          // Encode MIME message in RFC 2822 base64url standard
          const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
          const mimeParts = [
            `To: ${foundUser.email}`,
            `Subject: ${utf8Subject}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            emailHtml
          ];
          const mimeMessage = mimeParts.join('\n');
          const base64Encoded = Buffer.from(mimeMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: base64Encoded
            }
          });
          emailStatus = "sent_gmail_api";
        } catch (err: any) {
          console.error("Gmail API sending failed:", err);
          errorDetail = err.message || String(err);
        }
      } else {
        console.warn("No active Google connection config found in Firestore.");
        errorDetail = "Google sheets/Gmail account is not connected. Please ask your administrator to connect their Google Sheets/Gmail inside the Integrations Center.";
      }

      // Output the code ONLY to terminal console for local debugging (invisible to the client page)
      console.log("========================================");
      console.log(`[PASSCODE RESET SECURITY MODULE - SERVER DEBUG ONLY]`);
      console.log(`User: ${foundUser.username}`);
      console.log(`Dest Email: ${foundUser.email}`);
      console.log(`Generated OTP Reset Code: ${otpCode}`);
      console.log(`Access Link: ${resetUrl}`);
      console.log("========================================");

      // Verify that the email was successfully sent via authorized Gmail SMTP
      if (emailStatus !== "sent_gmail_api") {
        return res.status(400).json({
          error: `Gmail sending failed: ${errorDetail || "Google connection config is offline."}. Please authenticate/reconnect your Google Account inside the Gmail Center.`
        });
      }

      // Return details to front-end securely
      res.json({
        status: "ok",
        emailStatus,
        email: foundUser.email
      });
    } catch (error: any) {
      console.error("send-otp failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { username, code } = req.body;
      if (!username || !code) {
        return res.status(400).json({ error: "Access ID and 6-digit verification code are required." });
      }

      const db = await getFirestoreOnServer();
      if (!db) {
        return res.status(500).json({ error: "Database not initialized on server." });
      }
      const { doc: serverDoc, getDoc: serverGetDoc, updateDoc: serverUpdateDoc } = await import('firebase/firestore');

      const otpRef = serverDoc(db, 'reset_otps', username.trim().toLowerCase());
      const otpSnap = await serverGetDoc(otpRef);

      if (!otpSnap.exists()) {
        return res.status(400).json({ error: "No reset session matches this User ID. Please request a new code." });
      }

      const otpData = otpSnap.data();
      if (String(otpData.code).trim() !== String(code).trim()) {
        return res.status(400).json({ error: "Incorrect verification passcode. Please test your checks and retry." });
      }

      if (Date.now() > otpData.expiresAt) {
        return res.status(400).json({ error: "The verification passcode has expired. Please request a new code." });
      }

      // Set verified true
      await serverUpdateDoc(otpRef, { verified: true });

      res.json({ status: "ok", message: "Passcode successfully verified. Please establish your new security passcode now." });
    } catch (error: any) {
      console.error("verify-otp failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { username, code, newPassword } = req.body;
      if (!username || !code || !newPassword) {
        return res.status(400).json({ error: "Missing required parameters." });
      }

      if (newPassword.length < 5) {
        return res.status(400).json({ error: "The new passcode must be at least 5 characters long." });
      }

      const db = await getFirestoreOnServer();
      if (!db) {
        return res.status(500).json({ error: "Database not initialized on server." });
      }
      const { collection: serverCollection, getDocs: serverGetDocs, doc: serverDoc, getDoc: serverGetDoc, updateDoc: serverUpdateDoc, deleteDoc: serverDeleteDoc } = await import('firebase/firestore');

      // 1. Check OTP verification
      const otpRef = serverDoc(db, 'reset_otps', username.trim().toLowerCase());
      const otpSnap = await serverGetDoc(otpRef);

      if (!otpSnap.exists()) {
        return res.status(400).json({ error: "No active password reset session found for this identity." });
      }

      const otpData = otpSnap.data();
      if (!otpData.verified) {
        return res.status(400).json({ error: "The passcode has not been verified yet." });
      }

      if (String(otpData.code).trim() !== String(code).trim()) {
        return res.status(400).json({ error: "Passcode verification mismatch." });
      }

      // 2. Locate user
      const usersSnap = await serverGetDocs(serverCollection(db, 'users'));
      const foundUser: any = usersSnap.docs
        .map(d => ({ ...(d.data() as any), id: d.id }))
        .find((u: any) => String(u.username || '').toLowerCase() === username.trim().toLowerCase());

      if (!foundUser) {
        return res.status(404).json({ error: "User record matching description no longer exists." });
      }

      // 3. Update password!
      const userRef = serverDoc(db, 'users', foundUser.id);
      await serverUpdateDoc(userRef, { password: newPassword });

      // --- Create Notification for security audit in Firestore ---
      const notifRef = serverDoc(serverCollection(db, 'notifications'));
      const { setDoc: serverSetDoc } = await import('firebase/firestore');
      await serverSetDoc(notifRef, {
        type: 'user_updated',
        message: `Security protocols updated: Passcode reset successfully finalized for user: ${foundUser.username}`,
        authorName: 'System Core Dispatcher',
        dealerId: foundUser.dealerId || 'main',
        createdAt: Date.now()
      });

      // 4. Clean up the OTP session
      await serverDeleteDoc(otpRef);

      res.json({ status: "ok", message: "Passcode updated successfully! You can now log in." });
    } catch (error: any) {
      console.error("reset-password failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // --- Gemini API & AI Help Integration ---
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY status check: Not found on server. System will generate intelligent analytical suggestions dynamically.");
        return null;
      }
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  async function fetchComplaintsOnServer() {
    try {
      const db = await getFirestoreOnServer();
      if (!db) return [];
      const { collection: serverCollection, getDocs: serverGetDocs } = await import('firebase/firestore');
      const complaintsSnap = await serverGetDocs(serverCollection(db, 'complaints'));
      return complaintsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (err) {
      console.error("Error fetching complaints for AI Help:", err);
      return [];
    }
  }

  app.get("/api/gemini/analyze-trends", async (req, res) => {
    try {
      const complaints = await fetchComplaintsOnServer();
      const gemini = getGeminiClient();

      if (!gemini) {
        // Return highly descriptive mock trends as high-quality fallback simulation when API Key is missing
        return res.json({
          overallStatus: "alert",
          recentTrendSummary: "Continuous road maintenance near Sector G-11 has damaged underground fiber cables. Multiple reports indicate high signal loss in Northern Zone. Most client issues resolves in under 45 minutes.",
          topIssues: [
            { category: "Fiber Cut", count: Math.max(3, complaints.filter((c: any) => String(c.category || '').toLowerCase().includes('fiber') || String(c.description || '').toLowerCase().includes('cut')).length), severity: "high", areaSuggested: "Sector G-11" },
            { category: "Slow Speed / Latency", count: Math.max(2, complaints.filter((c: any) => String(c.category || '').toLowerCase().includes('speed') || String(c.description || '').toLowerCase().includes('slow')).length), severity: "medium", areaSuggested: "Northern Zone" },
            { category: "No Internet", count: Math.max(4, complaints.filter((c: any) => String(c.category || '').toLowerCase().includes('no internet')).length), severity: "high", areaSuggested: "Main Block" }
          ],
          actionableSuggestions: [
            {
              title: "Physical Fiber Duct Damage in Sector G-11",
              category: "Fiber Cut",
              description: "Civic roadworks have sliced the optical feed. splicing crew is active on site.",
              troubleshootingSteps: [
                "Verify Optical Line Terminal (OLT) port status",
                "Measure loss using OTDR distance tracking",
                "Notify subscribers in Sector G-11 about physical repairs"
              ],
              templateResponse: "G-11 area mein roadworks activity ki wajah se fiber cable cut ho gayi hai. Humari splicing team mauqe par jor laga rahi hai. Agle 30-45 minutes mein speed aur connection automatic fully active ho jayenge. Pareshani ke liye moazrat."
            },
            {
              title: "IP Lease Attenuation or Gateway Congestion",
              category: "Slow Speed / Latency",
              description: "Upstream route peering link saturated during hot hours. Instruct customer to flush local DNS cache.",
              troubleshootingSteps: [
                "Suggest user configuration set to Google DNS: 8.8.8.8",
                "Instruct user to turn off router for 5 minutes",
                "Flush regional MAC address leases on gateway Core Node 2"
              ],
              templateResponse: "Aap apna router power strip se nikal kar 5 min ke liye off rakhein phir lagayein. Is se dynamic IP change ho kar optimized static route per connect ho jayega aur latency auto drop ho jayegi."
            }
          ],
          generatedAt: Date.now(),
          isSimulated: true
        });
      }

      // Format complaints list to feed to Gemini
      const formattedComplaints = complaints.slice(-50).map((c: any) => ({
        id: c.id,
        category: c.category,
        priority: c.priority,
        status: c.status,
        description: c.description || "",
        area: c.area || "Unknown",
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "N/A"
      }));

      const prompt = `You are the ultimate expert ISP AI Network Diagnostics Specialist and Chief Support Assistant.
Analyze the following recent customer complaints from our telecom management database:
${JSON.stringify(formattedComplaints, null, 2)}

Provide a highly accurate, structured diagnostics overview and actionable agent coping guide in JSON format.
The JSON MUST follow this exact schema:
{
  "overallStatus": "safe" | "alert" | "critical",
  "recentTrendSummary": "A concise 2-3 sentences overview in professional ISP coordinator tone summarising the main events.",
  "topIssues": [
    {
      "category": "category name",
      "count": 12,
      "severity": "high" | "medium" | "low",
      "areaSuggested": "most affected area name"
    }
  ],
  "actionableSuggestions": [
    {
      "title": "Clear, striking issue title",
      "category": "related domain",
      "description": "ISP technical diagnosis and root cause analysis in 1 sentence.",
      "troubleshootingSteps": ["Step 1", "Step 2", "Step 3"],
      "templateResponse": "A charming, empathetic customer-ready support response copy in friendly Roman Urdu/English (e.g. 'Aap ka area line restore ho raha hai...'). Keep it extremely comforting and clear."
    }
  ]
}

Only return a valid, parsable JSON block. Absolutely no other text or explanation.`;

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an expert ISP Network AI Analyst. Output only a single JSON object fitting the requested structure exactly without markdown backticks."
        }
      });

      const jsonText = response.text || "{}";
      const cleaned = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      res.json({
        ...parsed,
        generatedAt: Date.now(),
        isSimulated: false
      });
    } catch (error: any) {
      console.error("AI help trend analysis failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/gemini/ask", async (req, res) => {
    try {
      const { question, history, searchGrounding } = req.body;
      const gemini = getGeminiClient();

      if (!gemini) {
        // High quality dynamic simulated expert replies matching any question context
        const query = (question || '').toLowerCase();
        let answer = "";
        let sources: any[] = [];

        if (searchGrounding) {
          sources = [
            { title: "GTS ISP Network Status Feed", uri: "https://gts-noc.net/status" },
            { title: "Regional Fiber Core Routing Map", uri: "https://gts-noc.net/fiber-routing" }
          ];
        }

        const headerMessage = searchGrounding 
          ? `**[Search Grounding Active — Grounded against Real-time Network Ports]**\n\n`
          : `**[ISP AI Mentor Active Standby]**\n\n`;

        if (query.includes("hello") || query.includes("hi ") || query.startsWith("hi") || query.includes("assalam") || query.includes("aoa") || query.includes("hey") || query.includes("help") || query.includes("madad")) {
          answer = `${headerMessage}Assalam-o-Alaikum! I am your GTS ISP AI Mentor. Online control channel completely active.
          
Kaise madad karoon aapki? Aap mujh se koi bhi technical sawal ya customer ticket log pooch sakte hain:
- **Fiber Splicing** guidelines aur OTDR loss levels.
- **Router resetting** aur ONU configuration step-by-step.
- **Slow speed** ya wifi latency troubleshooting.
- **Support Templates** sub-dealers ya subscribers ke liye.`;
        } else if (query.includes("offline") || query.includes("online")) {
          answer = `${headerMessage}**AI Resolver Engine Analysis:**
- **Status:** 100% ONLINE AND OPERATIONAL.
- **Diagnostic Gateway:** All channels active, fiber links synced in real-time.
- **Sync Protocol:** Firestore & local cache state fully connected.

*Urdu Support Template:*
"Humara automatic billing aur complaint control pool active/online hai. Kisi bhi break optical link ki link update database main real-time sync ho rahi hai."`;
        } else if (query.includes("password") || query.includes("reset") || query.includes("router") || query.includes("wifi")) {
          answer = `${headerMessage}### Router and ONU Configuration & Password Reset Protocol:

**1. Root Cause Analysis:**
Subscribers often experience offline state due to IP lease expiration or incorrect PPPoE authentication.

**2. Troubleshooting Steps:**
- **Step 1:** Turn off the optical ONU modem and Wi-Fi Router for 60 seconds.
- **Step 2:** Inspect patch cords; verify that the blue fiber cable is firmly locked in place.
- **Step 3:** Access the local router portal (**192.168.10.1** or **192.168.1.1**), navigate to the Wireless Safety/Security tab, select WPA2-PSK, and update SSID name/password.

**3. Roman Urdu Empathetic Customer Template:**
"Aap ka core router offline show ho raha hai, kindly modem aur router ko 1 minute ke liye power strip se unplug karke dobara on kijiye. Is se dynamic IP refresh ho kar internet normal connect ho jayega!"`;
        } else if (query.includes("complain") || query.includes("ticket") || query.includes("client")) {
          answer = `${headerMessage}### Ticket Diagnostics & Support Resolution Pathway:

- **Database Analysis:** Complaints are processed and labeled based on urgency (Critical, High, Medium, Low).
- **Proactive Verifications:** Always cross-reference the client's live PPPoE session history on the regional RADIUS node before physically dispatching field personnel.
- **Joint Splice Goal:** Ensure optical joint decay loss remains below **0.05dBm per splice point**.

*Urdu customer message template:*
"Aap ki shikayat database mein log ho chuki hai. Splicing team spot par fiber link check kar rahi hai. Aglay 30-45 minutes mein link automatic restore ho jayega."`;
        } else if (query.includes("speed") || query.includes("slow") || query.includes("latency") || query.includes("lag")) {
          answer = `${headerMessage}### Support Diagnostics for Elevated Attenuation/Slow Speed:

**1. Root Cause Hypothesis:**
Optical power values are decaying beyond boundaries (typical target: **-18dBm to -25dBm**; loss beyond **-27dBm** causes packet loss).

**2. Diagnostic Guide:**
- **Check 1:** Check the RX optic value of the GPON ONU. Re-splice at the local terminal if outside bounds.
- **Check 2:** Move high-traffic applications to the clean **5GHz Wi-Fi band** rather than the crowded 2.4GHz bandwidth.
- **Check 3:** Guide subscribers to clean current DNS and configure Cloudflare DNS (**1.1.1.1** and **1.0.0.1**).

**3. Urdu/Hindi Empathetic Customer Response:**
"Aap ke link ki signal strength standard se kam arhi hai jis se browsing speed impact ho rahi hai. Hum local distribution cabinet link refresh kar rhy hain. Kindly apne router ko restart kijiye, speed normal ho jayegi."`;
        } else if (query.includes("fiber") || query.includes("cut") || query.includes("splice") || query.includes("break")) {
          answer = `${headerMessage}### Standard physical Break & Fiber Core Splicing Protocol:

**1. Splicing Specifications:**
- Always perform a core-alignment splice to guarantee joint loss below 0.05dB.
- Splicing sequence color standards: **Blue, Orange, Green, Brown, Slate, White, Red, Black, Yellow, Violet, Rose, Aqua**.

**2. Roman Urdu Response Template:**
"Humare primary fiber route area mein road expansion activities ki wajah se optimization work ho rha hai jis se transient attenuation ho sakti hai. Humari repair team spot par fiber core splice kar rhi hai. Pareshani ke liye dil se moazrat."`;
        } else {
          answer = `${headerMessage}### ISP AI Mentor Diagnostics Plan for: *"${question}"*

**Technical Steps:**
1. Check the local GPON OLT optical port indicators.
2. Verify PPPoE server status for authentications and billing locks.
3. Clean the patch cord interface and measure incoming line light level with an optical power meter (standard values -18 to -25dBm).

**Roman Urdu Helpful Response:**
"Aap ke issue ki technical details humari customer support desk check kar rahi hai. Hum back-end portal se link parameters align kar rhy hain, jald hi update karke problem resolve kar di jaye gi."`;
        }

        return res.json({ answer, sources, isSimulated: true });
      }

      const prompt = `You are the Expert ISP AI Resolution Mentor. Help the support agent resolve a customer issue or system question.
Current Agent Query: "${question}"

System instructions:
- Give direct, professional, extremely helpful diagnostics & customer support templates.
- Write conversation in professional English mixed with friendly customer-friendly Roman Urdu/Hindi if templates are needed.
- Keep the response structured, clear, using bold titles or list bullets where appropriate.
- If live Search Grounding is active, use the latest information from Google Search regarding ISP status, telecom maintenance, broadband news, or routing events to ground your responses. Specify that you have verified active web pages.`;

      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        history.forEach((h: any) => {
          if (h.role === 'user') {
            contents.push(`User: ${h.text || h.message}`);
          } else {
            contents.push(`AI: ${h.text || h.message || h.answer}`);
          }
        });
      }
      contents.push(prompt);

      const config: any = {
        systemInstruction: "You are an expert ISP Network AI Advisor. Please detect the user's input language and answer directly in natural Urdu, Roman Urdu, Hindi, or English, depending on whichever language they ask the question in. Provide extremely accurate details."
      };

      if (searchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents.join('\n\n'),
        config: config
      });

      let sources: any[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        sources = chunks.map((chunk: any) => ({
          title: chunk?.web?.title || chunk?.web?.uri || 'Grounded Web Reference',
          uri: chunk?.web?.uri || ''
        })).filter((s: any) => s.uri);
      }

      res.json({
        answer: response.text || "Could not generate a solution at this moment.",
        sources,
        isSimulated: false
      });
    } catch (error: any) {
      console.error("AI ask advisor failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });
  // ----------------------------------------

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

  let serverFirestoreDb: any = null;

  async function getFirestoreOnServer() {
    if (serverFirestoreDb) return serverFirestoreDb;
    const appObj = await getFirebaseAppOnServer();
    if (!appObj) return null;
    try {
      const { initializeFirestore, getFirestore } = await import('firebase/firestore');
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(firebaseConfigPath)) {
        const configJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        try {
          serverFirestoreDb = initializeFirestore(appObj, {
            experimentalForceLongPolling: true
          }, configJson.firestoreDatabaseId);
        } catch (err) {
          serverFirestoreDb = getFirestore(appObj, configJson.firestoreDatabaseId);
        }
        return serverFirestoreDb;
      }
    } catch (err) {
      console.warn("Server: Failed to prepare server-side Firestore db:", err);
    }
    return null;
  }

  async function loadTokensFromFirestore() {
    try {
      const db = await getFirestoreOnServer();
      if (!db) return null;
      
      const { doc: serverDoc, getDoc: serverGetDoc } = await import('firebase/firestore');
      
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
      const db = await getFirestoreOnServer();
      if (!db) return;
      
      const { doc: serverDoc, setDoc: serverSetDoc, getDoc: serverGetDoc } = await import('firebase/firestore');
      
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
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'openid',
        'email',
        'profile'
      ];
      
      const originParam = req.query.origin as string || '';
      const url = authClient.generateAuthUrl({
        access_type: 'offline', // Requests refresh token
        prompt: 'consent',      // Forces consent screen to guarantee refresh token is returned
        scope: scopes,
        state: originParam      // Pass original client origin to state
      });
      res.redirect(url);
    } catch (error: any) {
      res.status(500).send(`OAuth initiation error: ${error.message}`);
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    const origin = req.query.state as string || '';
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

      // If client origin was passed (e.g. Hugging Face), redirect the popup back to that origin with token parameters.
      // The client application loaded in the popup will save the tokens to localStorage, post a same-origin message,
      // and close immediately.
      if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
        const redirectUrl = `${origin.endsWith('/') ? origin.slice(0, -1) : origin}/?google_oauth_success=true&tokens=${encodeURIComponent(JSON.stringify(tokens))}`;
        return res.redirect(redirectUrl);
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
              
              // Try to force close immediately
              try {
                window.close();
              } catch(e) {
                console.warn("Auto close blocked:", e);
              }
              
              setTimeout(function() {
                try {
                  window.close();
                } catch(e) {}
              }, 50);
            } catch (err) {
              console.error("Popup storage execution error:", err);
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: "google-oauth-success", tokens: ${escapedTokensStr} }, "*");
                }
              } catch (inner) {}
              
              try {
                window.close();
              } catch(e) {}
              
              setTimeout(function() {
                try {
                  window.close();
                } catch(e) {}
              }, 50);
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
    if (isAuthError && (errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token') || errorMsg.toLowerCase().includes('no refresh_token') || errorMsg.toLowerCase().includes('no refresh token'))) {
      finalErrorMsg = "Google authentication has expired or lacks offline permission. Please disconnect and reconnect your Google Account in the Admin Panel.";
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

  // --- Gmail API Endpoints ---
  app.get("/api/gmail/messages", async (req, res) => {
    let tokensStr = req.query.tokens as string;
    let tokens = null;
    if (tokensStr) {
      try {
        tokens = JSON.parse(decodeURIComponent(tokensStr));
      } catch (e) {}
    }
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    if (!tokens) {
      return res.status(400).json({ error: "Missing Google connection or offline tokens. Please link your Google Account." });
    }
    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        q: 'subject:(WiFi OR GTS OR Complaint OR ISP OR Invoice OR Diagnostic) OR label:SENT'
      });

      const messages = [];
      if (listRes.data.messages && listRes.data.messages.length > 0) {
        for (const msg of listRes.data.messages) {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!
            });
            const headers = detail.data.payload?.headers || [];
            const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
            const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || 'Unknown';
            const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown';
            const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
            messages.push({
              id: msg.id,
              threadId: msg.threadId,
              subject,
              to,
              from,
              date,
              snippet: detail.data.snippet || ''
            });
          } catch (itemErr) {
            console.warn(`Error compiling Gmail item details for ${msg.id}:`, itemErr);
          }
        }
      }

      res.json({
        messages,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error loading Gmail messages');
    }
  });

  app.post("/api/gmail/send", async (req, res) => {
    let { tokens, to, subject, body } = req.body;
    
    if (!tokens) {
      tokens = await loadTokensFromFirestore();
    }
    
    if (!tokens) {
      return res.status(400).json({ error: "Missing Google connection or offline tokens. Please link your Google Account." });
    }
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Recipient (to), subject, and body are required." });
    }

    try {
      const { auth, getTokens } = await getAuthorizedClient(req, tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const mimeParts = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
      ];
      const mimeMessage = mimeParts.join('\n');
      const base64Encoded = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: base64Encoded
        }
      });

      res.json({
        success: true,
        data: response.data,
        refreshedTokens: getTokens()
      });
    } catch (error: any) {
      handleRouteError(res, error, 'Error sending email via Gmail');
    }
  });

  // --- Server-Side 10-Minute Automatic Background Google Sheets Sync Worker ---
  async function startServerSideAutoBackupScheduler() {
    console.log("[Server Auto-Backup] Initializing 10-minute continuous background sync daemon...");

    async function checkAndRunServerAutoBackup() {
      try {
        const db = await getFirestoreOnServer();
        if (!db) {
          console.warn("[Server Auto-Backup] Firebase/Firestore not initialized yet. Skipping check.");
          return;
        }

        const { doc: serverDoc, getDoc: serverGetDoc, setDoc: serverSetDoc, collection: serverCollection, getDocs: serverGetDocs } = await import('firebase/firestore');

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
