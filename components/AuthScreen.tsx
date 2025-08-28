import React, { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Bot, Github, Chrome, MessageCircle, Mail, Loader2 } from 'lucide-react';

type OAuthProvider = 'google' | 'github' | 'discord';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      setError(null);
      setLoadingProvider(provider);
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setError(error.message);
      setLoadingProvider(null);
    },
    [redirectTo]
  );

  const signInWithEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoadingProvider('email');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setError(error.message);
      } else {
        setEmailSent(true);
      }
      setLoadingProvider(null);
    },
    [email, redirectTo]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-orange-50 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-teal-600 shadow-lg">
            <Bot className="size-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Robotics Hub</h1>
          <p className="text-gray-600">Connect with your FIRST Robotics community</p>
        </div>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-xl">
          <div className="rounded-md bg-teal-50 p-3 text-xs text-teal-900">
            <p className="font-medium">What is Robotics Hub?</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Personalized feed for FLL, FTC, and FRC news and tutorials</li>
              <li>Ask and answer questions in active robotics forums</li>
              <li>Find events, resources, and team opportunities near you</li>
            </ul>
            <p className="mt-2 text-[11px] text-teal-800">
              Join with Google, GitHub, Discord, or email to start exploring.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => signInWithProvider('google')}
              disabled={!!loadingProvider}
              className="h-12 w-full justify-start"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Chrome className="size-4 text-blue-600" />
              )}
              <span className="ml-3">Continue with Google</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => signInWithProvider('github')}
              disabled={!!loadingProvider}
              className="h-12 w-full justify-start"
            >
              {loadingProvider === 'github' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Github className="size-4" />
              )}
              <span className="ml-3">Continue with GitHub</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => signInWithProvider('discord')}
              disabled={!!loadingProvider}
              className="h-12 w-full justify-start"
            >
              {loadingProvider === 'discord' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4 text-indigo-600" />
              )}
              <span className="ml-3">Continue with Discord</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide text-gray-500">
              <span className="bg-white px-3">or</span>
            </div>
          </div>

          <form onSubmit={signInWithEmail} className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="focus-within:ring-ring/50 flex items-center rounded-md border bg-white pr-2 focus-within:ring-2">
                <Mail className="ml-3 size-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={!!loadingProvider || email.length === 0}
              className="h-11 w-full"
            >
              {loadingProvider === 'email' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : emailSent ? (
                'Link sent — check your email'
              ) : (
                'Continue with Email'
              )}
            </Button>
          </form>

          {error && (
            <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {emailSent && !error && (
            <p className="text-xs text-green-600">
              Magic link sent. You can close this tab after you click the link in your email.
            </p>
          )}
        </div>

        <div className="space-y-4 text-center">
          <p className="px-2 text-xs leading-relaxed text-gray-600">
            Use a personal Google, GitHub or Discord account. Students under 13 should use Email
            with a parent or mentor present.
          </p>
          <p className="text-[10px] text-gray-400">
            By continuing you agree to our
            {' '}<a className="underline" href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
            {' '}and{' '}
            <a className="underline" href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
