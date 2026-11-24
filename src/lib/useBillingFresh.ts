import { useSyncExternalStore } from 'react';
import { subscribeBillingFresh, getBillingFresh } from './supabaseService';

export function useBillingFresh(): boolean {
  return useSyncExternalStore(subscribeBillingFresh, getBillingFresh, getBillingFresh);
}
