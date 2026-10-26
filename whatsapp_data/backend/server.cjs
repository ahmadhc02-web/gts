require('dotenv').config();
// --- Security Hardening ---
// New Environment Variables:
// - ALLOW_INSECURE_TLS: Set to '1' to allow insecure TLS connections (NODE_TLS_REJECT_UNAUTHORIZED = "0")
if (process.env.ALLOW_INSECURE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[SECURITY WARNING] ALLOW_INSECURE_TLS is enabled. TLS certificate verification is disabled (NODE_TLS_REJECT_UNAUTHORIZED = 0).');
}

// --- Safety Guardrail Constants (overridable by env) ---
const WA_MAX_PER_RECIPIENT_HOUR = parseInt(process.env.WA_MAX_PER_RECIPIENT_HOUR || '10', 10);
const WA_MAX_PER_SESSION_HOUR = parseInt(process.env.WA_MAX_PER_SESSION_HOUR || '60', 10);
const WA_MAX_PER_SESSION_DAY = parseInt(process.env.WA_MAX_PER_SESSION_DAY || '250', 10);
const WA_MANUAL_MAX_LEN = parseInt(process.env.WA_MANUAL_MAX_LEN || '1000', 10);
const WA_STRICT_RECIPIENTS = process.env.WA_STRICT_RECIPIENTS !== undefined ? String(process.env.WA_STRICT_RECIPIENTS) : '1';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const ws = require('ws');
const { getBaileysStatus, getBaileysQr, sendMessage, initBaileys, autoRestoreAllSessions, logoutBaileys, resetBaileysSession, registerMessageLogCallback, normalizePakistaniPhone, initBaileysClientDb, markLeadStarted, releaseSubDealerSession } = require('./baileysClient.cjs');
const { createClient } = require('@supabase/supabase-js');

const WA_INTERNAL_KEY = process.env.WA_INTERNAL_KEY;
if (!WA_INTERNAL_KEY) {
  console.warn("WA_INTERNAL_KEY is not set: the internal key check is DISABLED (backend only listens on 127.0.0.1)");
}

let admin = null;
let firebaseApp = null;
const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");
if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require("firebase-admin");
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("[Firebase] Admin initialized successfully");
  } catch (e) {
    console.log("[Firebase] Service account found but initialization skipped:", e.message);
  }
} else {
  // Silent fallback when firebase-service-account.json is not present
  console.log("[Firebase] No firebase-service-account.json detected. Push notifications will use direct/fallback paths.");
}

const app = express();
const PORT = process.env.WHATSAPP_PORT || 3001;

// Setup Supabase with Node.js 20 Realtime WebSocket Transport Fix & Auth Headers
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://167.233.41.7.sslip.io';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  },
  realtime: {
    transport: ws,
  },
}) : null;

// Register Logging Callback to Supabase
if (supabase) {
  if (supabase) { initBaileysClientDb(supabase); }
registerMessageLogCallback(async (recipient, message, status, errorMessage) => {
    try {
      console.log(`[Database Log] Recipient: ${recipient}, Status: ${status}`);
      const { error } = await supabase
        .from('whatsapp_message_log')
        .insert({
          recipient,
          message,
          status,
          error_message: errorMessage,
          sent_at: new Date().toISOString()
        });
      if (error) {
        console.error('Error inserting log into whatsapp_message_log:', error);
      }
    } catch (e) {
      console.error('Exception during database logging:', e);
    }
  });
}

const { init: initLeadProcessor, processReminderLead, resumeInterruptedLeads, cancelReminderLead } = require('./leadProcessor.cjs');
if (supabase) {
  initLeadProcessor(supabase);
}

app.use(express.json());

// Require valid x-internal-key header on every incoming request
app.use((req, res, next) => {
  if (!WA_INTERNAL_KEY) {
    return next();
  }
  const clientKey = req.headers['x-internal-key'];
  if (!clientKey || typeof clientKey !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: missing x-internal-key header' });
  }
  const clientKeyBuf = Buffer.from(clientKey);
  const expectedKeyBuf = Buffer.from(WA_INTERNAL_KEY);
  if (clientKeyBuf.length !== expectedKeyBuf.length || !crypto.timingSafeEqual(clientKeyBuf, expectedKeyBuf)) {
    return res.status(401).json({ error: 'Unauthorized: invalid x-internal-key' });
  }
  next();
});

