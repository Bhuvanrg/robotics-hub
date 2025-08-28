import { supabase } from '@/lib/supabase';
import { uploadAvatar } from './storage';
import { toast } from 'sonner';
import { supabase as client } from '@/lib/supabase';

export interface UserProfileRecord {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  team: string | null;
  avatar_url?: string | null;
  interests: string[] | null;
  followed_tags?: string[] | null;
  show_in_team_finder: boolean;
  public_profile: boolean;
  email_notifications: boolean;
  email_frequency?: 'daily' | 'weekly' | 'off';
  last_digest_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchUserProfile(userId: string): Promise<UserProfileRecord | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as UserProfileRecord;
}

export interface UpsertUserProfileInput {
  user_id: string;
  display_name?: string | null;
  bio?: string | null;
  location?: string | null;
  team?: string | null;
  avatar_url?: string | null;
  interests?: string[] | null;
  followed_tags?: string[] | null;
  show_in_team_finder?: boolean;
  public_profile?: boolean;
  email_notifications?: boolean;
  email_frequency?: 'daily' | 'weekly' | 'off';
}

export async function upsertUserProfile(input: UpsertUserProfileInput) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(input, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as UserProfileRecord;
}

// In-memory cache + localStorage persistence to reduce round-trips.
// Simple TTL strategy (24h) – safe for display metadata (names, avatar when added).

interface CachedProfileEntry {
  profile: UserProfileRecord;
  expires: number; // epoch ms
}

const MEMORY_CACHE: Map<string, CachedProfileEntry> = new Map();
const LS_KEY = 'rh.profileCache.v1';
const TTL_MS = 24 * 60 * 60 * 1000;
let lsLoaded = false;

function loadFromStorage() {
  if (lsLoaded) return;
  lsLoaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed: Record<string, CachedProfileEntry> = JSON.parse(raw);
    const now = Date.now();
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && v.expires > now) MEMORY_CACHE.set(k, v);
    });
  } catch {
    /* ignore localStorage parse */
  }
}

function persistToStorage() {
  try {
    const obj: Record<string, CachedProfileEntry> = {};
    MEMORY_CACHE.forEach((v, k) => {
      if (v.expires > Date.now()) obj[k] = v;
    });
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore persistence errors */
  }
}

export function getCachedProfile(userId: string): UserProfileRecord | undefined {
  loadFromStorage();
  const entry = MEMORY_CACHE.get(userId);
  if (!entry) return;
  if (entry.expires < Date.now()) {
    MEMORY_CACHE.delete(userId);
    return;
  }
  return entry.profile;
}

export async function fetchUserProfiles(
  userIds: string[]
): Promise<Record<string, UserProfileRecord>> {
  loadFromStorage();
  if (!userIds.length) return {};
  const unique = Array.from(new Set(userIds));
  const now = Date.now();
  const need: string[] = [];
  const result: Record<string, UserProfileRecord> = {};
  unique.forEach((id) => {
    const entry = MEMORY_CACHE.get(id);
    if (entry && entry.expires > now) {
      result[id] = entry.profile;
    } else {
      need.push(id);
    }
  });
  if (need.length) {
    const { data, error } = await supabase.from('user_profiles').select('*').in('user_id', need);
    if (!error && data) {
      (data as UserProfileRecord[]).forEach((p) => {
        result[p.user_id] = p;
        MEMORY_CACHE.set(p.user_id, { profile: p, expires: Date.now() + TTL_MS });
      });
      persistToStorage();
    }
  }
  return result;
}

export function primeUserProfiles(profiles: UserProfileRecord[]) {
  if (!profiles?.length) return;
  loadFromStorage();
  profiles.forEach((p) =>
    MEMORY_CACHE.set(p.user_id, { profile: p, expires: Date.now() + TTL_MS })
  );
  persistToStorage();
}

export function clearUserProfileCache() {
  MEMORY_CACHE.clear();
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

// Optional realtime subscription to keep cache hot when user updates their profile elsewhere.
export function subscribeToUserProfile(userId: string, cb?: (p: UserProfileRecord) => void) {
  const channel = supabase
    .channel(`user_profile_${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${userId}` },
      (payload) => {
        const p = payload.new as UserProfileRecord;
        MEMORY_CACHE.set(userId, { profile: p, expires: Date.now() + TTL_MS });
        persistToStorage();
        cb?.(p);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Convenience: upload avatar file then persist avatar_url on profile.
export async function updateAvatar(userId: string, file: File) {
  const url = await uploadAvatar(userId, file);
  if (!url) throw new Error('Avatar upload failed');
  const updated = await upsertUserProfile({ user_id: userId, avatar_url: url });
  // prime cache
  primeUserProfiles([updated]);
  return updated;
}

// Trigger a test weekly digest for the current authenticated user via Edge Function
export async function sendTestDigest(edgeUrl?: string, days = 7) {
  // Derive Edge Functions base URL from Vite env if not explicitly provided
  type ViteEnv = { VITE_EDGE_URL?: string; VITE_SUPABASE_URL?: string };
  const viteEnv: ViteEnv | undefined =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: ViteEnv }).env ?? undefined)
      : undefined;
  const baseUrl =
    edgeUrl?.replace(/\/$/, '') ||
    viteEnv?.VITE_EDGE_URL ||
    (viteEnv?.VITE_SUPABASE_URL
      ? `${viteEnv.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1`
      : '');
  if (!baseUrl) {
    toast('Edge function URL not configured');
    return { ok: false };
  }
  try {
    const { data: sessionRes } = await client.auth.getSession();
    const accessToken = sessionRes?.session?.access_token;
    // Use GET + dry_run=true (safer without RESEND configured). Still requires Authorization for test mode
    const u = `${baseUrl}/weekly-digest?days=${encodeURIComponent(days)}&dry_run=true&test=true&limit=1`;
    const res = await fetch(u, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      toast(`Test send failed: ${json?.error || res.status}`);
      return { ok: false };
    }
    toast('Test digest triggered');
    return { ok: true };
  } catch (e) {
    toast(`Test send error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return { ok: false };
  }
}
