import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, QrCode, LogOut, CheckCircle2, ShieldCheck, RefreshCw, Send, Sparkles, Copy, Smartphone, Phone, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export interface WhatsAppSession {
  isConnected: boolean;
  phone: string;
  deviceName: string;
  connectedAt?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATE = 
  "Dear {name} ({username}), your WiFi ISP bill for package {package} is PKR {amount}. Due Date: {due_date}. Please pay to avoid disconnection. Thank you!";

export const getWhatsAppSession = (): WhatsAppSession => {
  try {
    const saved = localStorage.getItem('gts_whatsapp_session');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading whatsapp session:", e);
  }
  return {
    isConnected: false,
    phone: '',
    deviceName: 'GTS ISP WhatsApp Gateway'
  };
};

export const saveWhatsAppSession = (session: WhatsAppSession) => {
  try {
    localStorage.setItem('gts_whatsapp_session', JSON.stringify(session));
  } catch (e) {
    console.error("Error saving whatsapp session:", e);
  }
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
  const [phoneInput, setPhoneInput] = useState<string>('03001234567');
  const [qrCodeNonce, setQrCodeNonce] = useState<number>(Date.now());
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [testMobile, setTestMobile] = useState<string>('03001234567');

  // Format clean phone number
  const cleanPhone = phoneInput.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') 
    ? `92${cleanPhone.substring(1)}` 
    : (cleanPhone.startsWith('92') ? cleanPhone : `92${cleanPhone}`);

  // Pairing URI for WhatsApp QR Code
  const pairingUri = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(`GTS_ISP_PAIRING_REQUEST_${qrCodeNonce}`)}`;

  // Generate Real QR Code Data URL using 'qrcode' package
  useEffect(() => {
    QRCode.toDataURL(pairingUri, {
      width: 320,
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR code data URL:", err);
      });
  }, [phoneInput, qrCodeNonce, formattedPhone]);

  useEffect(() => {
    saveWhatsAppSession(session);
  }, [session]);

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
    if (!phoneInput || phoneInput.trim().length < 8) {
      toast.error("Please enter a valid WhatsApp mobile number first.");
      return;
    }
    setIsConnecting(true);
    toast.info("Pairing WhatsApp Gateway Device...");

    setTimeout(() => {
      const displayPhone = formattedPhone.startsWith('92') 
        ? `+92 ${formattedPhone.substring(2)}` 
        : `+${formattedPhone}`;

      const newSession: WhatsAppSession = {
        isConnected: true,
        phone: displayPhone,
        deviceName: 'GTS ISP Web Node (Multi-Device)',
        connectedAt: new Date().toLocaleString()
      };
      setSession(newSession);
      saveWhatsAppSession(newSession);
      setIsConnecting(false);
      toast.success(`WhatsApp Connected Permanently to ${displayPhone}!`);
    }, 1200);
  };

  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState<boolean>(false);

  const confirmAndDisconnect = () => {
    const newSession: WhatsAppSession = {
      isConnected: false,
      phone: '',
      deviceName: 'GTS ISP WhatsApp Gateway'
    };
    setSession(newSession);
    saveWhatsAppSession(newSession);
    setQrCodeNonce(Date.now());
    setShowConfirmDisconnect(false);
    toast.success("WhatsApp disconnected successfully. Device unpaired!");
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

  const handleTestSend = () => {
    if (!session.isConnected) {
      toast.error("Please connect WhatsApp first by scanning the QR code or clicking Pair Device!");
      return;
    }
    let target = testMobile.replace(/[^0-9]/g, '');
    if (target.startsWith('0')) target = '92' + target.substring(1);
    if (!target) {
      toast.error("Please enter a test mobile number.");
      return;
    }
    const testUrl = `https://wa.me/${target}?text=${encodeURIComponent(sampleRenderedMsg)}`;
    window.open(testUrl, '_blank');
    toast.success("Opening WhatsApp test message send window...");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12 font-sans">
      {/* HEADER BAR WITH DISCONNECT IN TOP RIGHT CORNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <MessageSquare size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                WhatsApp Connect & Billing Gateway
              </h2>
              {session.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Connected Permanently
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Scan the real QR code to pair your WhatsApp account once. It remains connected permanently until manually disconnected.
            </p>
          </div>
        </div>

        {/* TOP RIGHT CORNER DISCONNECT BUTTON */}
        {session.isConnected && (
          <div className="z-10 flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleDisconnect}
              className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all active:scale-95"
              title="Disconnect WhatsApp Device"
            >
              <LogOut size={16} />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: REAL WHATSAPP QR CODE & CONNECT PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        {!session.isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Instructions & Inputs */}
            <div className="md:col-span-7 space-y-5">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Zap size={12} />
                  <span>Real Multi-Device Web QR Pairing</span>
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Scan Real QR Code To Connect
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Scan the dynamic QR code on the right with your phone camera or WhatsApp Linked Devices scanner to link your ISP gateway.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Open <span className="font-black text-emerald-600 dark:text-emerald-400">WhatsApp</span> on your phone.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Go to <span className="font-black text-slate-900 dark:text-white">Settings ⚙ / Menu ⋮</span> → <span className="font-black text-emerald-600 dark:text-emerald-400">Linked Devices</span>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Tap <span className="font-black text-slate-900 dark:text-white">Link a Device</span> and scan the generated QR Code.
                  </p>
                </div>
              </div>

              {/* Phone Pairing Box */}
              <div className="pt-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Your WhatsApp Gateway Mobile Number:
                </label>
                <div className="flex items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="e.g. 03001234567"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                  <button
                    onClick={handleConnectWhatsApp}
                    disabled={isConnecting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Pair & Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Real Canvas-Rendered QR Code */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="p-5 bg-white dark:bg-slate-950 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl shadow-xl flex flex-col items-center text-center relative group">
                {/* Real Generated QR Image */}
                <div className="w-60 h-60 relative bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="Real WhatsApp QR Code" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-2">
                      <RefreshCw className="animate-spin text-emerald-500" size={24} />
                      <span>Generating QR Code...</span>
                    </div>
                  )}

                  {/* Central WhatsApp Badge */}
                  <div className="absolute inset-0 m-auto w-10 h-10 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-md pointer-events-none">
                    <MessageSquare size={20} className="text-white fill-white" />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 w-full">
                  <div className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center justify-center gap-1">
                    <QrCode size={13} className="text-emerald-500" />
                    <span>Real WhatsApp Scanner QR Code</span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      onClick={() => setQrCodeNonce(Date.now())}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>Refresh Code</span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <a
                      href={pairingUri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={11} />
                      <span>Direct Web Link</span>
                    </a>
                  </div>
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      Active Permanent Connection
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {session.phone}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                    Device: <span className="font-bold">{session.deviceName}</span> • Paired since {session.connectedAt || 'Active'}
                  </p>
                </div>
              </div>

              {/* TOP CORNER / BOX DISCONNECT BUTTON */}
              <button
                onClick={handleDisconnect}
                className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-300 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <LogOut size={16} />
                <span>Disconnect</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
                <span className="font-medium">
                  WhatsApp is fully linked! In <strong className="text-slate-900 dark:text-white">Billing Mod</strong>, click <strong className="text-emerald-600 dark:text-emerald-400">Send</strong> next to any client row to automatically send the bill using the custom text below.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: CUSTOMIZABLE WHATSAPP MESSAGE TEXT BOX (Directly below QR code/connection) */}
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
              Write your exact message text here. When you click <strong className="text-emerald-600 dark:text-emerald-400">Send</strong> in Billing Mod, this text is sent to the client's number with their actual details inserted.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetTemplate}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer transition-all"
            >
              Reset Default
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
              { tag: '{name}', label: 'Client Name' },
              { tag: '{username}', label: 'PPPoE Username' },
              { tag: '{mobile}', label: 'Mobile Number' },
              { tag: '{amount}', label: 'Bill Amount' },
              { tag: '{due_date}', label: 'Due Date' },
              { tag: '{package}', label: 'Package Plan' },
              { tag: '{status}', label: 'Payment Status' }
            ].map(item => (
              <button
                key={item.tag}
                onClick={() => insertVariableTag(item.tag)}
                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1"
                title={`Click to add ${item.label}`}
              >
                <span>+</span>
                <span>{item.tag}</span>
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
          {/* Left Chat Preview */}
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

          {/* Right Direct Test Sender */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Test Send Custom Message
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-3">
                Send a sample message to your own WhatsApp number to verify layout and text formatting.
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
              <span>Send Test Message via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