// In-memory rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
if (rateLimitCleanup.unref) {
  rateLimitCleanup.unref();
}

function rateLimitMiddleware(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress || req.ip || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Rate limit is 30 requests per minute per IP.' });
  }
  next();
}

const SESSION_KEY_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
function isValidSessionKey(key) {
  return typeof key === 'string' && SESSION_KEY_REGEX.test(key);
}

// Init Baileys and restore active multi-tenant sessions deferred until port is bound

app.get('/status', (req, res) => {
  const rawSession = req.query.session || req.query.dealerId || req.query.vlan;
  if (rawSession && !isValidSessionKey(String(rawSession))) {
    return res.status(400).json({ error: 'Invalid session key format' });
  }
  const sessionKey = rawSession ? String(rawSession) : 'main';
  res.json(getBaileysStatus(sessionKey));
});

app.get('/qr', async (req, res) => {
  const rawSession = req.query.session || req.query.dealerId || req.query.vlan;
  if (rawSession && !isValidSessionKey(String(rawSession))) {
    return res.status(400).json({ error: 'Invalid session key format' });
  }
  const sessionKey = rawSession ? String(rawSession) : 'main';
  const qrBase64 = await getBaileysQr(sessionKey);
  if (!qrBase64) {
    return res.json({ qr: null, session: sessionKey });
  }
  res.json({ qr: qrBase64, session: sessionKey });
});

app.post('/disconnect', async (req, res) => {
  const rawSession = req.body?.session || req.body?.dealerId || req.body?.vlan || req.query?.session;
  if (rawSession && !isValidSessionKey(String(rawSession))) {
    return res.status(400).json({ error: 'Invalid session key format' });
  }
  const sessionKey = rawSession ? String(rawSession) : 'main';
  await logoutBaileys(sessionKey);
  res.json({ success: true, session: sessionKey });
});

app.post('/reset-session', async (req, res) => {
  try {
    const rawSession = req.body?.session || req.body?.dealerId || req.body?.vlan || req.query?.session;
    if (rawSession && !isValidSessionKey(String(rawSession))) {
      return res.status(400).json({ error: 'Invalid session key format' });
    }
    const sessionKey = rawSession ? String(rawSession) : 'main';
    const result = await resetBaileysSession(sessionKey);
    res.json(result);
  } catch (err) {
    console.error('Failed to reset session:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to reset session' });
  }
});

