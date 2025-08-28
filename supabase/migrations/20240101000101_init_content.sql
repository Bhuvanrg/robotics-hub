-- mirrored from database/migrations/001_init_content.sql
-- keep idempotent guards and triggers

-- FEED & FORUMS CORE
create table if not exists public.feed_posts (
  id             bigserial primary key,
  author_id      uuid references auth.users(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 160),
  body           text not null,
  tags           text[] not null default '{}',
  image_url      text,
  links          jsonb not null default '[]'::jsonb,
  like_count     integer not null default 0 check (like_count >= 0),
  comment_count  integer not null default 0 check (comment_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.feed_post_reactions (
  post_id    bigint references public.feed_posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.forum_threads (
  id                bigserial primary key,
  author_id         uuid references auth.users(id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 180),
  body              text not null,
  category          text not null default 'general',
  tags              text[] not null default '{}',
  is_pinned         boolean not null default false,
  answered_reply_id bigint,
  reply_count       integer not null default 0 check (reply_count >= 0),
  view_count        integer not null default 0 check (view_count >= 0),
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.thread_replies (
  id          bigserial primary key,
  thread_id   bigint references public.forum_threads(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete cascade,
  body        text not null,
  is_answer   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_feed_posts_created_at on public.feed_posts (created_at desc);
create index if not exists idx_feed_posts_author on public.feed_posts (author_id);
create index if not exists idx_feed_posts_tags_gin on public.feed_posts using gin (tags);
create index if not exists idx_feed_posts_links_gin on public.feed_posts using gin (links);
create index if not exists idx_feed_post_reactions_user on public.feed_post_reactions (user_id);
create index if not exists idx_forum_threads_last_activity on public.forum_threads (last_activity_at desc);
create index if not exists idx_forum_threads_author on public.forum_threads (author_id);
create index if not exists idx_forum_threads_category on public.forum_threads (category);
create index if not exists idx_forum_threads_tags_gin on public.forum_threads using gin (tags);
create index if not exists idx_thread_replies_thread on public.thread_replies (thread_id);
create index if not exists idx_thread_replies_author on public.thread_replies (author_id);
create index if not exists idx_thread_replies_created_at on public.thread_replies (created_at);

-- TRIGGER FUNCTIONS
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

create or replace function public.sync_feed_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.feed_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.feed_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end;$$;

create or replace function public.sync_thread_reply_metrics()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_threads set reply_count = reply_count + 1, last_activity_at = now() where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.forum_threads set reply_count = greatest(0, reply_count - 1), last_activity_at = now() where id = old.thread_id;
  end if;
  return null;
end;$$;

create or replace function public.sync_answer_flags()
returns trigger language plpgsql as $$
begin
  update public.thread_replies set is_answer = (id = new.answered_reply_id) where thread_id = new.id;
  return new;
end;$$;

create or replace function public.normalize_tags_lower()
returns trigger language plpgsql as $$
begin
  if new.tags is not null then
    new.tags := (select array_agg(distinct lower(trim(t))) from unnest(new.tags) as t where trim(t) <> '');
  end if;
  return new;
end;$$;

-- TRIGGERS (guarded)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_feed_posts_updated_at') THEN
  CREATE TRIGGER trg_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_forum_threads_updated_at') THEN
  CREATE TRIGGER trg_forum_threads_updated_at BEFORE UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_thread_replies_updated_at') THEN
  CREATE TRIGGER trg_thread_replies_updated_at BEFORE UPDATE ON public.thread_replies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_feed_post_reactions_sync') THEN
  CREATE TRIGGER trg_feed_post_reactions_sync AFTER INSERT OR DELETE ON public.feed_post_reactions FOR EACH ROW EXECUTE FUNCTION public.sync_feed_like_count();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_thread_replies_metrics') THEN
  CREATE TRIGGER trg_thread_replies_metrics AFTER INSERT OR DELETE ON public.thread_replies FOR EACH ROW EXECUTE FUNCTION public.sync_thread_reply_metrics();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_forum_threads_answer_flag') THEN
  CREATE TRIGGER trg_forum_threads_answer_flag AFTER UPDATE OF answered_reply_id ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.sync_answer_flags();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_feed_posts_normalize_tags') THEN
  CREATE TRIGGER trg_feed_posts_normalize_tags BEFORE INSERT OR UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_forum_threads_normalize_tags') THEN
  CREATE TRIGGER trg_forum_threads_normalize_tags BEFORE INSERT OR UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
END IF; END $$;

-- RLS ENABLE
alter table public.feed_posts enable row level security;
alter table public.feed_post_reactions enable row level security;
alter table public.forum_threads enable row level security;
alter table public.thread_replies enable row level security;

-- POLICIES (guarded via pg_policies)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_select') THEN
  CREATE POLICY feed_posts_select ON public.feed_posts FOR SELECT USING (true);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_insert') THEN
  CREATE POLICY feed_posts_insert ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_update') THEN
  CREATE POLICY feed_posts_update ON public.feed_posts FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_delete') THEN
  CREATE POLICY feed_posts_delete ON public.feed_posts FOR DELETE USING (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_select') THEN
  CREATE POLICY feed_post_reactions_select ON public.feed_post_reactions FOR SELECT USING (true);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_insert') THEN
  CREATE POLICY feed_post_reactions_insert ON public.feed_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_delete') THEN
  CREATE POLICY feed_post_reactions_delete ON public.feed_post_reactions FOR DELETE USING (auth.uid() = user_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_select') THEN
  CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT USING (true);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_insert') THEN
  CREATE POLICY forum_threads_insert ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_update') THEN
  CREATE POLICY forum_threads_update ON public.forum_threads FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_delete') THEN
  CREATE POLICY forum_threads_delete ON public.forum_threads FOR DELETE USING (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_select') THEN
  CREATE POLICY thread_replies_select ON public.thread_replies FOR SELECT USING (true);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_insert') THEN
  CREATE POLICY thread_replies_insert ON public.thread_replies FOR INSERT WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_update') THEN
  CREATE POLICY thread_replies_update ON public.thread_replies FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_delete') THEN
  CREATE POLICY thread_replies_delete ON public.thread_replies FOR DELETE USING (auth.uid() = author_id);
END IF; END $$;
