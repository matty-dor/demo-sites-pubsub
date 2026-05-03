import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSupabase } from '../env.js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = assertSupabase();
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
