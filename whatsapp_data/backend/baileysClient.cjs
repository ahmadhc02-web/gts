const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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

let sock = null;
let currentQr = null;
let isConnected = false;
let userPhoneNumber = null;

// Reconnect/Backoff State
let reconnectDelay = 3000; // start with 3 seconds
let reconnectTimer = null;
let resetBackoffTimer = null;
let lastConnectionOpenTimestamp = 0;
let lastActivityTimestamp = Date.now();
let isReconnectPending = false;
let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    if (isConnected && sock) {
      try {
        await sock.sendPresenceUpdate('available');
        lastActivityTimestamp = Date.now();
      } catch (e) {
        console.log('Keep-alive presence ping failed:', e.message);
      }
    }
  }, 3 * 60 * 1000); // every 3 minutes
}

function stopKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

const PROACTIVE_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours
let proactiveRefreshTimer = null;

function startProactiveRefresh() {
  if (proactiveRefreshTimer) clearInterval(proactiveRefreshTimer);
  proactiveRefreshTimer = setInterval(() => {
    if (isConnected && messageQueue.length === 0 && !isProcessingQueue) {
      console.log('[Proactive Refresh] Refreshing WhatsApp connection to prevent long-uptime staleness...');
      isConnected = false;
      initBaileys();
    } else {
      console.log('[Proactive Refresh] Skipped — queue busy, will retry next interval.');
    }
  }, PROACTIVE_REFRESH_INTERVAL_MS);
}

function stopProactiveRefresh() {
  if (proactiveRefreshTimer) clearInterval(proactiveRefreshTimer);
  proactiveRefreshTimer = null;
}

// Message Queue State
const messageQueue = [];
let isProcessingQueue = false;
const sentTimestamps = []; // Slide window of sent messages

// Logging Callback
let messageLogCallback = null;

function registerMessageLogCallback(callback) {
  messageLogCallback = callback;
}

function getQueuedCount() {
  return messageQueue.length;
}

function isRateLimitReached() {
  return false; // Hourly message cap removed
}

async function initBaileys() {
  try {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end(new Error('Reinitializing connection'));
      } catch (e) {
        console.log('Error closing previous socket (safe to ignore):', e.message);
      }
      sock = null;
    }
    console.log('Initializing Baileys...');
    const authDir = path.join(__dirname, 'auth_session');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      defaultQueryTimeoutMs: 60000,   // explicit 60s
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,     // native WS ping every 25s
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        console.log('QR Code generated. Ready to scan.');
      }

      if (connection === 'close') {
        stopKeepAlive();
        stopProactiveRefresh();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = 
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.badSession ||
          statusCode === 401 ||
          statusCode === 403 ||
          statusCode === 500;
        console.log(`Connection closed. StatusCode: ${statusCode}. Logged out/Invalid: ${isLoggedOut}`);
        
        isConnected = false;
        userPhoneNumber = null;
        
        if (isLoggedOut) {
          console.log('Logged out or invalid session on WhatsApp. Clearing auth and preparing fresh QR...');
          reconnectDelay = 3000; // Reset backoff delay
          isReconnectPending = false;
          if (fs.existsSync(authDir)) {
            try {
              fs.rmSync(authDir, { recursive: true, force: true });
              console.log('Cleared stale auth_session folder.');
            } catch (rmErr) {
              console.warn('Failed to clear auth_session:', rmErr.message);
            }
          }
          currentQr = null;
          // Initialize fresh Baileys to immediately emit new QR code
          initBaileys();
        } else {
          // Transient network disconnect, apply exponential backoff reconnect
          handleReconnect();
        }
      } else if (connection === 'open') {
        console.log('Opened connection to WhatsApp');
        isConnected = true;
        currentQr = null;
        lastConnectionOpenTimestamp = Date.now();
        lastActivityTimestamp = Date.now();
        if (sock?.user?.id) {
          userPhoneNumber = sock.user.id.split(':')[0];
        }
        
        // Start keep-alive presence ping and proactive refresh
        startKeepAlive();
        startProactiveRefresh();

        // Reset backoff delay after 2 minutes of stable connection
        if (resetBackoffTimer) clearTimeout(resetBackoffTimer);
        resetBackoffTimer = setTimeout(() => {
          if (isConnected) {
            console.log('Connection stable. Resetting reconnect backoff delay to 3s.');
            reconnectDelay = 3000;
            isReconnectPending = false;
          }
        }, 120000); // 2 minutes stable

        // Trigger queue processor in case we have items waiting
        setTimeout(() => {
          console.log('[Connection Settle] Connection settled, resuming queue processing.');
          processQueue();
        }, 5000);
      }
    });

  } catch (error) {
    console.error('Error initializing Baileys:', error);
    handleReconnect();
  }
}

