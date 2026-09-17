import { createClient } from '@supabase/supabase-js';

let _supabase = null;

/**
 * Lazily creates the Supabase client. Lazy so importing this module doesn't
 * throw in contexts (e.g. some test runs) where env vars aren't set yet, and
 * so tests can set FITNESS_DASHBOARD_SUPABASE_URL/KEY before first use.
 */
export function getSupabaseClient() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see app/.env.example). ' +
        'Copy app/.env.example to app/.env.local and fill in your Supabase project credentials.'
    );
  }

  _supabase = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _supabase;
}

/** Test-only: forces a fresh client on next getSupabaseClient() call. */
export function resetSupabaseClientForTests() {
  _supabase = null;
}
