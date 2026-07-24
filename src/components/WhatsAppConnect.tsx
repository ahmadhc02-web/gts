import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, QrCode, LogOut, CheckCircle2, ShieldCheck, RefreshCw, Send, Sparkles, Copy, Smartphone, Phone, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { io, Socket } from 'socket.io-client';

export interface WhatsAppSession {
  isConnected: boolean;
  phone: string;
  deviceName: string;
  connectedAt?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATE = 
  "Dear {name} ({username}), your WiFi ISP bill for package {package} is PKR {amount}. Due Date: {due_date}. Please pay to avoid disconnection. Thank you!";

// In-memory cache for session from socket
let globalSession: WhatsAppSession = {
  isConnected: false,
  phone: '',
  deviceName: 'GTS ISP WhatsApp Gateway'
};

export const getWhatsAppSession = (): WhatsAppSession => {
  return globalSession;
};

export const saveWhatsAppSession = (session: WhatsAppSession) => {
  globalSession = session;
};

export const getWhatsAppTemplate = (): string => {
  try {
    const saved = localStorage.getItem('gts_whatsapp_msg_template');
    if (saved && saved.trim()) {
      return saved;
    }
  } catch (e) {
    console.error("Error reading whatsapp template:", e);
  }
  return DEFAULT_WHATSAPP_TEMPLATE;
};

export const saveWhatsAppTemplate = (template: string) => {
  try {
    localStorage.setItem('gts_whatsapp_msg_template', template);
  } catch (e) {
    console.error("Error saving whatsapp template:", e);
  }
};

interface WhatsAppConnectProps {
  onClose?: () => void;
}

export default function WhatsAppConnect({ onClose }: WhatsAppConnectProps) {
  const [session, setSession] = useState<WhatsAppSession>(getWhatsAppSession());
  const [template, setTemplate] = useState<string>(getWhatsAppTemplate());
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [testMobile, setTestMobile] = useState<string>('');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);

  // Auto-check status and initialize gateway on mount
  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io();
    setSocket(newSocket);

    const handleStatusData = (data: any) => {
      if (data.dailyCount !== undefined) {
        setDailyCount(data.dailyCount);
      }
      
      if (data.state === 'CONNECTED' || data.session?.isConnected) {
        const newSess = {
          isConnected: true,
          phone: data.session?.phone || 'Connected Gateway (+92)',
          deviceName: data.session?.deviceName || 'GTS ISP Web Node (Multi-Device)',
          connectedAt: data.session?.connectedAt || new Date().toLocaleString()
        };
        setSession(newSess);
        saveWhatsAppSession(newSess);
        setQrCodeData(null);
        setIsConnecting(false);
      } else if (data.state === 'DISCONNECTED') {
        const newSess = {
          isConnected: false,
          phone: '',
          deviceName: 'GTS ISP WhatsApp Gateway'
        };
        setSession(newSess);
        saveWhatsAppSession(newSess);
        setIsConnecting(false);
      } else if (data.state === 'INITIALIZING') {
        setIsConnecting(true);
      } else if (data.state === 'QR_READY' || data.qr) {
        setIsConnecting(false);
        if (data.qr) {
          setQrCodeData(data.qr);
        }
      }
    };

    newSocket.on('connect', () => {
      console.log("Connected to WebSocket for WhatsApp status");
      newSocket.emit("whatsapp_connect");
    });

    newSocket.on('whatsapp_status', handleStatusData);

