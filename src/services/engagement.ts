import { supabase } from '@/lib/supabase';

export type SavedItemType = 'feed_post' | 'forum_thread';
export interface SavedItem {
  user_id: string;
  item_type: SavedItemType;
  item_id: number;
  created_at: string;
}

export async function toggleSaveItem(userId: string, type: SavedItemType, itemId: number) {
  const { data } = await supabase
    .from('saved_items')
    .select('*')
    .eq('user_id', userId)
    .eq('item_type', type)
    .eq('item_id', itemId)
    .maybeSingle();
  if (data) {
    await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('item_type', type)
      .eq('item_id', itemId);
    return { saved: false } as const;
  }
  const { error } = await supabase
    .from('saved_items')
    .insert({ user_id: userId, item_type: type, item_id: itemId });
  if (error) return { saved: false } as const;
  return { saved: true } as const;
}

export async function getSavedItems(userId: string, type?: SavedItemType): Promise<SavedItem[]> {
  let q = supabase
    .from('saved_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (type) q = q.eq('item_type', type);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as SavedItem[];
}

export async function setFollowedTags(userId: string, tags: string[]) {
  const clean = Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  const { error } = await supabase
    .from('user_profiles')
    .update({ followed_tags: clean })
    .eq('user_id', userId);
  return !error;
}

export async function getFollowedTags(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_profiles')
    .select('followed_tags')
    .eq('user_id', userId)
    .single();
  return (data?.followed_tags as string[]) || [];
}
