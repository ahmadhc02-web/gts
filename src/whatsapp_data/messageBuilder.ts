export interface ClientReminderData {
  name?: string;
  totalAmount?: number | string;
  baseAmount?: number | string;
  amount?: number | string;
  paymentStatus?: string;
  status?: string;
  username?: string;
  clientId?: string;
  id?: string;
  area?: string;
}

/**
 * Builds a WhatsApp reminder message from a template string by replacing placeholders:
 * {{name}}, {{amount}}, {{username}}, {{status}}, {{area}}
 */
export function buildReminderMessage(template: string, client: ClientReminderData): string {
  let message = template || '';
  const name = client.name || 'Customer';
  const amount = (client.totalAmount ?? client.baseAmount ?? client.amount ?? 0).toString();
  const username = client.username || client.clientId || client.id || 'N/A';
  const status = (client.paymentStatus || client.status || 'unpaid').toUpperCase();
  const area = client.area || 'N/A';

  message = message.replace(/\{\{name\}\}/g, name);
  message = message.replace(/\{\{amount\}\}/g, amount);
  message = message.replace(/\{\{username\}\}/g, username);
  message = message.replace(/\{\{status\}\}/g, status);
  message = message.replace(/\{\{area\}\}/g, area);

  return message;
}
