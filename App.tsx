import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { MainApp } from './components/MainApp';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Handle magic-link hash manually (some environments fail to auto-extract)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
    if (hash) {
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');
      if (access_token && refresh_token) {
        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ data, error }) => {
            if (error) {
              console.error('[Auth] setSession error', error);
              !cancelled && setError(error.message);
            } else {
              !cancelled && setSession(data.session);
            }
          })
          .finally(() => {
            // Clean URL hash for aesthetics
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
          });
      } else if (type) {
        // Clean up hash even if incomplete
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
      }
    }

    // 2. Subscribe to auth state changes first (so we don't miss immediate SIGNED_IN event)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) {
        setSession(newSession);
        setLoading(false);
      }
    });

    // 3. Fetch current session (covers normal load & cases without hash)
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('[Auth] getSession error', error);
        setError(error.message);
      }
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) {
    return (
      <div className="space-y-4 p-6 text-sm">
        <p className="font-medium text-red-600">Authentication Error</p>
        <p className="text-gray-700">{error}</p>
        <button
          className="rounded bg-teal-600 px-3 py-2 text-xs text-white"
          onClick={() => {
            setError(null);
            setLoading(true);
            supabase.auth.getSession().then(({ data }) => {
              setSession(data.session);
              setLoading(false);
            });
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!session) return <AuthScreen />;

  return <MainApp user={session.user} onLogout={() => supabase.auth.signOut()} />;
}
