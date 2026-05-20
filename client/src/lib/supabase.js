import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  // Throwing here makes misconfig obvious during dev/build.
  throw new Error(
    'Supabase env belum di-set: butuh VITE_SUPABASE_URL dan (VITE_SUPABASE_ANON_KEY atau VITE_SUPABASE_PUBLISHABLE_KEY)'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
