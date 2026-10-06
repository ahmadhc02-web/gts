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
import { supabase } from '../lib/supabase';

export const DEFAULT_WHATSAPP_TEMPLATES = {
  template: 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
  complaintRegisteredTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.',
  complaintCompletedTemplate: 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.',
  completedStatusValue: 'complete'
};

const STORAGE_KEY = 'gts_whatsapp_template_data';

export function getSynchronousCachedTemplates(): typeof DEFAULT_WHATSAPP_TEMPLATES {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          template: parsed.template || DEFAULT_WHATSAPP_TEMPLATES.template,
          complaintRegisteredTemplate: parsed.complaintRegisteredTemplate || DEFAULT_WHATSAPP_TEMPLATES.complaintRegisteredTemplate,
          complaintCompletedTemplate: parsed.complaintCompletedTemplate || DEFAULT_WHATSAPP_TEMPLATES.complaintCompletedTemplate,
          completedStatusValue: parsed.completedStatusValue || DEFAULT_WHATSAPP_TEMPLATES.completedStatusValue
        };
      }
    }
  } catch (_) {}
  return DEFAULT_WHATSAPP_TEMPLATES;
}

export async function getTemplate(): Promise<{ template: string, complaintRegisteredTemplate: string, complaintCompletedTemplate: string, completedStatusValue: string }> {
  // 0. Instant baseline from local persistent storage
  const cachedBaseline = getSynchronousCachedTemplates();

  // 1. Try querying Supabase branding_config table directly
  try {
    const { data: bRows, error: bErr } = await supabase
      .from('branding_config')
      .select('*')
      .eq('config_type', 'whatsapp_templates')
      .limit(1);

    if (!bErr && bRows && bRows.length > 0 && bRows[0].branding_data) {
      const parsed = typeof bRows[0].branding_data === 'string' 
        ? JSON.parse(bRows[0].branding_data) 
        : bRows[0].branding_data;

      if (parsed && (parsed.template || parsed.message_template)) {
        const merged = {
          template: parsed.template || parsed.message_template || cachedBaseline.template,
          complaintRegisteredTemplate: parsed.complaintRegisteredTemplate || parsed.complaint_registered_template || cachedBaseline.complaintRegisteredTemplate,
          complaintCompletedTemplate: parsed.complaintCompletedTemplate || parsed.complaint_completed_template || cachedBaseline.complaintCompletedTemplate,
          completedStatusValue: parsed.completedStatusValue || parsed.complaint_completed_status_value || cachedBaseline.completedStatusValue
        };
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (_) {}

  // 2. Try primary API
  try {
    const res = await fetch(`${API_URL}/template`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.template || data.complaintRegisteredTemplate)) {
        const merged = {
          template: data.template || cachedBaseline.template,
          complaintRegisteredTemplate: data.complaintRegisteredTemplate || cachedBaseline.complaintRegisteredTemplate,
          complaintCompletedTemplate: data.complaintCompletedTemplate || cachedBaseline.complaintCompletedTemplate,
          completedStatusValue: data.completedStatusValue || cachedBaseline.completedStatusValue
        };
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (_) {}

  // 3. Try same-origin fallback if API_URL was external
  if (API_URL !== '/api/whatsapp') {
    try {
      const res2 = await fetch('/api/whatsapp/template', { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        const data = await res2.json();
        if (data && (data.template || data.complaintRegisteredTemplate)) {
          const merged = {
            template: data.template || cachedBaseline.template,
            complaintRegisteredTemplate: data.complaintRegisteredTemplate || cachedBaseline.complaintRegisteredTemplate,
            complaintCompletedTemplate: data.complaintCompletedTemplate || cachedBaseline.complaintCompletedTemplate,
            completedStatusValue: data.completedStatusValue || cachedBaseline.completedStatusValue
          };
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (_) {}
  }

  return cachedBaseline;
}

export async function saveTemplate(data: { template?: string, complaintRegisteredTemplate?: string, complaintCompletedTemplate?: string, completedStatusValue?: string }) {
  // 1. Instantly merge & save into client storage so user changes are NEVER lost
  const currentCached = getSynchronousCachedTemplates();

  const merged = {
    template: data.template !== undefined ? data.template : currentCached.template,
    complaintRegisteredTemplate: data.complaintRegisteredTemplate !== undefined ? data.complaintRegisteredTemplate : currentCached.complaintRegisteredTemplate,
    complaintCompletedTemplate: data.complaintCompletedTemplate !== undefined ? data.complaintCompletedTemplate : currentCached.complaintCompletedTemplate,
    completedStatusValue: data.completedStatusValue !== undefined ? data.completedStatusValue : currentCached.completedStatusValue,
    updated_at: new Date().toISOString()
  };

  // Immediate storage update
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  // 2. Direct Supabase universal persistence in branding_config (config_type: 'whatsapp_templates')
  try {
    await supabase
      .from('branding_config')
      .upsert({
        config_type: 'whatsapp_templates',
        branding_data: JSON.stringify(merged),
        updated_at: merged.updated_at
      }, { onConflict: 'config_type' });
  } catch (supErr) {
    console.warn('Supabase branding_config direct save warning:', supErr);
  }

  // Also try whatsapp_settings table
  try {
    await supabase
      .from('whatsapp_settings')
      .upsert({
        id: 'main',
        message_template: merged.template,
        complaint_registered_template: merged.complaintRegisteredTemplate,
        complaint_completed_template: merged.complaintCompletedTemplate,
        complaint_completed_status_value: merged.completedStatusValue,
        updated_at: merged.updated_at
      });
  } catch (_) {}

  // 3. Post to API servers (primary + same-origin)
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
  const candidateUrls = getCandidateEndpoints();
  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/start-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to start lead on server');
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
