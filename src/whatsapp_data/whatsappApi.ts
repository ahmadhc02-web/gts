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

export async function getStatus(sessionKey?: string) {
  const candidateUrls = getCandidateEndpoints();
  let lastData: any = null;
  const qStr = sessionKey ? `?session=${encodeURIComponent(sessionKey)}` : '';

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/status${qStr}`);
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
    session: sessionKey || 'main',
    rateLimitReached: false,
    queuedCount: 0,
    _error: 'WhatsApp service is starting or offline on port 3001. Please run "pm2 restart whatsapp-service" on your server.'
  };
}

export async function getQr(sessionKey?: string) {
  const candidateUrls = getCandidateEndpoints();
  let lastError: string | null = null;
  const qStr = sessionKey ? `?session=${encodeURIComponent(sessionKey)}` : '';

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/qr${qStr}`);
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
    session: sessionKey || 'main',
    _error: lastError || null
  };
}

export async function resetWhatsAppSession(sessionKey?: string) {
  const candidateUrls = getCandidateEndpoints();

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/reset-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionKey || 'main' })
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

export interface WhatsAppTemplatesData {
  template: string;
  complaintRegisteredTemplate: string;
  complaintCompletedTemplate: string;
  completedStatusValue: string;
  updated_at?: string;
  source?: string;
}

export interface SaveTemplateResult extends WhatsAppTemplatesData {
  success: boolean;
  savedOnServer: boolean;
  savedInDatabase: boolean;
  error?: string;
}

export async function getTemplate(): Promise<WhatsAppTemplatesData> {
  const cachedBaseline = getSynchronousCachedTemplates();

  // 1. Fetch server endpoint with cache: 'no-store' and cache-buster timestamp
  try {
    const res = await fetch(`/api/whatsapp/template?_=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.template || data.complaintRegisteredTemplate || data.complaintCompletedTemplate)) {
        const serverData: WhatsAppTemplatesData = {
          template: data.template || cachedBaseline.template,
          complaintRegisteredTemplate: data.complaintRegisteredTemplate || cachedBaseline.complaintRegisteredTemplate,
          complaintCompletedTemplate: data.complaintCompletedTemplate || cachedBaseline.complaintCompletedTemplate,
          completedStatusValue: data.completedStatusValue || cachedBaseline.completedStatusValue,
          updated_at: data.updated_at,
          source: data.source || 'server'
        };
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
        return serverData;
      }
    }
  } catch (_) {}

  // 2. Try API_URL fallback if external
  if (API_URL && API_URL !== '/api/whatsapp') {
    try {
      const resFallback = await fetch(`${API_URL}/template?_=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000)
      });
      if (resFallback.ok) {
        const data = await resFallback.json();
        if (data && (data.template || data.complaintRegisteredTemplate || data.complaintCompletedTemplate)) {
          const serverData: WhatsAppTemplatesData = {
            template: data.template || cachedBaseline.template,
            complaintRegisteredTemplate: data.complaintRegisteredTemplate || cachedBaseline.complaintRegisteredTemplate,
            complaintCompletedTemplate: data.complaintCompletedTemplate || cachedBaseline.complaintCompletedTemplate,
            completedStatusValue: data.completedStatusValue || cachedBaseline.completedStatusValue,
            updated_at: data.updated_at,
            source: data.source || 'server'
          };
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
          return serverData;
        }
      }
    } catch (_) {}
  }

  // Use localStorage only when the request fails
  return cachedBaseline;
}