function handleReconnect() {
  if (isReconnectPending) {
    console.log('Reconnect already pending — not rescheduling.');
    return;
  }
  isReconnectPending = true;
  console.log(`Scheduling reconnect in ${reconnectDelay / 1000} seconds...`);
  reconnectTimer = setTimeout(() => {
    isReconnectPending = false;
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    initBaileys();
  }, reconnectDelay);
}

function getBaileysStatus() {
  return {
    connected: isConnected,
    phoneNumber: userPhoneNumber,
    rateLimitReached: isRateLimitReached(),
    queuedCount: getQueuedCount()
  };
}

async function getBaileysQr() {
  if (isConnected) return null;
  if (!currentQr) {
    // If not connected and no QR exists, ensure socket is initialized
    if (!sock && !isReconnectPending) {
      console.log('[QR Engine] No active socket or QR found, triggering fresh initialization...');
      initBaileys();
    }
    return null;
  }
  try {
    const dataUrl = await QRCode.toDataURL(currentQr);
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code data URL', err);
    return null;
  }
}

// Queue message for transmission
async function sendMessage(phoneNumber, message) {
  return new Promise((resolve, reject) => {
    messageQueue.push({ phoneNumber, message, resolve, reject });
    processQueue();
  });
}

const MAX_SEND_ATTEMPTS = 3;
const SEND_TIMEOUT_MS = 65000;
const RECONNECT_WAIT_TIMEOUT_MS = 60000; // max time to wait for reconnect

function waitForReconnect(timeoutMs) {
  return new Promise((resolve, reject) => {
    if (isConnected && sock) return resolve();
    const checkInterval = setInterval(() => {
      if (isConnected && sock) {
        clearInterval(checkInterval);
        clearTimeout(timer);
        resolve();
      }
    }, 500);
    const timer = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('Timed out waiting for reconnect'));
    }, timeoutMs);
  });
}

