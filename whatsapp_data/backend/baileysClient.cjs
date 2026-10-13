const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.makeWASocket || baileys.default;
const { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = baileys;
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

function normalizePakistaniPhone(phone) {
  if (!phone) return phone;
  let normalized = String(phone).replace(/[\s-]/g, '');
  if (normalized.startsWith('0')) {
    normalized = '92' + normalized.substring(1);
  } else if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  } else if (normalized.startsWith('3')) {
    normalized = '92' + normalized;
  }
  return normalized;
}

function normalizeSessionKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return 'main';
  const trimmed = rawKey.trim().toLowerCase();
  if (!trimmed || trimmed === 'main' || trimmed === 'default' || trimmed === 'global' || trimmed === 'all') {
    return 'main';
  }
  return trimmed.replace(/[^a-z0-9_-]/g, '_');
}

// Global Logging Callback
let messageLogCallback = null;
function registerMessageLogCallback(callback) {
  messageLogCallback = callback;
}

// Multi-Tenant Session Map
const sessions = new Map();

const sentMessageStore = new Map();
const SENT_STORE_MAX = 1000;
function rememberSent(sentMsg) {
  try {
    const id = sentMsg?.key?.id;
    if (!id || !sentMsg.message) return;
    sentMessageStore.set(id, sentMsg.message);
    if (sentMessageStore.size > SENT_STORE_MAX) {
      sentMessageStore.delete(sentMessageStore.keys().next().value);
    }
  } catch (_) {}
}

function getSession(rawKey = 'main', createIfMissing = true) {
  const key = normalizeSessionKey(rawKey);
  let session = sessions.get(key);
  if (!session && createIfMissing) {
    const authFolder = key === 'main' ? 'auth_session' : `auth_session_${key}`;
    const authDir = path.join(__dirname, authFolder);
    session = {
      key,
      authDir,
      sock: null,
      currentQr: null,
      isConnected: false,
      userPhoneNumber: null,
      reconnectDelay: 3000,
      reconnectTimer: null,
      resetBackoffTimer: null,
      lastConnectionOpenTimestamp: 0,
      lastActivityTimestamp: Date.now(),
      isReconnectPending: false,
      keepAliveTimer: null,
      consecutiveBadSessionCount: 0,
      proactiveRefreshTimer: null,
      messageQueue: [],
      isProcessingQueue: false,
      sentTimestamps: []
    };
    sessions.set(key, session);
  }
  return session;
}

function startKeepAlive(session) {
  if (session.keepAliveTimer) clearInterval(session.keepAliveTimer);
  session.keepAliveTimer = setInterval(async () => {
    if (session.isConnected && session.sock) {
      try {
        await session.sock.sendPresenceUpdate('available');
        session.lastActivityTimestamp = Date.now();
      } catch (e) {
        console.log(`[Keep-Alive (${session.key})] Presence ping failed:`, e.message);
      }
    }
  }, 3 * 60 * 1000);
}

function stopKeepAlive(session) {
  if (session.keepAliveTimer) clearInterval(session.keepAliveTimer);
  session.keepAliveTimer = null;
}

const PROACTIVE_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 mins
function startProactiveRefresh(session) {
  if (session.proactiveRefreshTimer) clearInterval(session.proactiveRefreshTimer);
  session.proactiveRefreshTimer = setInterval(() => {
    if (session.isConnected && session.messageQueue.length === 0 && !session.isProcessingQueue) {
      console.log(`[Proactive Refresh (${session.key})] Refreshing socket to prevent stale connection...`);
      session.isConnected = false;
      initBaileys(session.key);
    }
  }, PROACTIVE_REFRESH_INTERVAL_MS);
}

function stopProactiveRefresh(session) {
  if (session.proactiveRefreshTimer) clearInterval(session.proactiveRefreshTimer);
  session.proactiveRefreshTimer = null;
}

