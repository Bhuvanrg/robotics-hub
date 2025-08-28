import { supabase } from '@/lib/supabase';

export interface LearningResourceRecord {
  id: number;
  author_id: string | null;
  title: string;
  description: string;
  type: string; // video | article | pdf | etc.
  difficulty: string; // Beginner | Intermediate | Advanced | all
  rating: number;
  views: number;
  tags: string[] | null;
  category: string;
  publishDate: string | null; // ISO
  durationMinutes: number | null;
  readTimeMinutes: number | null;
  pages: number | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'learning_resources';

export async function fetchLearningResources(): Promise<LearningResourceRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as LearningResourceRecord[];
}

export interface NewLearningResourceInput {
  title: string;
  description: string;
  type: 'video' | 'article' | 'pdf';
  difficulty: string;
  tags: string[];
  category: string;
  publishDate?: Date | null;
  durationMinutes?: number | null;
  readTimeMinutes?: number | null;
  pages?: number | null;
  url?: string | null;
  author_id?: string | null;
}

export async function createLearningResource(input: NewLearningResourceInput) {
  // Ensure user is signed in so RLS insert policy passes (auth.uid() = author_id)
  const { data: sessionRes } = await supabase.auth.getSession();
  const userId = sessionRes?.session?.user?.id ?? null;
  if (!userId) {
    throw new Error('You must be signed in to add a resource.');
  }
  const payload = {
    ...input,
    author_id: userId,
    publishDate: input.publishDate ? input.publishDate.toISOString() : null,
    rating: 0,
    views: 0,
  };
  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return data as LearningResourceRecord;
}
