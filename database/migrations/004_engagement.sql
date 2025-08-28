-- 004_engagement.sql
-- Engagement-focused additions: followed_tags & saved_items

-- Add followed_tags to user_profiles for personalized feeds
alter table public.user_profiles
  add column if not exists followed_tags text[] not null default '{}';

-- Saved items (bookmarks) for feed posts and forum threads
create table if not exists public.saved_items (
  user_id    uuid references auth.users(id) on delete cascade,
  item_type  text not null check (item_type in ('feed_post','forum_thread')),
  item_id    bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.saved_items enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='saved_items' AND policyname='saved_items_rw') THEN
    CREATE POLICY saved_items_rw ON public.saved_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

create index if not exists idx_saved_items_user_type on public.saved_items (user_id, item_type);
create index if not exists idx_saved_items_item on public.saved_items (item_type, item_id);
