const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

let sock = null;
let currentQr = null;
let isConnected = false;
let userPhoneNumber = null;

// Reconnect/Backoff State
let reconnectDelay = 3000; // start with 3 seconds
let reconnectTimer = null;
let resetBackoffTimer = null;
let lastConnectionOpenTimestamp = 0;
let isReconnectPending = false;
let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    if (isConnected && sock) {
      try {
        await sock.sendPresenceUpdate('available');
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
    console.log('Initializing Baileys...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_session');

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }), // Reduce logs
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
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`Connection closed. StatusCode: ${statusCode}. Logged out: ${isLoggedOut}`);
        
        isConnected = false;
        userPhoneNumber = null;
        
        if (isLoggedOut) {
          console.log('Logged out of WhatsApp. Waiting for manual scan. Clearing session auth...');
          reconnectDelay = 3000; // Reset backoff delay
          isReconnectPending = false;
          const authDir = path.join(__dirname, 'auth_session');
          if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('Cleared stale auth_session folder after force logout.');
          }
          currentQr = null;
          // Initialize fresh Baileys to show new QR code
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
        if (sock?.user?.id) {
          userPhoneNumber = sock.user.id.split(':')[0];
        }
        
        // Start keep-alive presence ping
        startKeepAlive();

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
        processQueue();
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
  if (isConnected || !currentQr) return null;
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
const SEND_TIMEOUT_MS = 30000; // 30s per attempt
const RECONNECT_WAIT_TIMEOUT_MS = 45000; // max time to wait for reconnect

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

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      // Make sure we're connected before even trying
      if (!isConnected || !sock) {
        console.log(`Attempt ${attempt}: not connected, waiting for reconnect...`);
        handleReconnect();
        await waitForReconnect(RECONNECT_WAIT_TIMEOUT_MS);
      }

      // Liveness ping before every attempt — cheap, and catches a
      // stale connection BEFORE we try to send the real message
      await Promise.race([
        sock.sendPresenceUpdate('available'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Liveness ping timed out')), 10000))
      ]);

      // Confirm the number is on WhatsApp (only needs to happen once,
      // but cheap enough to keep here for simplicity/correctness)
      const [result] = await sock.onWhatsApp(jid);
      if (!result || !result.exists) {
        throw new Error('__NOT_REGISTERED__'); // not retryable
      }

      // The actual send, with a hard timeout so it can never hang forever
      await Promise.race([
        sock.sendMessage(jid, { text: message }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Send timed out')), SEND_TIMEOUT_MS))
      ]);

      return { success: true }; // done — exit the retry loop
    } catch (err) {
      lastError = err;
      if (err.message === '__NOT_REGISTERED__') {
        throw new Error('Phone number is not registered on WhatsApp'); // don't retry this one
      }
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
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      const authDir = path.join(__dirname, 'auth_session');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log('Cleared stale auth_session folder after logout.');
      }
      currentQr = null;
      isConnected = false;
      isReconnectPending = false;
      userPhoneNumber = null;
    }
  }
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
  registerMessageLogCallback,
};
