
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

const logger = pino({ level: 'info' });

export class WhatsAppBridge {
  private socket: any = null;
  private qrCodeUrl: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private authStateDir = path.join(process.cwd(), 'auth_info_baileys');

  constructor() {
    this.init();
  }

  private async init() {
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(undefined);
      } catch (e) {
        console.error('Error closing existing socket:', e);
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authStateDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

    this.socket = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
    });

    this.socket.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.qrCodeUrl = await QRCode.toDataURL(qr);
        this.connectionStatus = 'connecting';
      }

      if (connection === 'close') {
        const error = (lastDisconnect?.error as Boom);
        const statusCode = error?.output?.statusCode;
        const errorMessage = error?.message || '';
        
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`Connection closed. Status: ${statusCode}, Message: ${errorMessage}, Reconnecting: ${shouldReconnect}`);
        
        this.connectionStatus = 'disconnected';
        this.qrCodeUrl = null;

        if (shouldReconnect) {
          // If it's a "QR refs attempts ended" or "Stream Errored", we definitely want to retry
          // Even if it's not a known code, we retry after a short delay
          const delayMs = statusCode === 515 ? 1000 : 3000;
          setTimeout(() => this.init(), delayMs);
        }
      } else if (connection === 'open') {
        console.log('WhatsApp connection opened successfully');
        this.connectionStatus = 'connected';
        this.qrCodeUrl = null;
      }
    });

    this.socket.ev.on('creds.update', saveCreds);
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
      console.log('[WA Bridge] Initiating logout sequence...');
      
      this.connectionStatus = 'disconnected';
      
      if (this.socket) {
        console.log('[WA Bridge] Closing active socket...');
        try {
          // Unregister listeners first
          this.socket.ev.removeAllListeners('connection.update');
          this.socket.ev.removeAllListeners('creds.update');
          
          // Try to logout gracefully
          await Promise.race([
            this.socket.logout(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000))
          ]).catch(e => console.warn('[WA Bridge] Socket logout failed or timed out:', e.message));
          
          this.socket.end(undefined);
        } catch (err) {
          console.warn('[WA Bridge] Socket termination error:', err);
        } finally {
          this.socket = null;
        }
      }

      this.qrCodeUrl = null;

      // Ensure all file pointers are released
      await delay(1500);

      if (fs.existsSync(this.authStateDir)) {
        console.log('[WA Bridge] Deleting auth state directory:', this.authStateDir);
        try {
          fs.rmSync(this.authStateDir, { recursive: true, force: true });
        } catch (rmErr) {
          console.error('[WA Bridge] Failed to delete auth dir:', rmErr);
          // Try a second time after another delay
          await delay(1000);
          fs.rmSync(this.authStateDir, { recursive: true, force: true });
        }
      }
      
      console.log('[WA Bridge] Restarting bridge for new session...');
      await this.init();
      return { success: true };
    } catch (e) {
      console.error('[WA Bridge] Critical logout failure:', e);
      this.connectionStatus = 'error';
      // Recovery attempt
      setTimeout(() => this.init(), 3000);
      throw e;
    }
  }
}

export const whatsappBridge = new WhatsAppBridge();
