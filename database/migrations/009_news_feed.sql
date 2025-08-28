-- Robotics News Feed schema migration
-- Drops legacy project-sharing feed tables and introduces normalized news feed tables.

-- Safety: wrap in a transaction
begin;

-- 1) Drop legacy feed tables, triggers, and policies if they exist
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='feed_post_reactions') then
    execute 'drop table public.feed_post_reactions cascade';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='feed_posts') then
    execute 'drop table public.feed_posts cascade';
  end if;
end $$;

-- 2) Create new enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'source_type') then
    create type public.source_type as enum ('rss','youtube');
  end if;
  if not exists (select 1 from pg_type where typname = 'program_type') then
    create type public.program_type as enum ('fll','ftc','frc','general');
  end if;
  if not exists (select 1 from pg_type where typname = 'item_type') then
    create type public.item_type as enum ('news','tutorial','highlight','event','research');
  end if;
  if not exists (select 1 from pg_type where typname = 'level_type') then
    create type public.level_type as enum ('middle','high','general');
  end if;
end $$;

-- 3) sources
create table if not exists public.sources (
  id                 bigint generated always as identity primary key,
  name               text not null,
  type               public.source_type not null,
  url                text,
  channel_handle     text,
  channel_id         text,
  credibility_weight double precision not null default 1.0,
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint sources_url_or_channel check ((type = 'rss' and url is not null) or (type = 'youtube'))
);

-- 4) feed_items
create table if not exists public.feed_items (
  id               uuid primary key default gen_random_uuid(),
  source_id        bigint not null references public.sources(id) on delete cascade,
  external_id      text unique not null,
  title            text not null,
  url              text not null,
  published_at     timestamptz not null,
  author           text,
  excerpt          text,
  content_html     text,
  media_url        text,
  program          public.program_type not null default 'general',
  type             public.item_type not null default 'news',
  level            public.level_type not null default 'general',
  region           text,
  score            double precision not null default 0,
  hash             text unique not null,
  created_at       timestamptz not null default now()
);

-- 5) feed_tags
create table if not exists public.feed_tags (
  item_id uuid not null references public.feed_items(id) on delete cascade,
  tag     text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, tag)
);

-- 6) user_interactions
create table if not exists public.user_interactions (
  user_id   uuid not null,
  item_id   uuid not null references public.feed_items(id) on delete cascade,
  action    text not null check (action in ('view','save','like','share','hide')),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, action, created_at)
);

-- indices
create index if not exists idx_feed_items_published_at on public.feed_items (published_at desc);
create index if not exists idx_feed_items_source on public.feed_items (source_id);
create index if not exists idx_feed_items_program on public.feed_items (program);
create index if not exists idx_feed_items_type on public.feed_items (type);
create index if not exists idx_feed_items_level on public.feed_items (level);
create index if not exists idx_user_interactions_item on public.user_interactions (item_id);
create index if not exists idx_user_interactions_user on public.user_interactions (user_id);

-- updated_at trigger for sources
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sources_updated_at') then
    create trigger trg_sources_updated_at before update on public.sources
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.sources enable row level security;
alter table public.feed_items enable row level security;
alter table public.feed_tags enable row level security;
alter table public.user_interactions enable row level security;

-- Policies: public read for sources/feed_items/tags; writes by service role only.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='sources' and policyname='sources_select') then
    create policy sources_select on public.sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='feed_items' and policyname='feed_items_select') then
    create policy feed_items_select on public.feed_items for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='feed_tags' and policyname='feed_tags_select') then
    create policy feed_tags_select on public.feed_tags for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_interactions' and policyname='user_interactions_user_rw') then
    create policy user_interactions_user_rw on public.user_interactions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- 7) Seed default sources (idempotent upserts by unique natural keys)
insert into public.sources (name, type, url, credibility_weight)
values
  ('Robohub', 'rss', 'https://robohub.org/feed', 1.0),
  ('The Robot Report', 'rss', 'https://www.therobotreport.com/feed', 1.0),
  ('Make Magazine – Technology', 'rss', 'https://makezine.com/category/technology/feed', 1.0)
on conflict do nothing;

insert into public.sources (name, type, channel_handle, credibility_weight)
values
  ('OfficialFIRST', 'youtube', 'OfficialFIRST', 1.0),
  ('FIRST Robotics Competition', 'youtube', 'FIRSTRoboticsCompetition', 1.0),
  ('FIRST Tech Challenge', 'youtube', 'FIRSTTechChallenge', 1.0),
  ('FIRST LEGO League', 'youtube', 'FIRSTLEGOLeagueofficial', 1.0)
on conflict do nothing;

commit;
