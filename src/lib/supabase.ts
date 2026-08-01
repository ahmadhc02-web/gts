import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://167.233.41.7.sslip.io';
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';

let activeUrl = defaultSupabaseUrl;
let activeKey = defaultSupabaseAnonKey;

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const customUrl = window.localStorage.getItem('gts_custom_supabase_url');
    const customKey = window.localStorage.getItem('gts_custom_supabase_anon_key');
    if (customUrl && customUrl.trim() !== '') {
      activeUrl = customUrl.trim();
    }
    if (customKey && customKey.trim() !== '') {
      activeKey = customKey.trim();
    }
  }
} catch (e) {}

export const supabaseUrl = activeUrl;
export const supabaseAnonKey = activeKey;
export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  }
});

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (url) window.localStorage.setItem('gts_custom_supabase_url', url.trim());
      else window.localStorage.removeItem('gts_custom_supabase_url');

      if (anonKey) window.localStorage.setItem('gts_custom_supabase_anon_key', anonKey.trim());
      else window.localStorage.removeItem('gts_custom_supabase_anon_key');
    }
  } catch (e) {}
}

export function clearCustomSupabaseConfig() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('gts_custom_supabase_url');
      window.localStorage.removeItem('gts_custom_supabase_anon_key');
    }
  } catch (e) {}
}
