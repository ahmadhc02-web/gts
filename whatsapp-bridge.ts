
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

const logger = pino({ level: 'info' }); // Increased log level for better diagnostics

export class WhatsAppBridge {
  private socket: any = null;
  private qrCodeUrl: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private authStateDir = path.join(process.cwd(), 'auth_info_baileys');
  private qrRetryCount = 0;

  constructor() {
    console.log('[WA Bridge] WhatsAppBridge instance created');
    this.init().catch(err => {
      console.error('[WA Bridge] Failed to initialize in constructor:', err);
    });
  }

  private async init() {
    console.log('[WA Bridge] Starting initialization or restart sequence...');
    fs.writeFileSync(path.join(process.cwd(), 'bridge-heartbeat.txt'), `Init started at ${new Date().toISOString()}`);
    
    // Check if we have a potentially corrupt or unregistered zombie session
    if (fs.existsSync(path.join(this.authStateDir, 'creds.json'))) {
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(this.authStateDir, 'creds.json'), 'utf-8'));
        if (!creds.registered) {
          console.log('[WA Bridge] Session found but NOT REGISTERED. This is a zombie session. Nuking and starting fresh for QR.');
          try {
            fs.rmSync(this.authStateDir, { recursive: true, force: true });
          } catch (delErr) {
            console.error('[WA Bridge] Error deleting zombie session dir:', delErr);
          }
        } else {
          console.log('[WA Bridge] Validating existing registered session...');
        }
      } catch (e) {
        console.warn('[WA Bridge] Failed to parse existing creds.json, starting normally:', e);
      }
    }

    if (this.socket) {
      try {
        console.log('[WA Bridge] Closing existing socket...');
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(undefined);
      } catch (e) {
        console.error('[WA Bridge] Error closing existing socket:', e);
      }
    }

    // Ensure directory exists
    if (!fs.existsSync(this.authStateDir)) {
      fs.mkdirSync(this.authStateDir, { recursive: true });
    }

    try {
      console.log('[WA Bridge] Loading auth state...');
      const { state, saveCreds } = await useMultiFileAuthState(this.authStateDir);
      
      console.log('[WA Bridge] Fetching latest Baileys version...');
      const { version, isLatest } = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise<{ version: [number, number, number], isLatest: boolean }>((_, reject) => 
          setTimeout(() => reject(new Error('Version fetch timeout')), 10000)
        )
      ]).catch(err => {
        console.warn('[WA Bridge] Failed to fetch latest version, using hardcoded fallback:', err.message);
        return { version: [6, 12, 0] as [number, number, number], isLatest: false };
      });
      
      console.log(`[WA Bridge] Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

      this.socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: state,
        logger,
        browser: ['Ubuntu', 'Chrome', '110.0.5563.147'], // More standard browser string for Baileys
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 120000, // Double timeout for slow environments
        defaultQueryTimeoutMs: 90000,
        keepAliveIntervalMs: 20000,
        retryRequestDelayMs: 3000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false, // Don't sync full history to save resources
      });

      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('[WA Bridge] NEW QR CODE RECEIVED - Generating Data URL...');
          this.qrRetryCount = 0; // Reset counter on any QR received
          try {
            this.qrCodeUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
            console.log(`[WA Bridge] QR Data URL generated (${this.qrCodeUrl.length} chars)`);
            this.connectionStatus = 'connecting';
          } catch (qrErr) {
            console.error('[WA Bridge] QR Code generation failed:', qrErr);
          }
        }

        if (connection === 'close') {
          const error = (lastDisconnect?.error as Boom);
          const statusCode = error?.output?.statusCode;
          const errorMessage = error?.message || 'Unknown error';
          const isConnectionFailure = errorMessage.toLowerCase().includes('connection failure') || statusCode === 503;
          
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          console.log(`[WA Bridge] Connection closed. Status: ${statusCode}, Message: ${errorMessage}, Reconnecting: ${shouldReconnect}, IsConnFail: ${isConnectionFailure}`);
          
          this.connectionStatus = 'disconnected';
          this.qrCodeUrl = null;

          if (shouldReconnect) {
            this.qrRetryCount++;
            console.log(`[WA Bridge] Retry attempt: ${this.qrRetryCount}`);
            
            // If we've failed too many times without getting a QR or connecting, it might be a zombie session
            if (this.qrRetryCount > 5) {
              console.warn('[WA Bridge] TOO MANY FAILURES WITHOUT QR. FORCING FULL RESET...');
              this.qrRetryCount = 0;
              this.logout().catch(e => console.error('[WA Bridge] Automatic reset failure:', e));
              return;
            }

            // Adaptive delay: fast retry for transient noise, slower for systemic failures
            const delayMs = (statusCode === 515 || isConnectionFailure) ? 2000 : 8000;
            console.log(`[WA Bridge] Scheduled reconnect in ${delayMs}ms...`);
            setTimeout(() => this.init(), delayMs);
          }
        } else if (connection === 'open') {
          console.log('[WA Bridge] WhatsApp connection opened successfully');
          this.connectionStatus = 'connected';
          this.qrCodeUrl = null;
          this.qrRetryCount = 0; // Reset on success
        }
      });

      this.socket.ev.on('creds.update', saveCreds);
    } catch (criticalErr) {
      console.error('[WA Bridge] CRITICAL INIT ERROR:', criticalErr);
      this.connectionStatus = 'error';
      setTimeout(() => this.init(), 10000);
    }
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qrCodeUrl: this.qrCodeUrl
    };
  }

  public async sendMessage(phoneNumber: string, text: string) {
    if (this.connectionStatus !== 'connected' || !this.socket) {
      throw new Error('WhatsApp bridge not connected');
    }

    // Clean phone number: remove non-digits, adjust for Pakistan if needed
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = `92${cleanPhone.substring(1)}`;
    } else if (cleanPhone.length === 10) {
       // Assume missing country code
       cleanPhone = `92${cleanPhone}`;
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;
    await this.socket.sendMessage(jid, { text });
    return { success: true, jid };
  }

  public async logout() {
    try {
      console.log('[WA Bridge] !!!! INITIATING EMERGENCY LOGOUT & RESET !!!!');
      
      this.connectionStatus = 'disconnected';
      const oldSocket = this.socket;
      this.socket = null; // Decouple immediately
      this.qrCodeUrl = null;
      
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
