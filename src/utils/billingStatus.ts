/**
 * Utility functions for billing status calculation and row deduplication
 */

export type EffectiveBillingStatus = 'paid' | 'partial' | 'dc' | 'tdc' | 'unpaid' | 'next';

/**
 * Calculates the effective billing status for a billing row:
 * - total = Number(row.totalAmount ?? (baseAmount + cr)) || 0
 * - received = Number(row.paymentReceived) || 0
 * - status = lowercase trim of row.paymentStatus
 * 
 * Rules:
 * - Return 'paid' if status === 'paid' OR (total > 0 && received >= total)
 * - Return 'partial' if received > 0 and received < total, or status === 'partial'
 * - Keep 'dc' and 'tdc' as they are
 * - Treat 'next' as unpaid-like (returns 'next' if returnNext is true, otherwise 'unpaid')
 * - Otherwise 'unpaid'
 * (Received money always wins over a stale 'unpaid' label.)
 */
export function getEffectiveBillingStatus(row: any, returnNext: boolean = false): EffectiveBillingStatus {
  if (!row) return 'unpaid';

  const baseAmount = Number(row.baseAmount) || 0;
  const cr = Number(row.cr) || 0;
  const total = Number(row.totalAmount ?? (baseAmount + cr)) || 0;
  const received = Number(row.paymentReceived) || 0;
  const status = String(row.paymentStatus || row.status || '').toLowerCase().trim();

  // Paid check: explicit paid or money fully received
  if (status === 'paid' || (total > 0 && received >= total)) {
    return 'paid';
  }

  // Partial check: money partially received or explicit partial
  if ((received > 0 && received < total) || status === 'partial') {
    return 'partial';
  }

  // Preserve DC and TDC
  if (status === 'dc') {
    return 'dc';
  }
  if (status === 'tdc') {
    return 'tdc';
  }

  // 'next' status is unpaid-like: treated as unpaid by default for campaign/unpaid filters
  if (status === 'next') {
    return returnNext ? 'next' : 'unpaid';
  }

  return 'unpaid';
}

/**
 * Normalizes phone numbers to last 10 digits for accurate grouping
 */
function getLast10Phone(phoneRaw: any): string {
  if (!phoneRaw) return '';
  const digits = String(phoneRaw).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Returns payment rank for sorting:
 * paid > partial > tdc/dc > unpaid / next
 */
function getPaymentRank(status: EffectiveBillingStatus): number {
  switch (status) {
    case 'paid':
      return 4;
    case 'partial':
      return 3;
    case 'tdc':
    case 'dc':
      return 2;
    case 'next':
    case 'unpaid':
    default:
      return 1;
  }
}

/**
 * Deduplicates billing rows by client:
 * Group rows by clientId, else by the last 10 digits of mobileNumber/phone, else by lowercase username.
 * For each group keep ONE row: the one with the best payment score
 * (paid > partial > tdc/dc > unpaid; then larger paymentReceived; then the row with more comments);
 * ties keep the later row in the list.
 * 
 * Returns { rows, removedCount }
 */
export function dedupeBillingRowsByClient(rows: any[]): { rows: any[]; removedCount: number } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: [], removedCount: 0 };
  }

  // Map to store grouped rows with original index
  const groups = new Map<string, Array<{ row: any; index: number }>>();

  rows.forEach((row, idx) => {
    let key = '';
    const clientId = String(row.clientId || row.client_id || '').trim();
    if (clientId) {
      key = `cid:${clientId.toLowerCase()}`;
    } else {
      const phone = getLast10Phone(row.mobileNumber || row.phone || row.number);
      if (phone) {
        key = `phone:${phone}`;
      } else {
        const username = String(row.username || row.clientUsername || row.id || '').trim().toLowerCase();
        if (username) {
          key = `uname:${username}`;
        } else {
          // Fallback to unique index if no identifier exists
          key = `idx:${idx}`;
        }
      }
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({ row, index: idx });
  });

  const selectedRowsWithIndex: Array<{ row: any; index: number }> = [];
  let removedCount = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      selectedRowsWithIndex.push(group[0]);
      continue;
    }

    removedCount += group.length - 1;

    // Pick best row in group
    let best = group[0];
    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      const bestStatus = getEffectiveBillingStatus(best.row);
      const candStatus = getEffectiveBillingStatus(candidate.row);

      const bestRank = getPaymentRank(bestStatus);
      const candRank = getPaymentRank(candStatus);

      if (candRank > bestRank) {
        best = candidate;
      } else if (candRank === bestRank) {
        const bestRec = Number(best.row.paymentReceived) || 0;
        const candRec = Number(candidate.row.paymentReceived) || 0;

        if (candRec > bestRec) {
          best = candidate;
        } else if (candRec === bestRec) {
          const bestCommLen = String(best.row.comments || '').trim().length;
          const candCommLen = String(candidate.row.comments || '').trim().length;

          if (candCommLen > bestCommLen) {
            best = candidate;
          } else if (candCommLen === bestCommLen) {
            // Ties keep the later row in the list
            if (candidate.index > best.index) {
              best = candidate;
            }
          }
        }
      }
    }

    selectedRowsWithIndex.push(best);
  }

  // Sort back to preserve stable relative order according to winning item's original index
  selectedRowsWithIndex.sort((a, b) => a.index - b.index);

  return {
    rows: selectedRowsWithIndex.map(item => item.row),
    removedCount
  };
}
