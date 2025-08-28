import { supabase } from '@/lib/supabase';
// import { getFollowedTags } from './engagement';

const LS_LAST_SEEN = 'rh.lastSeenAt';

export function getLastSeen(): string {
  return localStorage.getItem(LS_LAST_SEEN) || new Date(0).toISOString();
}

export function setLastSeen(date = new Date()) {
  localStorage.setItem(LS_LAST_SEEN, date.toISOString());
}

export async function getNewCounts(_userId?: string | null) {
  const since = getLastSeen();
  let feedCount = 0;
  let forumCount = 0;

  // News Feed: count new items since last seen (future: join tags once available)
  const { count: feedC } = await supabase
    .from('feed_items')
    .select('id', { count: 'exact', head: true })
    .gte('published_at', since);
  feedCount = feedC || 0;

  // Forums: new threads since last seen
  const { count: fcount } = await supabase
    .from('forum_threads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  forumCount = fcount || 0;

  return { feedCount, forumCount };
}