export async function saveTemplate(data: {
  template?: string;
  complaintRegisteredTemplate?: string;
  complaintCompletedTemplate?: string;
  completedStatusValue?: string;
}): Promise<SaveTemplateResult> {
  const currentCached = getSynchronousCachedTemplates();

  const merged = {
    template: data.template !== undefined ? data.template : currentCached.template,
    complaintRegisteredTemplate: data.complaintRegisteredTemplate !== undefined ? data.complaintRegisteredTemplate : currentCached.complaintRegisteredTemplate,
    complaintCompletedTemplate: data.complaintCompletedTemplate !== undefined ? data.complaintCompletedTemplate : currentCached.complaintCompletedTemplate,
    completedStatusValue: data.completedStatusValue !== undefined ? data.completedStatusValue : currentCached.completedStatusValue,
    updated_at: new Date().toISOString()
  };

  let savedOnServer = false;
  let savedInDatabase = false;
  let serverError: string | undefined = undefined;
  let serverResultData: any = null;

  // POST the merged data once to /api/whatsapp/template (same origin; keep existing API_URL fallback)
  try {
    const res = await fetch('/api/whatsapp/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      serverResultData = await res.json();
      savedOnServer = true;
      savedInDatabase = Boolean(serverResultData.savedInDatabase);
      if (serverResultData.error) serverError = serverResultData.error;
    } else {
      serverError = `Server returned HTTP ${res.status}`;
    }
  } catch (err: any) {
    if (API_URL && API_URL !== '/api/whatsapp') {
      try {
        const resFallback = await fetch(`${API_URL}/template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
          signal: AbortSignal.timeout(4000)
        });
        if (resFallback.ok) {
          serverResultData = await resFallback.json();
          savedOnServer = true;
          savedInDatabase = Boolean(serverResultData.savedInDatabase);
          if (serverResultData.error) serverError = serverResultData.error;
        } else {
          serverError = `Server returned HTTP ${resFallback.status}`;
        }
      } catch (fbErr: any) {
        serverError = fbErr?.message || 'Server unreachable';
      }
    } else {
      serverError = err?.message || 'Server unreachable';
    }
  }

  // Only write localStorage after the server answered (and still write it if the server is unreachable, but then return savedOnServer: false)
  const finalResult: SaveTemplateResult = {
    success: true,
    savedOnServer,
    savedInDatabase,
    error: serverError,
    template: serverResultData?.template || merged.template,
    complaintRegisteredTemplate: serverResultData?.complaintRegisteredTemplate || merged.complaintRegisteredTemplate,
    complaintCompletedTemplate: serverResultData?.complaintCompletedTemplate || merged.complaintCompletedTemplate,
    completedStatusValue: serverResultData?.completedStatusValue || merged.completedStatusValue,
    updated_at: serverResultData?.updated_at || merged.updated_at,
    source: serverResultData?.source || (savedOnServer ? (savedInDatabase ? 'database' : 'memory') : 'local')
  };

  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
    template: finalResult.template,
    complaintRegisteredTemplate: finalResult.complaintRegisteredTemplate,
    complaintCompletedTemplate: finalResult.complaintCompletedTemplate,
    completedStatusValue: finalResult.completedStatusValue,
    updated_at: finalResult.updated_at,
    source: finalResult.source
  }));

  return finalResult;
}

export async function disconnectWhatsApp(sessionKey?: string) {
  try {
    const res = await fetch(`${API_URL}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionKey || 'main' })
    });
    if (!res.ok) throw new Error('Failed to disconnect');
    return await res.json();
  } catch (err) {
    return { success: true };
  }
}

export async function sendMessage(
  phone: string,
  message: string,
  sessionKey?: string,
  meta?: { kind?: string; clientName?: string; clientUsername?: string; [key: string]: any }
) {
  try {
    const res = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message,
        session: sessionKey || 'main',
        ...(meta !== undefined ? { meta } : {})
      })
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
    const cloned = { ...payload };
    const ws = Number(cloned.waitSeconds || cloned.wait_seconds || 60);
    cloned.waitSeconds = Math.min(300, Math.max(60, ws));
    const res = await fetch(`${API_URL}/create-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloned),
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

export async function deleteReminderLeadApi(leadId: string) {
  const candidateUrls = getCandidateEndpoints();
  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(`${url}/delete-lead`, {
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

  // Even if backend network fails, return graceful object
  return { success: true, deleted: true, leadId };
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

export async function getCampaignMonthPreference(scopeKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('campaign_preferences')
    .select('month_id')
    .eq('id', scopeKey)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.month_id || null;
}

export async function saveCampaignMonthPreference(scopeKey: string, monthId: string, updatedBy?: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_preferences')
    .upsert({
      id: scopeKey,
      month_id: monthId,
      updated_by: updatedBy || 'admin',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export async function clearCampaignMonthPreference(scopeKey: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_preferences')
    .upsert({
      id: scopeKey,
      month_id: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}