async function initBaileys(rawKey = 'main') {
  const session = getSession(rawKey);
  try {
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners();
        session.sock.end(new Error(`Reinitializing connection for session ${session.key}`));
      } catch (e) {
        console.log(`[${session.key}] Closing previous socket (safe):`, e.message);
      }
      session.sock = null;
    }

    console.log(`[Baileys Multi-Tenant] Initializing session "${session.key}" at ${session.authDir}...`);
    if (!fs.existsSync(session.authDir)) {
      fs.mkdirSync(session.authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(session.authDir);
    const logger = pino({ level: 'silent' });

    let waVersion;
    try {
      const v = await fetchLatestBaileysVersion();
      waVersion = v.version;
      console.log(`[${session.key}] Using WhatsApp Web version ${waVersion.join('.')}`);
    } catch (e) {
      console.log(`[${session.key}] Could not fetch latest WA version, using built-in default:`, e.message);
    }

    session.sock = makeWASocket({
      ...(waVersion ? { version: waVersion } : {}),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => sentMessageStore.get(key.id),
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    session.sock.ev.on('creds.update', saveCreds);

    session.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.currentQr = qr;
        console.log(`[${session.key}] QR Code generated. Ready to scan.`);
      }

      if (connection === 'close') {
        stopKeepAlive(session);
        stopProactiveRefresh(session);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isDefinitiveLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const isPossibleBadSession = statusCode === DisconnectReason.badSession || statusCode === 500 || statusCode === 403;
        console.log(`[${session.key}] Connection closed. StatusCode: ${statusCode}. Logout: ${isDefinitiveLogout}`);

        session.isConnected = false;
        session.userPhoneNumber = null;

        if (isDefinitiveLogout) {
          console.log(`[${session.key}] Logged out. Clearing auth and preparing fresh QR...`);
          session.consecutiveBadSessionCount = 0;
          session.reconnectDelay = 3000;
          session.isReconnectPending = false;
          if (fs.existsSync(session.authDir)) {
            try {
              fs.rmSync(session.authDir, { recursive: true, force: true });
            } catch (rmErr) {
              console.warn(`[${session.key}] Failed to clear auth folder:`, rmErr.message);
            }
          }
          session.currentQr = null;
          initBaileys(session.key);
        } else if (isPossibleBadSession) {
          session.consecutiveBadSessionCount++;
          if (session.consecutiveBadSessionCount >= 3) {
            console.log(`[${session.key}] Bad session repeated 3x. Wiping folder and re-initializing...`);
            session.consecutiveBadSessionCount = 0;
            session.reconnectDelay = 3000;
            session.isReconnectPending = false;
            if (fs.existsSync(session.authDir)) {
              try {
                fs.rmSync(session.authDir, { recursive: true, force: true });
              } catch (rmErr) {}
            }
            session.currentQr = null;
            initBaileys(session.key);
          } else {
            handleReconnect(session);
          }
        } else {
          handleReconnect(session);
        }
      } else if (connection === 'open') {
        console.log(`[${session.key}] Opened WhatsApp connection successfully!`);
        session.isConnected = true;
        if (session.key !== 'main') {
          const existingLease = sessionLeases.get(session.key);
          if (existingLease && existingLease.timer) clearTimeout(existingLease.timer);
          const expiresAt = Date.now() + 5 * 60 * 1000;
          const timer = setTimeout(async () => {
            const l = sessionLeases.get(session.key);
            if (l && !l.leadActive) {
              await releaseSubDealerSession(session.key);
            }
          }, 5 * 60 * 1000);
          sessionLeases.set(session.key, { expiresAt, timer, leadActive: false });
        }
        session.consecutiveBadSessionCount = 0;
        session.currentQr = null;
        session.lastConnectionOpenTimestamp = Date.now();
        session.lastActivityTimestamp = Date.now();

        if (session.sock?.user?.id) {
          session.userPhoneNumber = session.sock.user.id.split(':')[0];
          console.log(`[${session.key}] Phone Number linked: +${session.userPhoneNumber}`);
        }

        startKeepAlive(session);
        // Proactive refresh disabled on purpose: tearing down a healthy socket every 15 minutes corrupts Signal session state

        if (session.resetBackoffTimer) clearTimeout(session.resetBackoffTimer);
        session.resetBackoffTimer = setTimeout(() => {
          if (session.isConnected) {
            session.reconnectDelay = 3000;
            session.isReconnectPending = false;
          }
        }, 120000);

        setTimeout(() => {
          processQueue(session);
        }, 3000);
      }
    });

  } catch (error) {
    console.error(`[${session.key}] Error initializing Baileys:`, error);
    handleReconnect(session);
  }
}

