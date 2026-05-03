
import { 
  makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({ level: 'error' }); // Minimal logging for production stability

export class WhatsAppBridge {
  private socket: any = null;
  private qrCodeUrl: string | null = null;
  private pairingCode: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private authStateDir = path.join(process.cwd(), 'auth_info_baileys');
  private qrRetryCount = 0;
  private connectionFailCount = 0;

  constructor() {
    console.log('[WA Bridge] WhatsAppBridge instance created');
    this.init().catch(err => {
      console.error('[WA Bridge] Failed to initialize in constructor:', err);
    });
  }

  private async init() {
    const heartbeatPath = path.join(process.cwd(), 'bridge-heartbeat.txt');
    const now = new Date().toISOString();
    console.log(`[WA Bridge] Starting init at ${now} (Fail Count: ${this.connectionFailCount})`);
    fs.writeFileSync(heartbeatPath, `Init started at ${now} (Fails: ${this.connectionFailCount})`);
    
    try {
      // Step 1: Cleanup old socket
      this.pairingCode = null; // Reset pairing code on every init
      if (this.socket) {
        console.log('[WA Bridge] Closing old socket...');
        try {
          this.socket.ev.removeAllListeners('connection.update');
          this.socket.ev.removeAllListeners('creds.update');
          this.socket.end(undefined);
        } catch (e) {}
        this.socket = null;
      }

      // Step 2: Prepare Auth Directory
      if (!fs.existsSync(this.authStateDir)) {
        fs.mkdirSync(this.authStateDir, { recursive: true });
        console.log(`[WA Bridge] Created directory: ${this.authStateDir}`);
      }

      // Step 3: Check for Zombie Session
      const credsPath = path.join(this.authStateDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
          if (!creds.registered) {
            console.log('[WA Bridge] Zombie session detected. Nuking.');
            fs.rmSync(this.authStateDir, { recursive: true, force: true });
            fs.mkdirSync(this.authStateDir, { recursive: true });
          }
        } catch (e) {
          console.warn('[WA Bridge] Creds parse error, continuing...');
        }
      }

      // Step 4: Load Auth State
      console.log('[WA Bridge] Loading multi-file auth state...');
      const { state, saveCreds } = await useMultiFileAuthState(this.authStateDir);

      // Step 5: Version Selection (Reliable baseline)
      let version: [number, number, number] = [2, 3000, 1017539045]; // Known stable version
      try {
         const { version: fetchedVersion } = await fetchLatestBaileysVersion();
         version = fetchedVersion;
         console.log(`[WA Bridge] Using latest Baileys version: ${version.join('.')}`);
      } catch (err) {
         console.warn('[WA Bridge] Failed to fetch latest version, using hardcoded baseline');
      }

      // Step 6: Socket Configuration
      console.log('[WA Bridge] Creating socket...');
      this.socket = makeWASocket({
        version,
        auth: state,
        logger: logger as any,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '120.0.6099.109'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('[WA Bridge] New QR Received');
          this.qrRetryCount = 0; 
          this.connectionFailCount = 0; // Reset on any sign of life
          try {
            this.qrCodeUrl = await QRCode.toDataURL(qr);
            this.connectionStatus = 'connecting';
          } catch (e) {
            console.error('[WA Bridge] QR Gen error');
          }
        }

        if (connection === 'close') {
          const error = (lastDisconnect?.error as Boom);
          const statusCode = error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const shouldReconnect = !isLoggedOut;
          
          this.connectionFailCount++;
          console.log(`[WA Bridge] Connection closed (${statusCode}). Reason: ${error?.message}. Reconnecting: ${shouldReconnect} (Fail Count: ${this.connectionFailCount})`);
          
          this.connectionStatus = 'disconnected';
          this.qrCodeUrl = null;

          if (isLoggedOut) {
            console.warn('[WA Bridge] Logged out. Clearing session...');
            await this.logout();
            return;
          }

          if (shouldReconnect) {
            // Automatic reset if we're stuck in a loop (e.g. 8 consecutive failures)
            if (this.connectionFailCount > 8) {
              console.error('[WA Bridge] Persistent Connection Failure. Forcing full reset.');
              this.connectionFailCount = 0;
              await this.logout();
              return;
            }

            // Exponential backoff: 5s, 10s, 20s, 30s... max 60s
            const delayMs = Math.min(5000 * Math.pow(1.5, this.connectionFailCount - 1), 60000);
            console.log(`[WA Bridge] Retrying in ${Math.round(delayMs / 1000)}s...`);
            setTimeout(() => this.init(), delayMs);
          }
        } else if (connection === 'open') {
          console.log('[WA Bridge] Connection OPEN');
          this.connectionStatus = 'connected';
          this.qrCodeUrl = null;
          this.pairingCode = null;
          this.connectionFailCount = 0; // Reset on success
          this.qrRetryCount = 0;
        }
      });

    } catch (err: any) {
      this.connectionFailCount++;
      console.error('[WA Bridge] Init Fatal Error:', err.message);
      this.connectionStatus = 'error';
      
      const retryDelay = Math.min(15000 * this.connectionFailCount, 60000);
      setTimeout(() => this.init(), retryDelay);
    }
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qrCodeUrl: this.qrCodeUrl,
      pairingCode: this.pairingCode
    };
  }

  public async requestPairingCode(phoneNumber: string) {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }
    
    if (this.connectionStatus === 'connected') {
      throw new Error('Already connected to WhatsApp');
    }

    // Clean phone number: remove non-digits
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) throw new Error('Invalid phone number: No digits found');
    
    // Pakistani numbers handling
    // Case 1: 03001234567 (11 digits, starts with 0) -> 923001234567
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = `92${cleanPhone.substring(1)}`;
    } 
    // Case 2: 3001234567 (10 digits) -> 923001234567
    else if (cleanPhone.length === 10) {
        cleanPhone = `92${cleanPhone}`;
    }
    
    console.log(`[WA Bridge] Requesting pairing code for: ${cleanPhone}`);
    try {
      if (!this.socket) {
        console.log('[WA Bridge] Socket null, attempting to initialize first...');
        await this.init();
        if (!this.socket) throw new Error('Failed to initialize socket for pairing');
      }
      
      // If we are already connected, we can't request a pairing code
      if ((this.connectionStatus as any) === 'connected') {
        throw new Error('Bridge is already connected to WhatsApp');
      }

      const code = await this.socket.requestPairingCode(cleanPhone);
      this.pairingCode = code;
      this.qrCodeUrl = null; // Clear QR as we are using pairing code now
      console.log(`[WA Bridge] Pairing code RECEIVED successfully: ${code}`);
      return { success: true, code };
    } catch (err: any) {
      console.error('[WA Bridge] CRITICAL ERROR during pairing code request:', err.message);
      // If it fails with "already connected" or similar, provide better feedback
      if (err.message.includes('already connected')) {
         throw new Error('WhatsApp is already linked. Log out first to use pairing code.');
      }
      throw new Error(`Pairing code request failed: ${err.message}`);
    }
  }

  public async sendMessage(phoneNumber: string, text: string) {
    console.log(`[WA Bridge] Attempting to send message to ${phoneNumber}. Current Status: ${this.connectionStatus}`);

    // If we are connecting, wait a bit for it to finish
    if (this.connectionStatus === 'connecting') {
      console.log('[WA Bridge] Bridge is connecting, waiting up to 10s...');
      for (let i = 0; i < 10; i++) {
        await delay(1000);
        if ((this.connectionStatus as string) === 'connected') break;
      }
    }

    if (this.connectionStatus !== 'connected' || !this.socket) {
      const msg = this.socket ? `Bridge status is ${this.connectionStatus}` : 'Socket not initialized';
      console.error(`[WA Bridge] Send failed: ${msg}`);
      throw new Error(`WhatsApp bridge not connected (${this.connectionStatus}). Please ensure you have linked your device in the Admin Panel.`);
    }

    // Clean phone number: remove non-digits, adjust for Pakistan if needed
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = `92${cleanPhone.substring(1)}`;
    } else if (cleanPhone.length === 10) {
       // Assume missing country code
       cleanPhone = `92${cleanPhone}`;
    }

    try {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      await this.socket.sendMessage(jid, { text });
      console.log(`[WA Bridge] Message sent successfully to ${jid}`);
      return { success: true, jid };
    } catch (err: any) {
      console.error('[WA Bridge] Error sending message:', err.message);
      throw new Error(`Failed to send WhatsApp message: ${err.message}`);
    }
  }

  public async logout() {
    try {
      console.log('[WA Bridge] !!!! INITIATING EMERGENCY LOGOUT & RESET !!!!');
      
      this.connectionStatus = 'disconnected';
      const oldSocket = this.socket;
      this.socket = null; // Decouple immediately
      this.qrCodeUrl = null;
      this.pairingCode = null;
      
      if (oldSocket) {
        console.log('[WA Bridge] Cleaning up active socket listeners...');
        try {
          oldSocket.ev.removeAllListeners('connection.update');
          oldSocket.ev.removeAllListeners('creds.update');
          
          // Non-blocking logout attempt
          console.log('[WA Bridge] Sending logout signal...');
          oldSocket.logout().catch((e: any) => console.log('[WA Bridge] Graceful logout skipped:', e.message));
          
          // Force close after a short moment
          setTimeout(() => {
            try { oldSocket.end(undefined); } catch (e) {}
            console.log('[WA Bridge] Socket force-terminated');
          }, 1000);
        } catch (err) {
          console.warn('[WA Bridge] Socket termination error:', err);
        }
      }

      // Hard wait for file release
      console.log('[WA Bridge] Waiting for file locks to clear (2s)...');
      await delay(2000);

      if (fs.existsSync(this.authStateDir)) {
        console.log('[WA Bridge] Nuking auth state directory:', this.authStateDir);
        try {
          // Recursive removal with retries
          for (let i = 0; i < 3; i++) {
            try {
              fs.rmSync(this.authStateDir, { recursive: true, force: true });
              console.log('[WA Bridge] Auth directory successfully deleted on attempt', i + 1);
              break;
            } catch (err) {
              console.warn(`[WA Bridge] Dir delete attempt ${i + 1} failed, retrying...`);
              await delay(1000);
            }
          }
        } catch (rmErr: any) {
          console.error('[WA Bridge] FAILED to delete auth dir after retries:', rmErr.message);
        }
      }
      
      console.log('[WA Bridge] RE-INITIALIZING for fresh session...');
      // Small additional delay to ensure OS stabilizes
      await delay(500);
      this.init();
      
      return { success: true, message: 'Bridge reset initiated' };
    } catch (e) {
      console.error('[WA Bridge] Critical logout failure:', e);
      this.connectionStatus = 'error';
      setTimeout(() => this.init(), 5000);
      throw e;
    }
  }
}

export const whatsappBridge = new WhatsAppBridge();
