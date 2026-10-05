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
  package?: string;
  pkg?: string;
  pkgDetails?: string;
  packageDetails?: string;
}

/**
 * Builds a WhatsApp reminder message from a template string by replacing placeholders:
 * {{name}}, {{amount}}, {{username}}, {{package}}, {{pkg}}, {{status}}, {{area}}
 */
export function buildReminderMessage(template: string, client: ClientReminderData): string {
  let message = template || '';
  const name = client.name || 'Customer';
  const amount = (client.totalAmount ?? client.baseAmount ?? client.amount ?? 0).toString();
  const username = client.username || client.clientId || client.id || 'N/A';
  const status = (client.paymentStatus || client.status || 'unpaid').toUpperCase();
  const area = client.area || 'N/A';
  const pkg = client.package || client.pkgDetails || client.packageDetails || client.pkg || 'N/A';

  message = message.replace(/\{\{name\}\}/gi, name);
  message = message.replace(/\{\{amount\}\}/gi, amount);
  message = message.replace(/\{\{username\}\}/gi, username);
  message = message.replace(/\{\{package\}\}/gi, pkg);
  message = message.replace(/\{\{pkg\}\}/gi, pkg);
  message = message.replace(/\{\{pkgDetails\}\}/gi, pkg);
  message = message.replace(/\{\{packageDetails\}\}/gi, pkg);
  message = message.replace(/\{\{status\}\}/gi, status);
  message = message.replace(/\{\{area\}\}/gi, area);

  return message;
}
