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

function getCandidateEndpoints(): string[] {
  return Array.from(new Set([
    API_URL,
    '/api/whatsapp',
    '/whatsapp-api'
  ].filter((u): u is string => Boolean(u && typeof u === 'string'))));
}

export async function getStatus() {
  const candidateUrls = getCandidateEndpoints();
  let lastData: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected || !data.serviceStarting) {
          return data;
        }
        lastData = data;
      }
    } catch (_) {}
  }

  if (lastData) {
    if (lastData.serviceStarting && lastData.backendError) {
      lastData._error = `Backend: ${lastData.backendError}`;
    }
    return lastData;
  }

  return {
    connected: false,
    phoneNumber: null,
    rateLimitReached: false,
    queuedCount: 0,
    _error: 'WhatsApp service is starting or offline on port 3001. Please run "pm2 restart whatsapp-service" on your server.'
  };
}

export async function getQr() {
  const candidateUrls = getCandidateEndpoints();
  let lastError: string | null = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/qr`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.qr) {
          return data;
        }
        if (data && data.backendError) {
          lastError = data.backendError;
        }
      }
    } catch (_) {}
  }

  return { 
    qr: null,
    _error: lastError || null
  };
}

export async function resetWhatsAppSession() {
  const candidateUrls = getCandidateEndpoints();

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/reset-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
  }
  throw new Error('Failed to reset WhatsApp session on server');
}

import { safeLocalStorage } from '../lib/safeLocalStorage';

const DEFAULT_TEMPLATES = {
  template: 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
  complaintRegisteredTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.',
  complaintCompletedTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.',
  completedStatusValue: 'Resolved'
};

const STORAGE_KEY = 'gts_whatsapp_template_data';

export async function getTemplate(): Promise<{ template: string, complaintRegisteredTemplate: string, complaintCompletedTemplate: string, completedStatusValue: string }> {
  // 1. Try primary API
  try {
    const res = await fetch(`${API_URL}/template`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.template || data.complaintRegisteredTemplate)) {
        const merged = {
          template: data.template || DEFAULT_TEMPLATES.template,
          complaintRegisteredTemplate: data.complaintRegisteredTemplate || DEFAULT_TEMPLATES.complaintRegisteredTemplate,
          complaintCompletedTemplate: data.complaintCompletedTemplate || DEFAULT_TEMPLATES.complaintCompletedTemplate,
          completedStatusValue: data.completedStatusValue || DEFAULT_TEMPLATES.completedStatusValue
        };
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (_) {}

  // 2. Try same-origin fallback if API_URL was external
  if (API_URL !== '/api/whatsapp') {
    try {
      const res2 = await fetch('/api/whatsapp/template', { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        const data = await res2.json();
        if (data && (data.template || data.complaintRegisteredTemplate)) {
          const merged = {
            template: data.template || DEFAULT_TEMPLATES.template,
            complaintRegisteredTemplate: data.complaintRegisteredTemplate || DEFAULT_TEMPLATES.complaintRegisteredTemplate,
            complaintCompletedTemplate: data.complaintCompletedTemplate || DEFAULT_TEMPLATES.complaintCompletedTemplate,
            completedStatusValue: data.completedStatusValue || DEFAULT_TEMPLATES.completedStatusValue
          };
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback to SafeLocalStorage cache
  try {
    const cached = safeLocalStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        template: parsed.template || DEFAULT_TEMPLATES.template,
        complaintRegisteredTemplate: parsed.complaintRegisteredTemplate || DEFAULT_TEMPLATES.complaintRegisteredTemplate,
        complaintCompletedTemplate: parsed.complaintCompletedTemplate || DEFAULT_TEMPLATES.complaintCompletedTemplate,
        completedStatusValue: parsed.completedStatusValue || DEFAULT_TEMPLATES.completedStatusValue
      };
    }
  } catch (_) {}

  return DEFAULT_TEMPLATES;
}

export async function saveTemplate(data: { template?: string, complaintRegisteredTemplate?: string, complaintCompletedTemplate?: string, completedStatusValue?: string }) {
  // 1. Instantly merge & save into client storage so user changes are NEVER lost
  let currentCached = DEFAULT_TEMPLATES;
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (raw) currentCached = { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) };
  } catch (_) {}

  const merged = {
    template: data.template !== undefined ? data.template : currentCached.template,
    complaintRegisteredTemplate: data.complaintRegisteredTemplate !== undefined ? data.complaintRegisteredTemplate : currentCached.complaintRegisteredTemplate,
    complaintCompletedTemplate: data.complaintCompletedTemplate !== undefined ? data.complaintCompletedTemplate : currentCached.complaintCompletedTemplate,
    completedStatusValue: data.completedStatusValue !== undefined ? data.completedStatusValue : currentCached.completedStatusValue
  };

  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  // 2. Post to API server
  let savedOnServer = false;
  try {
    const res = await fetch(`${API_URL}/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      savedOnServer = true;
    }
  } catch (err) {
    console.warn('Primary template save failed, trying same-origin proxy:', err);
  }

  if (!savedOnServer && API_URL !== '/api/whatsapp') {
    try {
      const res2 = await fetch('/api/whatsapp/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
        signal: AbortSignal.timeout(4000)
      });
      if (res2.ok) savedOnServer = true;
    } catch (_) {}
  }

  return { success: true, savedOnServer, ...merged };
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