async function sendWithRetry(phoneNumber, message) {
  const jid = `${phoneNumber}@s.whatsapp.net`;
  let lastError = null;

  const STALE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes
  if (Date.now() - lastActivityTimestamp > STALE_THRESHOLD_MS) {
    console.log(`[Staleness Check] ${Math.round((Date.now() - lastActivityTimestamp) / 60000)} min since last activity — refreshing connection before sending.`);
    isConnected = false;
    handleReconnect();
    await waitForReconnect(RECONNECT_WAIT_TIMEOUT_MS);
    console.log('[Connection Settle] Waiting 4s for connection to stabilize after reconnect...');
    await new Promise(r => setTimeout(r, 4000));
    lastActivityTimestamp = Date.now();
  }

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      // Make sure we're connected before even trying
      if (!isConnected || !sock) {
        console.log(`Attempt ${attempt}: not connected, waiting for reconnect...`);
        handleReconnect();
        await waitForReconnect(RECONNECT_WAIT_TIMEOUT_MS);
        console.log('[Connection Settle] Waiting 4s for connection to stabilize after reconnect...');
        await new Promise(r => setTimeout(r, 4000));
      }

      // Liveness ping before every attempt — cheap, and catches a
      // stale connection BEFORE we try to send the real message
      await Promise.race([
        sock.sendPresenceUpdate('available'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Liveness ping timed out')), 10000))
      ]);

      // The actual send, with a hard timeout so it can never hang forever
      await Promise.race([
        sock.sendMessage(jid, { text: message }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Send timed out')), SEND_TIMEOUT_MS))
      ]);

      lastActivityTimestamp = Date.now();
      return { success: true }; // done — exit the retry loop
    } catch (err) {
      lastError = err;
      console.log(`Send attempt ${attempt}/${MAX_SEND_ATTEMPTS} to ${phoneNumber} failed: ${err.message}`);
      // Treat ANY failure here as a possibly-stale connection: force a
      // reconnect before the next attempt, rather than assuming it's
      // still fine.
      isConnected = false;
      handleReconnect();
      if (attempt < MAX_SEND_ATTEMPTS) {
        const backoffMs = 2000 * attempt; // 2s, 4s, ...
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError || new Error('Failed to send after retries');
}

// Queue processor
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    // 1. Check if WhatsApp is connected
    if (!isConnected || !sock) {
      console.log('Queue paused: WhatsApp is not connected');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // Pop the next message from the queue
    const task = messageQueue.shift();
    const { phoneNumber, message, resolve, reject } = task;

    // Randomized human-like delay before each send
    const delayMs = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
    console.log(`Rate limiter: Waiting ${delayMs / 1000}s before sending to ${phoneNumber}...`);
    await new Promise(r => setTimeout(r, delayMs));

    try {
      await sendWithRetry(phoneNumber, message);
      sentTimestamps.push(Date.now());
      console.log(`Successfully sent message to ${phoneNumber}`);
      if (messageLogCallback) messageLogCallback(phoneNumber, message, 'success', null);
      resolve({ success: true });
    } catch (err) {
      console.error(`Giving up on message to ${phoneNumber} after retries:`, err.message);
      if (messageLogCallback) messageLogCallback(phoneNumber, message, 'failed', err.message || 'Unknown error');
      reject(err);
    }
  }

  isProcessingQueue = false;
}

async function logoutBaileys() {
  stopKeepAlive();
  stopProactiveRefresh();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  isReconnectPending = false;

  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('Logout error', e);
    }
  }
  
  const authDir = path.join(__dirname, 'auth_session');
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('Cleared auth_session folder after logout.');
    } catch (rmErr) {
      console.warn('Failed to delete auth_session during logout:', rmErr.message);
    }
  }
  currentQr = null;
  isConnected = false;
  isReconnectPending = false;
  userPhoneNumber = null;

  // Immediately re-initialize so a new QR code is generated right away
  initBaileys();
}

async function resetBaileysSession() {
  console.log('[Baileys] Manual session reset requested...');
  stopKeepAlive();
  stopProactiveRefresh();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  isReconnectPending = false;

  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end(new Error('Manual session reset requested'));
    } catch (e) {
      console.log('Error ending socket on reset (safe to ignore):', e.message);
    }
    sock = null;
  }

  const authDir = path.join(__dirname, 'auth_session');
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('Cleared auth_session folder for fresh session reset.');
    } catch (rmErr) {
      console.warn('Failed to clear auth_session during reset:', rmErr.message);
    }
  }

  currentQr = null;
  isConnected = false;
  userPhoneNumber = null;
  reconnectDelay = 3000;

  // Reinitialize socket fresh
  await initBaileys();

  // Wait up to 5 seconds for QR code to be emitted
  for (let i = 0; i < 10; i++) {
    if (currentQr) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const qrDataUrl = await getBaileysQr();
  return {
    success: true,
    qr: qrDataUrl,
    connected: isConnected,
  };
}

// 5-Minute Health Check Daemon
setInterval(() => {
  console.log('--- WhatsApp Service Health Check ---');
  console.log(`Connected: ${isConnected}`);
  console.log(`Queue size: ${getQueuedCount()} messages`);
  console.log(`Rate limit reached: ${isRateLimitReached()}`);
  if (isConnected) {
    const minutesConnected = Math.floor((Date.now() - lastConnectionOpenTimestamp) / 60000);
    console.log(`Connection Age: ${minutesConnected} minutes`);
    if (sock && sock.ws) {
      console.log(`Socket status: Ready (ws state: ${sock.ws.readyState})`);
    } else {
      console.warn('⚠️ Alert: Connection is marked as connected, but socket object is missing!');
    }
  } else {
    console.log('Connection state: Offline or connecting');
  }
  console.log('------------------------------------');
}, 300000); // 5 minutes

module.exports = {
  initBaileys,
  getBaileysStatus,
  getBaileysQr,
  sendMessage,
  logoutBaileys,
  resetBaileysSession,
  registerMessageLogCallback,
  normalizePakistaniPhone,
};
