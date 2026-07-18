import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jduamzoyllfspdqucncw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWFtem95bGxmc3BkcXVjbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzc0MzcsImV4cCI6MjA5NTg1MzQzN30.7H-fW0weeqVu9Pr0_KHxOZkmbnypZSdXi1YsIcYlkVM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