    // Initial REST trigger and poll
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        handleStatusData(data);
      } catch (e) {
        console.error("Failed to check whatsapp status:", e);
      }
    };

    // Trigger auto init
    fetch('/api/whatsapp/init', { method: 'POST' }).catch(() => {});
    checkStatus();

    // Poll every 3 seconds to ensure QR code or connection updates immediately
    const pollInterval = setInterval(checkStatus, 3000);

    return () => {
      newSocket.disconnect();
      clearInterval(pollInterval);
    };
  }, []);

  // Generate Real QR Code Data URL using 'qrcode' package when qrCodeData is received
  useEffect(() => {
    if (qrCodeData) {
      QRCode.toDataURL(qrCodeData, {
        width: 340,
        margin: 2,
        color: { dark: '#090d16', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Failed to generate QR code data URL:", err));
    } else {
      setQrDataUrl('');
    }
  }, [qrCodeData]);

  const handleSaveTemplate = () => {
    saveWhatsAppTemplate(template);
    toast.success("WhatsApp Billing Message Template saved successfully!");
  };

  const handleResetTemplate = () => {
    setTemplate(DEFAULT_WHATSAPP_TEMPLATE);
    saveWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATE);
    toast.success("Message template reset to default.");
  };

  const handleConnectWhatsApp = () => {
    setIsConnecting(true);
    setQrCodeData(null);
    setQrDataUrl('');
    if (socket) {
      socket.emit("whatsapp_connect");
    }
    fetch('/api/whatsapp/init', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.qr) setQrCodeData(data.qr);
      })
      .catch(() => {});
    toast.info("Initializing WhatsApp Gateway... Please wait for QR code.");
  };

  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState<boolean>(false);

  const confirmAndDisconnect = () => {
    if (socket) {
      socket.emit("whatsapp_disconnect");
    }
    setShowConfirmDisconnect(false);
    toast.success("Sending disconnect signal to gateway...");
  };

  const handleDisconnect = () => {
    setShowConfirmDisconnect(true);
  };

  const insertVariableTag = (tag: string) => {
    setTemplate((prev) => prev + ` ${tag} `);
  };

  const sampleRenderedMsg = template
    .replace(/{name}/g, 'Muhammad Ali')
    .replace(/{username}/g, 'ali_wifi_10')
    .replace(/{mobile}/g, '03001234567')
    .replace(/{amount}/g, '2,500')
    .replace(/{due_date}/g, '5th of Month')
    .replace(/{package}/g, '10 Mbps Fiber Gold')
    .replace(/{status}/g, 'UNPAID');

  const handleTestSend = async () => {
    if (!session.isConnected) {
      toast.error("Please connect WhatsApp first by scanning the QR code!");
      return;
    }
    
    if (!testMobile) {
      toast.error("Please enter a test mobile number.");
      return;
    }
    
    toast.info("Queueing test message...", { description: "Applying safe delay..." });
    
    try {
      const res = await fetch("/api/whatsapp/send", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ phone: testMobile, message: sampleRenderedMsg })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test message");
      }
      toast.success("Test message queued successfully!");
      if (data.count !== undefined) setDailyCount(data.count);
    } catch (e: any) {
      toast.error("Failed to send", { description: e.message });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12 font-sans">
      {/* SECTION 1: REAL WHATSAPP QR CODE & CONNECT PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        {!session.isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Instructions & Inputs */}
            <div className="md:col-span-7 space-y-5">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Zap size={12} />
                  <span>Secure Web QR Pairing</span>
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Connect Official Gateway
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Initialize the engine to request a live, secure QR code directly from WhatsApp. This session is saved on the server securely so it reconnects automatically.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Click <strong>Initialize Gateway</strong> below to generate a fresh QR code.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Open <span className="font-black text-emerald-600 dark:text-emerald-400">WhatsApp</span> on your phone and go to <strong>Linked Devices</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Scan the generated QR Code to safely establish the server session.
                  </p>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                  <button
                    onClick={handleConnectWhatsApp}
                    disabled={isConnecting}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Initializing Engine...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Initialize Gateway & Generate QR</span>
                      </>
                    )}
                  </button>
              </div>
            </div>

            {/* Right: Real Canvas-Rendered QR Code */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="p-5 bg-white dark:bg-slate-950 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl shadow-xl flex flex-col items-center text-center relative group">
                <div className="w-64 h-64 relative bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="Real WhatsApp QR Code" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-3 p-4">
                      <RefreshCw className="animate-spin text-emerald-500" size={28} />
                      <div className="text-center space-y-1">
                        <p className="text-slate-800 dark:text-slate-200 font-extrabold text-xs">Generating WhatsApp QR Code...</p>
                        <p className="text-[10px] text-slate-500 font-normal">Connecting live WhatsApp Web session. Please wait 5-10 seconds.</p>
                      </div>
                    </div>
                  )}

                  {/* Central WhatsApp Badge */}
                  {qrDataUrl && (
                     <div className="absolute inset-0 m-auto w-10 h-10 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-md pointer-events-none">
                       <MessageSquare size={20} className="text-white fill-white" />
                     </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 w-full">
                  <div className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center justify-center gap-1.5">
                    <QrCode size={14} className="text-emerald-500" />
                    <span>Scan with WhatsApp → Linked Devices</span>
                  </div>
                  <button
                    onClick={handleConnectWhatsApp}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh / Regenerate QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CONNECTED STATE DISPLAY */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Saved in Database • 24/7 Active
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {session.phone || 'Connected Gateway (+92)'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                    Device: <span className="font-bold">{session.deviceName}</span> • Permanent server session active.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Daily Sent:</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{dailyCount}</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all active:scale-95"
                  title="Disconnect WhatsApp Device"
                >
                  <LogOut size={16} />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                <span className="font-medium text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                  <strong>Permanent Gateway Active:</strong> Your WhatsApp pairing is saved in the server database. All billing alerts & complaint updates will dispatch automatically 24/7.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: CUSTOMIZABLE WHATSAPP MESSAGE TEXT BOX */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-500" />
              <h3 className="text-base font-black uppercase tracking-wide text-slate-900 dark:text-white">
                Custom WhatsApp Message Text Box
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Write your exact message text here. When you click <strong className="text-emerald-600 dark:text-emerald-400">Send</strong> in Billing Mod, this text is sent to the client's number.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetTemplate}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all"
            >
              Reset
            </button>
            <button
              onClick={handleSaveTemplate}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>Save Message Text</span>
            </button>
          </div>
        </div>

        {/* Dynamic Variable Tag Badges */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            Click Variable Tags To Insert into Text:
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: '{name}', label: 'Full Name' },
              { id: '{username}', label: 'Username' },
              { id: '{mobile}', label: 'Mobile No' },
              { id: '{amount}', label: 'Bill Amount' },
              { id: '{due_date}', label: 'Due Date' },
              { id: '{package}', label: 'Package Name' },
              { id: '{status}', label: 'Status' }
            ].map(tag => (
              <button
                key={tag.id}
                onClick={() => insertVariableTag(tag.id)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-200 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="font-mono">{tag.id}</span>
                <span className="opacity-50">· {tag.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Editable Text Box */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Your Custom Billing Message Text:
          </label>
          <textarea
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed font-sans"
            placeholder="Type your custom WhatsApp billing message text here..."
          />
        </div>

        {/* Live Preview & Direct Test Send */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Live Preview (As Seen by Client):
            </label>
            <div className="p-4 bg-emerald-900/10 dark:bg-slate-950 border border-emerald-500/20 rounded-2xl">
              <div className="bg-[#dcf8c6] dark:bg-[#054740] text-slate-900 dark:text-emerald-50 p-3.5 rounded-2xl rounded-tr-none text-xs font-medium leading-relaxed shadow-sm relative">
                <div className="whitespace-pre-wrap font-sans">{sampleRenderedMsg}</div>
                <div className="text-[9px] text-slate-500 dark:text-emerald-200/60 text-right mt-1.5 font-mono">
                  12:45 PM ✓✓
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Test Send Custom Message
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-3">
                Send a sample message to your own WhatsApp number to verify layout and text formatting. Will be queued safely.
              </p>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400">
                  Test Phone Number:
                </label>
                <input
                  type="text"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                  placeholder="e.g. 03001234567"
                />
              </div>
            </div>

            <button
              onClick={handleTestSend}
              className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Send size={14} />
              <span>Send Test Message via Server</span>
            </button>
          </div>
        </div>
      </div>

      {showConfirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">
              Disconnect Gateway?
            </h3>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Are you sure you want to log out the server session? You will need to scan a new QR code to reconnect.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDisconnect(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndDisconnect}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all"
              >
                Disconnect
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