app.post('/send-push', rateLimitMiddleware, async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;
    if (!firebaseApp || !admin) {
      return res.status(503).json({ success: false, error: 'Firebase not configured on server' });
    }
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid tokens' });
    }
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Missing title or body' });
    }
    if (typeof body === 'string' && body.length > 4096) {
      return res.status(400).json({ success: false, error: 'Message body must not exceed 4096 characters' });
    }

    const messagePayload = {
      notification: { title, body },
      data: data || {},
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(messagePayload);
    
    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map(r => ({ success: r.success, error: r.error ? r.error.message : null }))
    });
  } catch (err) {
    console.error('Failed to send push notifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- In-Memory Fallback & Tracking for Guardrails ---
let inMemorySentMessages = []; // { sessionKey, targetLast10, normalizedText, timestamp: number }

function recordSentInMemory({ sessionKey, targetLast10, text }) {
  const now = Date.now();
  const normalizedText = normalizeMessageForSpam(text);
  inMemorySentMessages.push({
    sessionKey,
    targetLast10,
    normalizedText,
    timestamp: now
  });
  if (inMemorySentMessages.length > 5000) {
    const cutoff = now - 24 * 3600 * 1000;
    inMemorySentMessages = inMemorySentMessages.filter(m => m.timestamp >= cutoff);
  }
}

function extractLast10Digits(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeMessageForSpam(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

const clientsCache = new Map(); // sessionKey -> { timestamp, numbersSet }
const CLIENT_CACHE_TTL = 30000; // 30 seconds

async function isRegisteredCustomer(phone, sessionKey) {
  if (WA_STRICT_RECIPIENTS === '0') return true;
  if (!supabase) return true;

  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (!phoneDigits) return false;
  const targetLast10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
  if (targetLast10.length < 10) return false;

  const now = Date.now();
  const cached = clientsCache.get(sessionKey);
  if (cached && (now - cached.timestamp < CLIENT_CACHE_TTL)) {
    return cached.numbersSet.has(targetLast10);
  }

  let query = supabase.from('clients').select('mobile_number, number, dealer_id, line_code');
  if (sessionKey === 'main') {
    query = query.or('dealer_id.eq.main,dealer_id.is.null,dealer_id.eq.');
  } else {
    query = query.or(`dealer_id.eq.${sessionKey},line_code.eq.${sessionKey}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[isRegisteredCustomer] Error querying clients table:', error);
    if (cached) return cached.numbersSet.has(targetLast10);
    return true; // Fail open on unexpected DB connection error
  }

  const numbersSet = new Set();
  if (Array.isArray(data)) {
    for (const row of data) {
      const m10 = extractLast10Digits(row.mobile_number);
      if (m10.length === 10) numbersSet.add(m10);
      const n10 = extractLast10Digits(row.number);
      if (n10.length === 10) numbersSet.add(n10);
    }
  }

  clientsCache.set(sessionKey, { timestamp: now, numbersSet });
  return numbersSet.has(targetLast10);
}

async function checkLimits({ sessionKey, targetLast10 }) {
  const now = Date.now();
  const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 3600 * 1000).toISOString();

  let recipientHourCount = 0;
  let sessionHourCount = 0;
  let sessionDayCount = 0;
  let usedDb = false;

  if (supabase) {
    try {
      const [recRes, sessHourRes, sessDayRes] = await Promise.all([
        supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .eq('session_key', sessionKey)
          .eq('direction', 'out')
          .eq('status', 'sent')
          .is('lead_id', null)
          .ilike('phone', `%${targetLast10}`)
          .gte('created_at', oneHourAgo),
        supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .eq('session_key', sessionKey)
          .eq('direction', 'out')
          .eq('status', 'sent')
          .is('lead_id', null)
          .gte('created_at', oneHourAgo),
        supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .eq('session_key', sessionKey)
          .eq('direction', 'out')
          .eq('status', 'sent')
          .is('lead_id', null)
          .gte('created_at', oneDayAgo),
      ]);

      if (!recRes.error && !sessHourRes.error && !sessDayRes.error) {
        recipientHourCount = recRes.count || 0;
        sessionHourCount = sessHourRes.count || 0;
        sessionDayCount = sessDayRes.count || 0;
        usedDb = true;
      }
    } catch (err) {
      console.warn('[checkLimits] Database count error, falling back to in-memory:', err.message);
    }
  }

  if (!usedDb) {
    const oneHourCutoff = now - 3600 * 1000;
    const oneDayCutoff = now - 24 * 3600 * 1000;
    recipientHourCount = inMemorySentMessages.filter(
      m => m.sessionKey === sessionKey && m.targetLast10 === targetLast10 && m.timestamp >= oneHourCutoff
    ).length;
    sessionHourCount = inMemorySentMessages.filter(
      m => m.sessionKey === sessionKey && m.timestamp >= oneHourCutoff
    ).length;
    sessionDayCount = inMemorySentMessages.filter(
      m => m.sessionKey === sessionKey && m.timestamp >= oneDayCutoff
    ).length;
  }

  // Also include any very recent in-memory items that might still be in-flight
  const oneHourCutoff = now - 3600 * 1000;
  const oneDayCutoff = now - 24 * 3600 * 1000;
  const recentMemRec = inMemorySentMessages.filter(
    m => m.sessionKey === sessionKey && m.targetLast10 === targetLast10 && m.timestamp >= oneHourCutoff
  ).length;
  const recentMemSessHour = inMemorySentMessages.filter(
    m => m.sessionKey === sessionKey && m.timestamp >= oneHourCutoff
  ).length;
  const recentMemSessDay = inMemorySentMessages.filter(
    m => m.sessionKey === sessionKey && m.timestamp >= oneDayCutoff
  ).length;

  recipientHourCount = Math.max(recipientHourCount, recentMemRec);
  sessionHourCount = Math.max(sessionHourCount, recentMemSessHour);
  sessionDayCount = Math.max(sessionDayCount, recentMemSessDay);

  if (recipientHourCount >= WA_MAX_PER_RECIPIENT_HOUR) {
    return {
      allowed: false,
      error: `Hourly limit of ${WA_MAX_PER_RECIPIENT_HOUR} messages reached for this recipient`,
      retryAfterSeconds: 3600
    };
  }

  if (sessionHourCount >= WA_MAX_PER_SESSION_HOUR) {
    return {
      allowed: false,
      error: `Hourly limit of ${WA_MAX_PER_SESSION_HOUR} messages reached for this session`,
      retryAfterSeconds: 3600
    };
  }

  if (sessionDayCount >= WA_MAX_PER_SESSION_DAY) {
    return {
      allowed: false,
      error: `Daily limit of ${WA_MAX_PER_SESSION_DAY} messages reached for this session`,
      retryAfterSeconds: 86400
    };
  }

  return { allowed: true };
}

async function checkSpamPattern({ sessionKey, text }) {
  const normalizedText = normalizeMessageForSpam(text);
  if (!normalizedText) return { allowed: true };

  const now = Date.now();
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();
  const uniqueRecipients = new Set();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('phone, body')
        .eq('session_key', sessionKey)
        .eq('direction', 'out')
        .eq('status', 'sent')
        .gte('created_at', fifteenMinutesAgo);

      if (!error && Array.isArray(data)) {
        for (const msg of data) {
          if (normalizeMessageForSpam(msg.body) === normalizedText) {
            const p10 = extractLast10Digits(msg.phone);
            if (p10) uniqueRecipients.add(p10);
          }
        }
      }
    } catch (err) {
      console.warn('[checkSpamPattern] Database error, falling back to memory:', err.message);
    }
  }

  const fifteenMinCutoff = now - 15 * 60 * 1000;
  for (const msg of inMemorySentMessages) {
    if (msg.sessionKey === sessionKey && msg.timestamp >= fifteenMinCutoff) {
      if (msg.normalizedText === normalizedText && msg.targetLast10) {
        uniqueRecipients.add(msg.targetLast10);
      }
    }
  }

  if (uniqueRecipients.size >= 3) {
    return { allowed: false };
  }

  return { allowed: true };
}

app.get('/send-usage', async (req, res) => {
  try {
    const rawSession = req.query.session || req.query.dealerId || req.query.vlan;
    const sessionKey = rawSession ? String(rawSession) : 'main';

    const now = Date.now();
    const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
    const oneDayAgo = new Date(now - 24 * 3600 * 1000).toISOString();

    let hourCount = 0;
    let dayCount = 0;

    if (supabase) {
      try {
        const [hourRes, dayRes] = await Promise.all([
          supabase
            .from('whatsapp_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_key', sessionKey)
            .eq('direction', 'out')
            .eq('status', 'sent')
            .is('lead_id', null)
            .gte('created_at', oneHourAgo),
          supabase
            .from('whatsapp_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_key', sessionKey)
            .eq('direction', 'out')
            .eq('status', 'sent')
            .is('lead_id', null)
            .gte('created_at', oneDayAgo)
        ]);

        if (!hourRes.error && hourRes.count !== null && hourRes.count !== undefined) {
          hourCount = hourRes.count;
        }
        if (!dayRes.error && dayRes.count !== null && dayRes.count !== undefined) {
          dayCount = dayRes.count;
        }
      } catch (dbErr) {
        console.warn('[send-usage] Error querying Supabase, using in-memory count:', dbErr);
        hourCount = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && (now - m.timestamp < 3600 * 1000)).length;
        dayCount = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && (now - m.timestamp < 24 * 3600 * 1000)).length;
      }
    } else {
      hourCount = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && (now - m.timestamp < 3600 * 1000)).length;
      dayCount = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && (now - m.timestamp < 24 * 3600 * 1000)).length;
    }

    const oneHourCutoff = now - 3600 * 1000;
    const oneDayCutoff = now - 24 * 3600 * 1000;
    const memHour = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && m.timestamp >= oneHourCutoff).length;
    const memDay = inMemorySentMessages.filter(m => m.sessionKey === sessionKey && m.timestamp >= oneDayCutoff).length;

    hourCount = Math.max(hourCount, memHour);
    dayCount = Math.max(dayCount, memDay);

    return res.json({
      hour: hourCount,
      hourLimit: WA_MAX_PER_SESSION_HOUR,
      day: dayCount,
      dayLimit: WA_MAX_PER_SESSION_DAY
    });
  } catch (err) {
    console.error('Error fetching send usage:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch send usage' });
  }
});

app.post('/send-message', rateLimitMiddleware, async (req, res) => {
  try {
    const { phone, message, session, dealerId, vlan, meta } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    const rawSession = session || dealerId || vlan;
    if (rawSession && !isValidSessionKey(String(rawSession))) {
      return res.status(400).json({ success: false, error: 'Invalid session key format' });
    }
    const sessionKey = rawSession ? String(rawSession) : 'main';

    let optionsMeta = undefined;
    let kind = 'other';
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const allowedKinds = ['reminder', 'complaint', 'campaign', 'manual', 'other'];
      const rawKind = typeof meta.kind === 'string' ? meta.kind.trim().toLowerCase() : '';
      kind = allowedKinds.includes(rawKind) ? rawKind : 'other';
      const cleanString = (val) => (typeof val === 'string' ? val.trim().slice(0, 120) : undefined);

      optionsMeta = {
        kind,
        clientName: cleanString(meta.clientName || meta.client_name),
        clientUsername: cleanString(meta.clientUsername || meta.client_username),
        leadId: cleanString(meta.leadId || meta.lead_id),
        dealerId: cleanString(dealerId || meta.dealerId || meta.dealer_id),
      };
    }

    // 4) For kind 'manual': trim, remove control characters, max WA_MANUAL_MAX_LEN characters, at most 2 links (http/https), not empty
    let messageToSend = message;
    if (kind === 'manual') {
      const cleanMessage = String(message).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
      if (!cleanMessage) {
        return res.status(400).json({ success: false, error: "Message cannot be empty" });
      }
      if (cleanMessage.length > WA_MANUAL_MAX_LEN) {
        return res.status(400).json({
          success: false,
          error: `Message exceeds maximum allowed length of ${WA_MANUAL_MAX_LEN} characters`
        });
      }
      const links = cleanMessage.match(/https?:\/\/[^\s]+/gi) || [];
      if (links.length > 2) {
        return res.status(400).json({
          success: false,
          error: "Manual message cannot contain more than 2 links"
        });
      }
      messageToSend = cleanMessage;
    } else {
      if (typeof messageToSend !== 'string' || messageToSend.length > 4096) {
        return res.status(400).json({ success: false, error: 'Message must not exceed 4096 characters' });
      }
    }

    // 1) Registered customers only (all kinds sent through /send-message)
    const phoneDigits = String(phone).replace(/\D/g, '');
    const targetLast10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    if (WA_STRICT_RECIPIENTS !== '0') {
      const isRegistered = await isRegisteredCustomer(phone, sessionKey);
      if (!isRegistered) {
        return res.status(400).json({ success: false, error: "This number is not a registered customer" });
      }
    }

    // 2) Limits counted from whatsapp_messages table
    const limitCheck = await checkLimits({ sessionKey, targetLast10 });
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: limitCheck.error,
        retryAfterSeconds: limitCheck.retryAfterSeconds
      });
    }

    // 3) Spam-pattern guard (applies to kind 'manual' only)
    if (kind === 'manual') {
      const spamCheck = await checkSpamPattern({ sessionKey, text: messageToSend });
      if (!spamCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: "Same message to many customers is blocked, please personalise it"
        });
      }
    }

    const normalizedPhone = normalizePakistaniPhone(phone);
    const result = await sendMessage(normalizedPhone, messageToSend, { meta: optionsMeta }, sessionKey);
    if (result.success) {
      recordSentInMemory({ sessionKey, targetLast10, text: messageToSend });
      res.json({ success: true, session: sessionKey });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to send message' });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/create-lead', rateLimitMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { name, dealerId, lineCode, monthId, dueDateStart, dueDateEnd, waitSeconds, items } = req.body;
    if (dealerId && !isValidSessionKey(String(dealerId))) {
      return res.status(400).json({ error: 'Invalid dealerId format' });
    }
    if (lineCode && !isValidSessionKey(String(lineCode))) {
      return res.status(400).json({ error: 'Invalid lineCode format' });
    }
    const rawWait = waitSeconds !== undefined ? waitSeconds : req.body.wait_seconds;
    if (rawWait !== undefined && rawWait !== null && rawWait !== '') {
      const parsedWait = Number(rawWait);
      if (typeof rawWait === 'boolean' || isNaN(parsedWait) || !Number.isFinite(parsedWait)) {
        return res.status(400).json({ error: 'wait_seconds must be numeric' });
      }
    }
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item.message === 'string' && item.message.length > 4096) {
          return res.status(400).json({ error: 'Lead item message must not exceed 4096 characters' });
        }
      }
    }
    
    // 1. Insert lead using Service Role client (bypasses RLS)
    const { data: leadRow, error: leadErr } = await supabase
      .from('reminder_leads')
      .insert({
        name: name || 'Reminder Lead',
        dealer_id: dealerId || 'main',
        line_code: lineCode || null,
        month_id: monthId,
        due_date_start: dueDateStart,
        due_date_end: dueDateEnd,
        wait_seconds: Math.min(300, Math.max(60, Number(rawWait || 60))),
        status: 'pending',
        total_count: Array.isArray(items) ? items.length : 0,
        success_count: 0,
        failed_count: 0
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    const leadId = leadRow.id;

    // 2. Insert lead items
    if (Array.isArray(items) && items.length > 0) {
      const itemRows = items.map((item, idx) => ({
        lead_id: leadId,
        client_id: String(item.username || item.clientId || ''),
        name: String(item.name || ''),
        mobile_number: String(item.mobileNumber || ''),
        message: item.message || null,
        status: 'pending',
        sort_order: idx
      }));

      const { error: itemsErr } = await supabase
        .from('reminder_lead_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;
    }

    res.json({ success: true, leadId });
  } catch (err) {
    console.error('Failed to create lead on server:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/start-lead', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured on WhatsApp backend' });
  try {
    const { data: lead } = await supabase.from('reminder_leads').select('line_code, dealer_id').eq('id', leadId).single();
    if (lead) {
      const sessionKey = lead.line_code || lead.dealer_id || 'main';
      markLeadStarted(sessionKey);
    }
  } catch (e) {}
  // Fire-and-forget: respond immediately, keep processing in background
  processReminderLead(leadId).catch(err => console.error('[Server] Lead processing error:', err));
  res.json({ started: true, leadId });
});

app.post('/delete-lead', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });
  try {
    let sessionKey = 'main';
    if (supabase) {
      const { data: leadRow } = await supabase.from('reminder_leads').select('line_code, dealer_id').eq('id', leadId).single();
      if (leadRow) {
        sessionKey = leadRow.line_code || leadRow.dealer_id || 'main';
      }
    }
    if (typeof cancelReminderLead === 'function') {
      cancelReminderLead(leadId);
    }
    if (supabase) {
      await supabase.from('reminder_lead_items').delete().eq('lead_id', leadId);
      await supabase.from('reminder_leads').delete().eq('id', leadId);
    }
    if (sessionKey && sessionKey !== 'main') {
      releaseSubDealerSession(sessionKey).catch(err => console.error('Release session error:', err));
    }
    res.json({ success: true, deleted: true, leadId });
  } catch (err) {
    console.error('Failed to delete lead on server:', err);
    res.status(500).json({ error: err.message });
  }
});

const TEMPLATES_FILE = path.join(__dirname, 'templates.json');

function readLocalTemplates() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const content = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('[Server] Error reading local templates.json:', e);
  }
  return null;
}

function writeLocalTemplates(data) {
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Server] Error writing local templates.json:', e);
  }
}

app.get('/template', async (req, res) => {
  const localData = readLocalTemplates();
  let dbData = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('branding_config')
        .select('*')
        .eq('config_type', 'whatsapp_templates')
        .limit(1);

      if (data && data.length > 0 && data[0].branding_data) {
        const parsed = typeof data[0].branding_data === 'string' ? JSON.parse(data[0].branding_data) : data[0].branding_data;
        if (parsed && (parsed.template || parsed.message_template)) {
          dbData = {
            message_template: parsed.template || parsed.message_template,
            complaint_registered_template: parsed.complaintRegisteredTemplate || parsed.complaint_registered_template,
            complaint_completed_template: parsed.complaintCompletedTemplate || parsed.complaint_completed_template,
            complaint_completed_status_value: parsed.completedStatusValue || parsed.complaint_completed_status_value
          };
        }
      }
    } catch (_) {}

    if (!dbData) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_settings')
          .select('message_template, complaint_registered_template, complaint_completed_template, complaint_completed_status_value')
          .eq('id', 'main')
          .single();

        if (!error && data) {
          dbData = data;
        }
      } catch (err) {
        console.warn('[Server] Supabase get template warning (using fallback):', err.message);
      }
    }
  }

  // Default fallback
  const template = dbData?.message_template || localData?.template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';
  const complaintRegisteredTemplate = dbData?.complaint_registered_template || localData?.complaintRegisteredTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.';
  const complaintCompletedTemplate = dbData?.complaint_completed_template || localData?.complaintCompletedTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.';
  const completedStatusValue = dbData?.complaint_completed_status_value || localData?.completedStatusValue || 'Resolved';

  res.json({ template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue });
});

app.post('/template', async (req, res) => {
  try {
    const { template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue } = req.body;
    
    const existingLocal = readLocalTemplates() || {};
    const localToSave = {
      template: template !== undefined ? template : (existingLocal.template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.'),
      complaintRegisteredTemplate: complaintRegisteredTemplate !== undefined ? complaintRegisteredTemplate : (existingLocal.complaintRegisteredTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.'),
      complaintCompletedTemplate: complaintCompletedTemplate !== undefined ? complaintCompletedTemplate : (existingLocal.complaintCompletedTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.'),
      completedStatusValue: completedStatusValue !== undefined ? completedStatusValue : (existingLocal.completedStatusValue || 'Resolved'),
      updated_at: new Date().toISOString()
    };

    // Always persist to local disk first
    writeLocalTemplates(localToSave);

    if (supabase) {
      try {
        await supabase
          .from('branding_config')
          .upsert({
            config_type: 'whatsapp_templates',
            branding_data: JSON.stringify(localToSave),
            updated_at: localToSave.updated_at
          }, { onConflict: 'config_type' });
      } catch (_) {}

      try {
        const updateData = {
          id: 'main',
          message_template: localToSave.template,
          complaint_registered_template: localToSave.complaintRegisteredTemplate,
          complaint_completed_template: localToSave.complaintCompletedTemplate,
          complaint_completed_status_value: localToSave.completedStatusValue,
          updated_at: localToSave.updated_at
        };

        const { error } = await supabase
          .from('whatsapp_settings')
          .upsert(updateData);

        if (error) {
          console.warn('[Server] Supabase save warning (fallback saved locally):', error.message);
        }
      } catch (dbErr) {
        console.warn('[Server] Supabase upsert error (saved locally):', dbErr.message);
      }
    }

    res.json({ success: true, template: localToSave.template });
  } catch (err) {
    console.error('Save template error:', err);
    res.json({ success: true, warning: err.message });
  }
});

const server = app.listen(PORT, '127.0.0.1', () => {
  autoRestoreAllSessions();
  console.log(`WhatsApp Baileys service listening on 127.0.0.1:${PORT}`);
  // Resume any interrupted running leads after Baileys has initialized
  setTimeout(() => {
    if (supabase) {
      resumeInterruptedLeads();
    }
  }, 15000);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[WhatsApp Service] Port ${PORT} already in use, another instance is running. Exiting.`);
    process.exit(1);
  }
  console.warn(`[WhatsApp Service] Port ${PORT} listen notice:`, err.message);
});