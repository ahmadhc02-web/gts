const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const injectionPoint = '// --- Gemini API & AI Help Integration ---';

if (code.includes('// --- Registration OTP Endpoints ---')) {
  console.log('Already injected!');
  process.exit(0);
}

const newEndpoints = `
  // --- Registration OTP Endpoints ---
  app.post("/api/auth/send-registration-otp", async (req, res) => {
    try {
      const { email, fullName, username } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      const rawBrevo = process.env.BREVO_API_KEY;
      const BREVO_API_KEY = (rawBrevo ? rawBrevo.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '') : '') || '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';

      // 1. Generate a secure 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 2. Store the OTP in memory cache using email as key
      const key = email.trim().toLowerCase();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
      localOtpStore.set(key, {
        username: username || 'Registration',
        code: otpCode,
        email: email,
        expiresAt,
        verified: false
      });

      // 3. Send email via Brevo API
      let emailStatus = "simulated";
      let errorDetail = null;

      const subject = "GTS ISP Control Panel - Registration Verification Passcode";
      const emailHtml = \`
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b; max-width: 600px; margin: 0 auto; border-radius: 1rem; border: 1px solid #e2e8f0; border-top: 4px solid #10b981;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #0f172a; margin: 0; font-size: 1.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">GTS ISP SYSTEM</h1>
            <p style="color: #64748b; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">Node Registration Request</p>
          </div>
          <p style="font-size: 0.95rem; line-height: 1.6;">
            Hello \${fullName || username || 'User'},
          </p>
          <p style="font-size: 0.95rem; line-height: 1.6;">
            We received a request to register a new node with this email address.
            Please use the following verification code to confirm your email and submit the registration request to the Super Admin.
          </p>
          <div style="background-color: #f1f5f9; border-radius: 0.75rem; padding: 1.5rem; margin: 2rem 0; text-align: center; border: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; color: #64748b;">Verification Code</p>
            <h2 style="margin: 0; font-size: 2.25rem; font-weight: 950; letter-spacing: 0.2em; color: #10b981;">\${otpCode}</h2>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.7rem; color: #94a3b8;">Code expires in 10 minutes</p>
          </div>
          <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; line-height: 1.5; margin: 0;">
            Green Tech Services Support Registry &bull; Core Diagnostics Gateway<br />
            This transaction log consists of automated secure communications. Do not directly reply.
          </p>
        </div>
      \`;

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: {
              name: 'GREEN TECH SERVICES',
              email: 'greennet757@gmail.com'
            },
            to: [
              {
                email: email,
                name: fullName || username || 'New User'
              }
            ],
            subject: subject,
            htmlContent: emailHtml
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error('Brevo API Error: ' + JSON.stringify(errData));
        }
        emailStatus = "sent_brevo_api";
      } catch (err: any) {
        console.error("Brevo API sending failed:", err);
        errorDetail = err.message || String(err);
      }

      console.log("========================================");
      console.log(\`[REGISTRATION SECURITY MODULE - SERVER DEBUG ONLY]\`);
      console.log(\`User: \${username || 'N/A'}\`);
      console.log(\`Dest Email: \${email}\`);
      console.log(\`Generated OTP Registration Code: \${otpCode}\`);
      console.log("========================================");

      if (emailStatus !== "sent_brevo_api") {
        return res.status(400).json({
          error: \`Verification sending failed: \${errorDetail || "Brevo connection error."}. Please try again.\`
        });
      }

      res.json({ status: "ok", emailStatus, email });
    } catch (error: any) {
      console.error("send-registration-otp failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post("/api/auth/verify-registration-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required." });
      }

      const key = email.trim().toLowerCase();
      let otpData = localOtpStore.get(key);

      if (!otpData) {
        return res.status(400).json({ error: "No reset session matches this email. Please request a new code." });
      }

      if (String(otpData.code).trim() !== String(code).trim()) {
        return res.status(400).json({ error: "Incorrect verification passcode. Please test your checks and retry." });
      }

      if (Date.now() > otpData.expiresAt) {
        return res.status(400).json({ error: "The verification passcode has expired. Please request a new code." });
      }

      // Mark verified in memory cache
      otpData.verified = true;
      localOtpStore.set(key, otpData);

      res.json({ status: "ok", message: "Email successfully verified." });
    } catch (error: any) {
      console.error("verify-registration-otp failed:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

`;

code = code.replace(injectionPoint, newEndpoints + injectionPoint);
fs.writeFileSync('server.ts', code);
console.log('Endpoints injected!');
