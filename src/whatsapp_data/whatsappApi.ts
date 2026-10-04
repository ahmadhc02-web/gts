/// <reference types="vite/client" />
const envUrl = import.meta.env.VITE_WHATSAPP_SERVICE_URL;

// Determine primary API endpoint:
// If browser is on HTTPS and envUrl is insecure http://, prefer same-origin /api/whatsapp to avoid Mixed Content blocks
const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const isEnvInsecureHttp = envUrl && envUrl.startsWith('http://');

let primaryApiUrl = '/api/whatsapp';
if (envUrl && !envUrl.includes('localhost:3001') && !(isPageHttps && isEnvInsecureHttp)) {
  primaryApiUrl = envUrl.replace(/\/+$/, '');
}

const API_URL = primaryApiUrl;

export async function getStatus() {
  try {
    const res = await fetch(`${API_URL}/status`);
    if (!res.ok) {
      // If external or reverse-proxied URL returned 502/503, try same-origin fallback
      if ((res.status === 502 || res.status === 503 || res.status === 504) && API_URL !== '/api/whatsapp') {
        try {
          const fallbackRes = await fetch('/api/whatsapp/status');
          if (fallbackRes.ok) return await fallbackRes.json();
        } catch (_) {}
      }
      if (res.status === 502) {
        return {
          connected: false,
          phoneNumber: null,
          rateLimitReached: false,
          queuedCount: 0,
          _error: 'WhatsApp service is starting or offline on port 3001. Please run "pm2 restart whatsapp-service" on your server.'
        };
      }
      throw new Error(`Status HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.serviceStarting && data.backendError) {
      data._error = `Backend warning: ${data.backendError}`;
    }
    return data;
  } catch (err: any) {
    if (API_URL !== '/api/whatsapp') {
      try {
        const fallbackRes = await fetch('/api/whatsapp/status');
        if (fallbackRes.ok) return await fallbackRes.json();
      } catch (_) {}
    }
    return {
      connected: false,
      phoneNumber: null,
      rateLimitReached: false,
      queuedCount: 0,
      _error: err.message || 'WhatsApp service unreachable'
    };
  }
}

export async function getQr() {
  try {
    const res = await fetch(`${API_URL}/qr`);
    if (!res.ok) {
      if ((res.status === 502 || res.status === 503 || res.status === 504) && API_URL !== '/api/whatsapp') {
        try {
          const fallbackRes = await fetch('/api/whatsapp/qr');
          if (fallbackRes.ok) return await fallbackRes.json();
        } catch (_) {}
      }
      if (res.status === 502) {
        return { 
          qr: null,
          _error: 'WhatsApp backend service is offline (502). Please run "pm2 restart whatsapp-service".'
        };
      }
      throw new Error(`QR HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.qr && data.backendError) {
      data._error = data.backendError;
    }
    return data;
  } catch (err: any) {
    if (API_URL !== '/api/whatsapp') {
      try {
        const fallbackRes = await fetch('/api/whatsapp/qr');
        if (fallbackRes.ok) return await fallbackRes.json();
      } catch (_) {}
    }
    return { 
      qr: null,
      _error: err.message || 'Network request failed'
    };
  }
}

export async function resetWhatsAppSession() {
  try {
    const res = await fetch(`${API_URL}/reset-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      if (API_URL !== '/api/whatsapp') {
        const fallbackRes = await fetch('/api/whatsapp/reset-session', { method: 'POST' });
        if (fallbackRes.ok) return await fallbackRes.json();
      }
      throw new Error(`Reset HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    if (API_URL !== '/api/whatsapp') {
      try {
        const fallbackRes = await fetch('/api/whatsapp/reset-session', { method: 'POST' });
        if (fallbackRes.ok) return await fallbackRes.json();
      } catch (_) {}
    }
    throw new Error(err.message || 'Failed to reset WhatsApp session');
  }
}

export async function getTemplate(): Promise<{ template: string, complaintRegisteredTemplate: string, complaintCompletedTemplate: string, completedStatusValue: string }> {
  try {
    const res = await fetch(`${API_URL}/template`);
    if (!res.ok) throw new Error(`Template HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      template: 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
      complaintRegisteredTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.',
      complaintCompletedTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.',
      completedStatusValue: 'Resolved'
    };
  }
}

export async function saveTemplate(data: { template?: string, complaintRegisteredTemplate?: string, complaintCompletedTemplate?: string, completedStatusValue?: string }) {
  try {
    const res = await fetch(`${API_URL}/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save template');
    return await res.json();
  } catch (err: any) {
    throw new Error(err.message || 'Failed to save template');
  }
}

export async function disconnectWhatsApp() {
  try {
    const res = await fetch(`${API_URL}/disconnect`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to disconnect');
    return await res.json();
  } catch (err) {
    return { success: true };
  }
}

export async function sendMessage(phone: string, message: string) {
  try {
    const res = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });
    
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Network error or invalid JSON response');
    }

    if (!res.ok || (data.success === false && data.error)) {
      throw new Error(data?.error || 'Failed to send message');
    }
    return data;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to send message');
  }
}

export async function createReminderLeadServer(payload: any) {
  try {
    const res = await fetch(`${API_URL}/create-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.leadId) {
      throw new Error(data.error || 'Failed to create lead via server');
    }
    return data.leadId;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to create lead via server');
  }
}

export async function startReminderLead(leadId: string) {
  try {
    const res = await fetch(`${API_URL}/start-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    });
    if (!res.ok) throw new Error('Failed to start lead on server');
    return await res.json();
  } catch (err: any) {
    throw new Error(err.message || 'Failed to start lead on server');
  }
}

export async function sendPushNotification(tokens: string[], title: string, body: string, data?: any) {
  try {
    const res = await fetch(`${API_URL}/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title, body, data })
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    return null;
  }
}