function handleReconnect(session) {
  if (session.isReconnectPending) return;
  session.isReconnectPending = true;
  console.log(`[${session.key}] Scheduling reconnect in ${session.reconnectDelay / 1000}s...`);
  session.reconnectTimer = setTimeout(() => {
    session.isReconnectPending = false;
    session.reconnectDelay = Math.min(session.reconnectDelay * 2, 60000);
    initBaileys(session.key);
  }, session.reconnectDelay);
}


const sessionLeases = new Map();
let supabaseClient = null;

function initBaileysClientDb(sup) {
  supabaseClient = sup;
}

function markLeadStarted(rawKey) {
  const sessionKey = normalizeSessionKey(rawKey);
  if (sessionKey === 'main') return;
  const lease = sessionLeases.get(sessionKey);
  if (lease) {
    lease.leadActive = true;
    if (lease.timer) {
      clearTimeout(lease.timer);
      lease.timer = null;
    }
  } else {
    sessionLeases.set(sessionKey, { expiresAt: Date.now(), timer: null, leadActive: true });
  }
}

async function releaseSubDealerSession(rawKey) {
  const sessionKey = normalizeSessionKey(rawKey);
  if (!sessionKey || sessionKey === 'main') return;
  if (supabaseClient) {
    try {
      const { data: runningLeads } = await supabaseClient
        .from('reminder_leads')
        .select('id')
        .eq('status', 'running')
        .or('line_code.eq.' + sessionKey + ',dealer_id.eq.' + sessionKey);
      if (runningLeads && runningLeads.length > 0) {
        console.log('[' + sessionKey + '] releaseSubDealerSession: other running leads exist, skipping auto-disconnect.');
        return;
      }
    } catch (e) {
      console.warn('[' + sessionKey + '] releaseSubDealerSession running leads check error:', e.message);
    }
  }
  console.log('[' + sessionKey + '] Auto-disconnecting sub-dealer session to free server and generating fresh QR...');
  const lease = sessionLeases.get(sessionKey);
  if (lease && lease.timer) {
    clearTimeout(lease.timer);
  }
  sessionLeases.delete(sessionKey);
  await resetBaileysSession(sessionKey);
}

function getBaileysStatus(rawKey = 'main') {
  const sessionKey = normalizeSessionKey(rawKey);
  const session = getSession(sessionKey, false);
  const lease = sessionLeases.get(sessionKey);
  const leaseRemainingMs = (sessionKey === 'main' || !lease || lease.leadActive) ? null : Math.max(0, lease.expiresAt - Date.now());
  return {
    session: sessionKey,
    connected: session ? session.isConnected : false,
    phoneNumber: session ? session.userPhoneNumber : null,
    rateLimitReached: false,
    queuedCount: session ? session.messageQueue.length : 0,
    leaseRemainingMs
  };
}

async function getBaileysQr(rawKey = 'main') {
  const session = getSession(rawKey, true);
  if (session.isConnected) return null;
  if (!session.currentQr) {
    if (!session.sock && !session.isReconnectPending) {
      console.log(`[${session.key}] No socket or QR found, starting fresh session...`);
      initBaileys(session.key);
    }
    return null;
  }
  try {
    const dataUrl = await QRCode.toDataURL(session.currentQr);
    return dataUrl;
  } catch (err) {
    console.error(`[${session.key}] Error generating QR code:`, err);
    return null;
  }
}

