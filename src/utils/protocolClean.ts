/**
 * Utility to reliably extract clean plain text from protocols and remarks.
 * Strips JSON structures (e.g. `[{"id":"proto-...", "text":"DONE CLEAR"}]`)
 * so user interfaces and edit inputs only work with clean human-readable text.
 */
import { ComplaintReview } from '../types';

export function getCleanProtocolText(remarks?: string, protocols?: ComplaintReview[]): string {
  if (protocols && protocols.length > 0) {
    const text = protocols.map(p => p.text).filter(Boolean).join('\n\n').trim();
    if (text) {
      // Check if p.text itself was a JSON string by any chance
      if (text.startsWith('[') || text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            return parsed.map((item: any) => typeof item === 'string' ? item : (item?.text || '')).filter(Boolean).join('\n\n').trim();
          } else if (parsed && typeof parsed === 'object' && parsed.text) {
            return String(parsed.text).trim();
          }
        } catch {
          return text;
        }
      }
      return text;
    }
  }

  if (!remarks || typeof remarks !== 'string') {
    return '';
  }

  const trimmed = remarks.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => typeof item === 'string' ? item : (item?.text || '')).filter(Boolean).join('\n\n').trim();
      } else if (parsed && typeof parsed === 'object') {
        return String(parsed.text || parsed.remarks || trimmed).trim();
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
