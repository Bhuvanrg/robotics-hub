-- Robotics News Feed schema migration (Supabase)
-- Drops legacy project-sharing feed tables and introduces normalized news feed tables.

begin;

-- Drop legacy tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='feed_post_reactions') THEN
    EXECUTE 'DROP TABLE public.feed_post_reactions CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='feed_posts') THEN
    EXECUTE 'DROP TABLE public.feed_posts CASCADE';
  END IF;
END $$;

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='source_type') THEN
    CREATE TYPE public.source_type AS ENUM ('rss','youtube');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='program_type') THEN
    CREATE TYPE public.program_type AS ENUM ('fll','ftc','frc','general');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='item_type') THEN
    CREATE TYPE public.item_type AS ENUM ('news','tutorial','highlight','event','research');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='level_type') THEN
    CREATE TYPE public.level_type AS ENUM ('middle','high','general');
  END IF;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.sources (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               TEXT NOT NULL,
  type               public.source_type NOT NULL,
  url                TEXT,
  channel_handle     TEXT,
  channel_id         TEXT,
  credibility_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sources_url_or_channel CHECK ((type = 'rss' AND url IS NOT NULL) OR (type = 'youtube'))
);

CREATE TABLE IF NOT EXISTS public.feed_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        BIGINT NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  external_id      TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  url              TEXT NOT NULL,
  published_at     TIMESTAMPTZ NOT NULL,
  author           TEXT,
  excerpt          TEXT,
  content_html     TEXT,
  media_url        TEXT,
  program          public.program_type NOT NULL DEFAULT 'general',
  type             public.item_type NOT NULL DEFAULT 'news',
  level            public.level_type NOT NULL DEFAULT 'general',
  region           TEXT,
  score            DOUBLE PRECISION NOT NULL DEFAULT 0,
  hash             TEXT UNIQUE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feed_tags (
  item_id UUID NOT NULL REFERENCES public.feed_items(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, tag)
);

CREATE TABLE IF NOT EXISTS public.user_interactions (
  user_id   UUID NOT NULL,
  item_id   UUID NOT NULL REFERENCES public.feed_items(id) ON DELETE CASCADE,
  action    TEXT NOT NULL CHECK (action IN ('view','save','like','share','hide')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id, action, created_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_items_published_at ON public.feed_items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_source ON public.feed_items (source_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_program ON public.feed_items (program);
CREATE INDEX IF NOT EXISTS idx_feed_items_type ON public.feed_items (type);
CREATE INDEX IF NOT EXISTS idx_feed_items_level ON public.feed_items (level);
CREATE INDEX IF NOT EXISTS idx_user_interactions_item ON public.user_interactions (item_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON public.user_interactions (user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_sources_updated_at') THEN
    CREATE TRIGGER trg_sources_updated_at BEFORE UPDATE ON public.sources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sources' AND policyname='sources_select') THEN
    CREATE POLICY sources_select ON public.sources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_items' AND policyname='feed_items_select') THEN
    CREATE POLICY feed_items_select ON public.feed_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_tags' AND policyname='feed_tags_select') THEN
    CREATE POLICY feed_tags_select ON public.feed_tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_interactions' AND policyname='user_interactions_user_rw') THEN
    CREATE POLICY user_interactions_user_rw ON public.user_interactions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Seeds
INSERT INTO public.sources (name, type, url, credibility_weight)
VALUES
  ('Robohub', 'rss', 'https://robohub.org/feed', 1.0),
  ('The Robot Report', 'rss', 'https://www.therobotreport.com/feed', 1.0),
  ('Make Magazine – Technology', 'rss', 'https://makezine.com/category/technology/feed', 1.0)
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, type, channel_handle, credibility_weight)
VALUES
  ('OfficialFIRST', 'youtube', 'OfficialFIRST', 1.0),
  ('FIRST Robotics Competition', 'youtube', 'FIRSTRoboticsCompetition', 1.0),
  ('FIRST Tech Challenge', 'youtube', 'FIRSTTechChallenge', 1.0),
  ('FIRST LEGO League', 'youtube', 'FIRSTLEGOLeagueofficial', 1.0)
ON CONFLICT DO NOTHING;

commit;
