/// <reference types="vite/client" />
const envUrl = import.meta.env.VITE_WHATSAPP_SERVICE_URL;
const API_URL = (envUrl && !envUrl.includes('localhost:3001')) ? envUrl : '/api/whatsapp';

export async function getStatus() {
  try {
    const res = await fetch(`${API_URL}/status`);
    if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      phoneNumber: null,
      rateLimitReached: false,
      queuedCount: 0,
      _error: err.message || 'Network request failed'
    };
  }
}

export async function getQr() {
  try {
    const res = await fetch(`${API_URL}/qr`);
    if (!res.ok) throw new Error(`QR HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { 
      qr: null,
      _error: err.message || 'Network request failed'
    };
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
