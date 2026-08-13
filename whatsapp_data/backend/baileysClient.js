const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

let sock = null;
let currentQr = null;
let isConnected = false;
let userPhoneNumber = null;

// Reconnect/Backoff State
let reconnectDelay = 3000; // start with 3 seconds
let reconnectTimer = null;
let resetBackoffTimer = null;
let lastConnectionOpenTimestamp = 0;

// Message Queue State
const messageQueue = [];
let isProcessingQueue = false;
const sentTimestamps = []; // Slide window of sent messages
const HOURLY_LIMIT = 50; // Max 50 messages per rolling hour

// Logging Callback
let messageLogCallback = null;

function registerMessageLogCallback(callback) {
  messageLogCallback = callback;
}

function getQueuedCount() {
  return messageQueue.length;
}

function isRateLimitReached() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const activeSentCount = sentTimestamps.filter(t => t > oneHourAgo).length;
  return activeSentCount >= HOURLY_LIMIT;
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
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`Connection closed. StatusCode: ${statusCode}. Logged out: ${isLoggedOut}`);
        
        isConnected = false;
        userPhoneNumber = null;
        
        if (isLoggedOut) {
          console.log('Logged out of WhatsApp. Waiting for manual scan. Clearing session auth...');
          reconnectDelay = 3000; // Reset backoff delay
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
        
        // Reset backoff delay after 2 minutes of stable connection
        if (resetBackoffTimer) clearTimeout(resetBackoffTimer);
        resetBackoffTimer = setTimeout(() => {
          if (isConnected) {
            console.log('Connection stable. Resetting reconnect backoff delay to 3s.');
            reconnectDelay = 3000;
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
  if (reconnectTimer) clearTimeout(reconnectTimer);

  console.log(`Scheduling reconnect in ${reconnectDelay / 1000} seconds...`);
  reconnectTimer = setTimeout(() => {
    // Double delay for next reconnect, cap at 60 seconds
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

    // 2. Check rolling hour cap
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    while (sentTimestamps.length > 0 && sentTimestamps[0] < oneHourAgo) {
      sentTimestamps.shift();
    }

    if (sentTimestamps.length >= HOURLY_LIMIT) {
      console.log(`Hourly limit of ${HOURLY_LIMIT} messages reached. Pausing queue processing...`);
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    // Pop the next message from the queue
    const task = messageQueue.shift();
    const { phoneNumber, message, resolve, reject } = task;

    try {
      // Randomized delay: 3 to 8 seconds (between 3000ms and 8000ms)
      const delayMs = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
      console.log(`Rate limiter: Waiting ${delayMs / 1000}s before sending to ${phoneNumber}...`);
      await new Promise(r => setTimeout(r, delayMs));

      // Re-verify connection before dispatching
      if (!isConnected || !sock) {
        throw new Error('Disconnected during wait period');
      }

      // Check registration & send
      const jid = `${phoneNumber}@s.whatsapp.net`;
      const [result] = await sock.onWhatsApp(jid);
      if (!result || !result.exists) {
        const errMsg = 'Phone number is not registered on WhatsApp';
        if (messageLogCallback) {
          messageLogCallback(phoneNumber, message, 'failed', errMsg);
        }
        reject(new Error(errMsg));
        continue;
      }

      await sock.sendMessage(jid, { text: message });
      sentTimestamps.push(Date.now());
      
      console.log(`Successfully sent message to ${phoneNumber}`);
      if (messageLogCallback) {
        messageLogCallback(phoneNumber, message, 'success', null);
      }
      resolve({ success: true });
    } catch (err) {
      console.error(`Failed to send queued message to ${phoneNumber}:`, err);
      if (messageLogCallback) {
        messageLogCallback(phoneNumber, message, 'failed', err.message || 'Unknown error');
      }
      reject(err);
    }
  }

  isProcessingQueue = false;
}

async function logoutBaileys() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('Logout error', e);
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
