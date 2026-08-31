/// <reference types="vite/client" />
const API_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001';

export async function getStatus() {
  const res = await fetch(`${API_URL}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function getQr() {
  const res = await fetch(`${API_URL}/qr`);
  if (!res.ok) throw new Error('Failed to fetch QR');
  return res.json();
}

export async function getTemplate(): Promise<{ template: string, complaintRegisteredTemplate: string, complaintCompletedTemplate: string, completedStatusValue: string }> {
  const res = await fetch(`${API_URL}/template`);
  if (!res.ok) throw new Error('Failed to fetch template');
  return res.json();
}

export async function saveTemplate(data: { template?: string, complaintRegisteredTemplate?: string, complaintCompletedTemplate?: string, completedStatusValue?: string }) {
  const res = await fetch(`${API_URL}/template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save template');
  return res.json();
}

export async function disconnectWhatsApp() {
  const res = await fetch(`${API_URL}/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect');
  return res.json();
}

export async function sendMessage(phone: string, message: string) {
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

  if (!res.ok || !data.success) {
    throw new Error(data?.error || 'Failed to send message');
  }
  return data;
}

export async function sendPushNotification(tokens: string[], title: string, body: string, data?: any) {
  try {
    const res = await fetch(`${API_URL}/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title, body, data })
    });
    if (!res.ok) {
      console.warn('Push notification failed with status', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('Network error sending push notification:', err);
    return null;
  }
}
