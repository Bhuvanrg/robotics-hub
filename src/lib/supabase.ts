import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createStubClient(): SupabaseClient {
  const stub = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: async () => ({
        data: { provider: 'unknown', url: null },
        error: { name: 'AuthError', message: 'Supabase not configured' },
      }),
      signInWithOtp: async () => ({
        data: { user: null, session: null, messageId: null },
        error: { name: 'AuthError', message: 'Supabase not configured' },
      }),
      signOut: async () => ({ error: null }),
    },
  } as unknown as SupabaseClient;
  return stub;
}

let client: SupabaseClient;
if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl === 'your-project-url' ||
  supabaseAnonKey === 'your-anon-key'
) {
  console.error(
    '[Supabase] Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Update .env.local.'
  );
  client = createStubClient();
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (e) {
    console.error('[Supabase] createClient failed:', e);
    client = createStubClient();
  }
}

export const supabase = client;
