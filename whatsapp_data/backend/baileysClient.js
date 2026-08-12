const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

let sock = null;
let currentQr = null;
let isConnected = false;
let userPhoneNumber = null;

async function initBaileys() {
  try {
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
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        
        isConnected = false;
        userPhoneNumber = null;
        
        if (shouldReconnect) {
          initBaileys();
        } else {
          console.log('Logged out. Waiting for new scan.');
          sock = null;
          initBaileys();
        }
      } else if (connection === 'open') {
        console.log('Opened connection to WhatsApp');
        isConnected = true;
        currentQr = null;
        if (sock?.user?.id) {
          userPhoneNumber = sock.user.id.split(':')[0];
        }
      }
    });

  } catch (error) {
    console.error('Error initializing Baileys:', error);
  }
}

function getBaileysStatus() {
  return {
    connected: isConnected,
    phoneNumber: userPhoneNumber,
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

async function sendMessage(phoneNumber, message) {
  if (!isConnected || !sock) {
    return { success: false, error: 'WhatsApp is not connected' };
  }
  try {
    const jid = `${phoneNumber}@s.whatsapp.net`;
    const [result] = await sock.onWhatsApp(jid);
    if (!result || !result.exists) {
        return { success: false, error: 'Phone number is not registered on WhatsApp' };
    }

    await sock.sendMessage(jid, { text: message });
    return { success: true };
  } catch (err) {
    console.error('Failed to send message:', err);
    return { success: false, error: err.message };
  }
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

module.exports = {
  initBaileys,
  getBaileysStatus,
  getBaileysQr,
  sendMessage,
  logoutBaileys,
};