const MAX_SEND_ATTEMPTS = 3;
const SEND_TIMEOUT_MS = 65000;
const RECONNECT_WAIT_TIMEOUT_MS = 60000;

function waitForReconnect(session, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (session.isConnected && session.sock) return resolve();
    const checkInterval = setInterval(() => {
      if (session.isConnected && session.sock) {
        clearInterval(checkInterval);
        clearTimeout(timer);
        resolve();
      }
    }, 500);
    const timer = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Timed out waiting for reconnect on session ${session.key}`));
    }, timeoutMs);
  });
}

async function sendWithRetry(session, phoneNumber, message) {
  const jid = `${phoneNumber}@s.whatsapp.net`;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      if (!session.isConnected || !session.sock) {
        console.log(`[${session.key}] Attempt ${attempt}: not connected, waiting for reconnect...`);
        handleReconnect(session);
        await waitForReconnect(session, RECONNECT_WAIT_TIMEOUT_MS);
        await new Promise(r => setTimeout(r, 3000));
      }

      await Promise.race([
        session.sock.sendPresenceUpdate('available'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Liveness ping timed out')), 10000))
      ]);

      if (session.sock && typeof session.sock.onWhatsApp === 'function') {
        try {
          const waCheck = await Promise.race([
            session.sock.onWhatsApp(jid),
            new Promise((_, rej) => setTimeout(() => rej(new Error('onWhatsApp check timed out')), 6000))
          ]);
          if (Array.isArray(waCheck)) {
            const isRegistered = waCheck.length > 0 && waCheck[0]?.exists !== false;
            if (!isRegistered) {
              const noWaErr = new Error('Number is not registered on WhatsApp');
              noWaErr.isNotOnWhatsApp = true;
              throw noWaErr;
            }
          }
        } catch (checkErr) {
          if (checkErr.isNotOnWhatsApp) throw checkErr;
        }
      }

      const sent = await Promise.race([
        session.sock.sendMessage(jid, { text: message }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Send timed out')), SEND_TIMEOUT_MS))
      ]);
      rememberSent(sent);

      session.lastActivityTimestamp = Date.now();
      return { success: true };
    } catch (err) {
      lastError = err;
      console.log(`[${session.key}] Send attempt ${attempt}/${MAX_SEND_ATTEMPTS} to ${phoneNumber} failed: ${err.message}`);
      if (err.isNotOnWhatsApp) {
        break;
      }
      session.isConnected = false;
      handleReconnect(session);
      if (attempt < MAX_SEND_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError || new Error(`Failed to send after retries on session ${session.key}`);
}

async function processQueue(session) {
  if (session.isProcessingQueue) return;
  session.isProcessingQueue = true;

  let disconnectedChecks = 0;
  while (session.messageQueue.length > 0) {
    if (!session.isConnected || !session.sock) {
      disconnectedChecks++;
      if (disconnectedChecks > 6) {
        console.warn(`[${session.key}] Queue aborted: WhatsApp session is not connected. Failing queued messages.`);
        const connErr = new Error(`WhatsApp is not connected for session "${session.key}". Please scan QR code first.`);
        while (session.messageQueue.length > 0) {
          const t = session.messageQueue.shift();
          if (messageLogCallback) messageLogCallback(t.phoneNumber, t.message, 'failed', connErr.message, session.key);
          t.reject(connErr);
        }
        break;
      }
      console.log(`[${session.key}] Queue waiting: session not connected (attempt ${disconnectedChecks}/6)...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    disconnectedChecks = 0;

    const task = session.messageQueue.shift();
    const { phoneNumber, message, resolve, reject } = task;

    const delayMs = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
    await new Promise(r => setTimeout(r, delayMs));

    try {
      await sendWithRetry(session, phoneNumber, message);
      session.sentTimestamps.push(Date.now());
      console.log(`[${session.key}] Successfully sent message to ${phoneNumber}`);
      if (messageLogCallback) messageLogCallback(phoneNumber, message, 'success', null, session.key);
      resolve({ success: true, session: session.key });
    } catch (err) {
      console.error(`[${session.key}] Giving up on message to ${phoneNumber}:`, err.message);
      if (messageLogCallback) messageLogCallback(phoneNumber, message, 'failed', err.message || 'Unknown error', session.key);
      reject(err);
    }
  }

  session.isProcessingQueue = false;
}

