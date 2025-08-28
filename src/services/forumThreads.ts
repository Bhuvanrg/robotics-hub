import { supabase } from '@/lib/supabase';
import { fetchUserProfiles, getCachedProfile, UserProfileRecord } from './userProfiles';

export interface ForumThreadRecord {
  id: number;
  author_id: string | null;
  title: string;
  body: string;
  category: string;
  tags: string[] | null;
  is_pinned: boolean;
  answered_reply_id: number | null;
  reply_count: number;
  view_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface NewForumThreadInput {
  title: string;
  body: string;
  category: string;
  tags: string[];
  author_id?: string | null;
}

const THREADS = 'forum_threads';

export async function fetchForumThreads(): Promise<ForumThreadRecord[]> {
  const { data, error } = await supabase
    .from(THREADS)
    .select('*')
    .order('last_activity_at', { ascending: false });
  if (error || !data) return [];
  return data as ForumThreadRecord[];
}

export async function createForumThread(
  input: NewForumThreadInput
): Promise<ForumThreadRecord | null> {
  const { data, error } = await supabase.from(THREADS).insert(input).select('*').single();
  if (error || !data) return null;
  return data as ForumThreadRecord;
}

export interface EnrichedForumThread extends ForumThreadRecord {
  author_profile?: Pick<UserProfileRecord, 'user_id' | 'display_name' | 'team' | 'avatar_url'>;
}

async function enrichAuthorProfiles(records: ForumThreadRecord[]): Promise<EnrichedForumThread[]> {
  const ids = Array.from(new Set(records.map((r) => r.author_id).filter(Boolean))) as string[];
  if (!ids.length) return records;
  const missing = ids.filter((id) => !getCachedProfile(id));
  if (missing.length) await fetchUserProfiles(missing);
  return records.map((r) => {
    const prof = r.author_id ? getCachedProfile(r.author_id) : undefined;
    return {
      ...r,
      author_profile: prof
        ? {
            user_id: prof.user_id,
            display_name: prof.display_name,
            team: prof.team,
            avatar_url: prof.avatar_url ?? null,
          }
        : undefined,
    };
  });
}

export async function fetchForumThreadsPage(offset: number, limit: number) {
  const from = offset;
  const to = offset + limit - 1;
  let base: ForumThreadRecord[] = [];
  const { data, error } = await supabase
    .from(THREADS)
    .select('*, user_profiles!inner(user_id, display_name, team, avatar_url)')
    .order('last_activity_at', { ascending: false })
    .range(from, to);
  if (!error && data) {
    interface JoinedRow extends ForumThreadRecord {
      user_profiles?: {
        user_id: string;
        display_name: string | null;
        team: string | null;
        avatar_url: string | null;
      } | null;
    }
    base = (data as JoinedRow[]).map((row) => {
      const { user_profiles, ...rest } = row;
      const rec: ForumThreadRecord = { ...rest } as ForumThreadRecord;
      if (user_profiles) {
        (rec as EnrichedForumThread).author_profile = {
          user_id: user_profiles.user_id,
          display_name: user_profiles.display_name,
          team: user_profiles.team,
          avatar_url: user_profiles.avatar_url,
        };
      }
      return rec;
    });
  } else {
    const { data: basic, error: e2 } = await supabase
      .from(THREADS)
      .select('*')
      .order('last_activity_at', { ascending: false })
      .range(from, to);
    if (e2 || !basic) return [] as ForumThreadRecord[];
    base = basic as ForumThreadRecord[];
  }
  const need = base.filter((b) => !(b as EnrichedForumThread).author_profile);
  if (need.length) {
    const enriched = await enrichAuthorProfiles(need);
    const map = new Map(enriched.map((e) => [e.id, e]));
    base = base.map((b) => map.get(b.id) || b);
  }
  return base;
}

export function subscribeToNewThreads(cb: (t: ForumThreadRecord) => void) {
  const channel = supabase
    .channel('forum_threads_insert')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: THREADS }, (payload) => {
      cb(payload.new as ForumThreadRecord);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchForumThreadsByIds(ids: number[]): Promise<ForumThreadRecord[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from(THREADS)
    .select('*')
    .in('id', ids)
    .order('last_activity_at', { ascending: false });
  if (error || !data) return [];
  return data as ForumThreadRecord[];
}
