
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
      if (fs.existsSync(this.authStateDir)) {
        fs.rmSync(this.authStateDir, { recursive: true, force: true });
      }
      if (this.socket) {
        await this.socket.logout();
      }
      this.init();
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
}

export const whatsappBridge = new WhatsAppBridge();
