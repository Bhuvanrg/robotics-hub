import { supabase } from '@/lib/supabase';

// Simple avatar upload helper. Expects a public bucket named 'avatars'.
// Returns a public URL (if bucket public) or a signed URL fallback.
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/png',
  });
  if (uploadErr) return null;
  // Try public URL first
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  if (pub?.publicUrl) return pub.publicUrl;
  // Fallback to signed URL
  const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  return signed?.signedUrl || null;
}

export async function getAvatarUrl(userId: string): Promise<string | null> {
  // Attempt to enumerate known extensions (cheap HEAD not available through client yet).
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  for (const ext of exts) {
    const path = `${userId}/avatar.${ext}`;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    if (data?.publicUrl) return data.publicUrl;
  }
  return null;
}