// Queue message for transmission
async function sendMessage(phoneNumber, message, options = {}, rawKey = 'main') {
  const session = getSession(rawKey, true);
  return new Promise((resolve, reject) => {
    session.messageQueue.push({ phoneNumber, message, resolve, reject });
    processQueue(session);
  });
}

async function logoutBaileys(rawKey = 'main') {
  const session = getSession(rawKey, false);
  if (!session) return;

  stopKeepAlive(session);
  stopProactiveRefresh(session);
  if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
  session.isReconnectPending = false;

  if (session.sock) {
    try {
      await session.sock.logout();
    } catch (e) {
      console.error(`[${session.key}] Logout error:`, e.message);
    }
  }

  if (fs.existsSync(session.authDir)) {
    try {
      fs.rmSync(session.authDir, { recursive: true, force: true });
      console.log(`[${session.key}] Cleared auth folder after logout.`);
    } catch (rmErr) {
      console.warn(`[${session.key}] Failed to delete auth folder:`, rmErr.message);
    }
  }

  session.currentQr = null;
  session.isConnected = false;
  session.isReconnectPending = false;
  session.userPhoneNumber = null;

  initBaileys(session.key);
}

async function resetBaileysSession(rawKey = 'main') {
  const session = getSession(rawKey, true);
  console.log(`[${session.key}] Manual session reset requested...`);
  stopKeepAlive(session);
  stopProactiveRefresh(session);
  if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
  session.isReconnectPending = false;

  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners();
      session.sock.end(new Error('Manual session reset'));
    } catch (e) {}
    session.sock = null;
  }

  if (fs.existsSync(session.authDir)) {
    try {
      fs.rmSync(session.authDir, { recursive: true, force: true });
      console.log(`[${session.key}] Cleared auth folder for reset.`);
    } catch (rmErr) {}
  }

  session.currentQr = null;
  session.isConnected = false;
  session.userPhoneNumber = null;
  session.reconnectDelay = 3000;

  await initBaileys(session.key);

  for (let i = 0; i < 10; i++) {
    if (session.currentQr) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const qrDataUrl = await getBaileysQr(session.key);
  return {
    success: true,
    session: session.key,
    qr: qrDataUrl,
    connected: session.isConnected,
  };
}

// Auto-restore any existing sessions on server boot
function autoRestoreAllSessions() {
  initBaileys('main');
  try {
    const entries = fs.readdirSync(__dirname);
    for (const item of entries) {
      if (item.startsWith('auth_session_') && fs.statSync(path.join(__dirname, item)).isDirectory()) {
        const sKey = item.replace(/^auth_session_/, '');
        if (sKey) {
          console.log(`[Baileys Multi-Tenant] Auto-restoring existing session: "${sKey}"`);
          initBaileys(sKey);
        }
      }
    }
  } catch (err) {
    console.warn('[Baileys Multi-Tenant] Warning auto-restoring sessions:', err.message);
  }
}

module.exports = {
  initBaileys,
  autoRestoreAllSessions,
  getBaileysStatus,
  getBaileysQr,
  sendMessage,
  logoutBaileys,
  resetBaileysSession,
  registerMessageLogCallback,
  normalizePakistaniPhone,
  normalizeSessionKey,
  initBaileysClientDb,
  markLeadStarted,
  releaseSubDealerSession,
};
