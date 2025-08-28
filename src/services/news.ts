// News feed service: client-side wrappers around Supabase tables created by 009_news_feed.sql
import { supabase } from '@/lib/supabase';

export type Program = 'fll' | 'ftc' | 'frc' | 'general';
export type Level = 'middle' | 'high' | 'general';
export type ItemType = 'news' | 'tutorial' | 'highlight' | 'event' | 'research';

export interface FeedItem {
  id: string;
  source_id: number;
  external_id: string;
  title: string;
  url: string;
  published_at: string;
  author?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  media_url?: string | null;
  program: Program;
  type: ItemType;
  level: Level;
  region?: string | null;
  score: number;
  hash: string;
  created_at: string;
  tags?: string[];
  source?: { id: number; name: string; type: 'rss' | 'youtube'; program?: Program };
  liked?: boolean;
  saved?: boolean;
}

export interface FeedQuery {
  level?: Level;
  program?: Program; // legacy single-program filter
  programs?: Program[]; // preferred multi-program filter
  sourcePrograms?: Program[]; // restrict by source.program
  type?: ItemType;
  cursor?: string; // ISO published_at for pagination
  limit?: number;
  sourceId?: number;
}

type JoinedRow = FeedItem & { sources?: { id: number; name: string; type: 'rss' | 'youtube' } };

export async function getFeed({
  level,
  program,
  programs,
  sourcePrograms,
  type,
  cursor,
  limit = 24,
  sourceId,
}: FeedQuery) {
  let q = supabase
    .from('feed_items')
    .select('*, sources:source_id (id, name, type)')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (level) q = q.eq('level', level);
  if (Array.isArray(programs) && programs.length > 0) {
    q = q.in('program', programs);
  } else if (program) {
    q = q.eq('program', program);
  }
  if (type) q = q.eq('type', type);
  if (cursor) q = q.lt('published_at', cursor);
  if (sourceId) q = q.eq('source_id', sourceId);
  if (Array.isArray(sourcePrograms) && sourcePrograms.length > 0) {
    // Filter by joined source program (PostgREST dot path)
    // Note: supabase-js accepts this string path at runtime even if not typed
    q = (q as unknown as { in: (col: string, vals: unknown[]) => typeof q }).in(
      'sources.program',
      sourcePrograms
    ) as typeof q;
  }

  const { data, error } = await q;
  if (error || !data)
    return { items: [] as FeedItem[], nextCursor: undefined as string | undefined };

  const items = (data as JoinedRow[]).map((row) => ({
    ...row,
    source: row.sources
      ? { id: row.sources.id, name: row.sources.name, type: row.sources.type }
      : undefined,
  }));

  const nextCursor = items.length ? items[items.length - 1].published_at : undefined;
  return { items, nextCursor };
}

export async function getItem(id: string) {
  const { data } = await supabase
    .from('feed_items')
    .select('*, sources:source_id (id, name, type)')
    .eq('id', id)
    .single();
  if (!data) return null;
  const row = data as JoinedRow;
  return {
    ...row,
    source: row.sources
      ? {
          id: row.sources.id,
          name: row.sources.name,
          type: row.sources.type,
        }
      : undefined,
  } as FeedItem;
}

export async function postFeedback(
  itemId: string,
  action: 'view' | 'save' | 'like' | 'share' | 'hide'
) {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user?.id;
  if (!userId) return { ok: false, reason: 'unauthenticated' } as const;
  const { error } = await supabase
    .from('user_interactions')
    .insert({ user_id: userId, item_id: itemId, action });
  return { ok: !error } as const;
}

// Fetch multiple items by id (UUID) with source join
export async function fetchItemsByIds(ids: string[]): Promise<FeedItem[]> {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from('feed_items')
    .select('*, sources:source_id (id, name, type)')
    .in('id', ids);
  if (error || !data) return [];
  const rows = data as JoinedRow[];
  return rows.map((row) => ({
    ...row,
    source: row.sources
      ? { id: row.sources.id, name: row.sources.name, type: row.sources.type }
      : undefined,
  }));
}

export interface SourceRow {
  id: number;
  name: string;
  type: 'rss' | 'youtube';
  program?: Program;
}

export async function getSources(): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('id, name, type, enabled')
    .eq('enabled', true)
    .order('name', { ascending: true });
  if (error || !data) return [];
  type Row = { id: number; name: string; type: 'rss' | 'youtube'; enabled: boolean };
  return (data as Row[]).map((s) => ({ id: s.id, name: s.name, type: s.type }));
}

// Return saved news items (by user_interactions action='save') with created_at
export async function getSavedNews(
  userId: string
): Promise<{ id: string; when: string; title?: string }[]> {
  const { data, error } = await supabase
    .from('user_interactions')
    .select('item_id, created_at')
    .eq('user_id', userId)
    .eq('action', 'save')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const ids = (data as { item_id: string; created_at: string }[]).map((r) => r.item_id);
  const items = await fetchItemsByIds(ids);
  const titleMap = new Map(items.map((it) => [it.id, it.title]));
  return (data as { item_id: string; created_at: string }[]).map((r) => ({
    id: r.item_id,
    when: r.created_at,
    title: titleMap.get(r.item_id),
  }));
}
