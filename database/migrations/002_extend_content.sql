-- 002_extend_content.sql
-- Adds Events, Learning Resources, and User Profiles persistence + RLS
-- Keeps style consistent with 001 (idempotent-ish creation patterns)

-- EVENTS
create table if not exists public.events (
  id              bigserial primary key,
  title           text not null check (char_length(title) between 1 and 160),
  description     text,
  date            text not null,                 -- cached pretty date string (redundant)
  "fullDate"      timestamptz not null,          -- camelCase preserved for frontend compatibility
  time            text not null,                 -- e.g. "5:00 PM - 7:00 PM"
  location        text not null,                 -- venue or online label
  city            text not null,
  state           text not null,
  type            text not null default 'meetup',
  isOnline        boolean not null default false,
  organizer       text not null,
  attendees       integer not null default 0 check (attendees >= 0), -- denormalized counter
  maxAttendees    integer not null default 100 check (maxAttendees > 0),
  tags            text[] not null default '{}',
  skillLevel      text not null default 'all',
  created_by      uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Optional RSVP join for accuracy & future personalization
create table if not exists public.event_rsvps (
  event_id   bigint references public.events(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- LEARNING RESOURCES
create table if not exists public.learning_resources (
  id             bigserial primary key,
  author_id      uuid references auth.users(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 180),
  description    text not null,
  type           text not null default 'article',          -- article | video | pdf | guide | tutorial | other
  difficulty     text not null default 'all',              -- beginner | intermediate | advanced | all
  rating         numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  views          integer not null default 0 check (views >= 0),
  tags           text[] not null default '{}',
  category       text not null default 'general',
  "publishDate"  timestamptz,                             -- when originally published (nullable)
  durationMinutes integer,                                 -- for video / workshop
  readTimeMinutes integer,                                 -- for articles / guides
  pages          integer check (pages is null or pages > 0), -- for PDFs / books
  url            text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- USER PROFILES / PREFERENCES (extending auth.users)
create table if not exists public.user_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  bio                 text,
  location            text,
  team                text,
  interests           text[] not null default '{}',
  show_in_team_finder boolean not null default true,
  public_profile      boolean not null default true,
  email_notifications boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_events_full_date on public.events ("fullDate" asc);
create index if not exists idx_events_type on public.events (type);
create index if not exists idx_events_city_state on public.events (city, state);
create index if not exists idx_events_tags_gin on public.events using gin (tags);
create index if not exists idx_event_rsvps_user on public.event_rsvps (user_id);

create index if not exists idx_learning_resources_created on public.learning_resources (created_at desc);
create index if not exists idx_learning_resources_author on public.learning_resources (author_id);
create index if not exists idx_learning_resources_category on public.learning_resources (category);
create index if not exists idx_learning_resources_tags_gin on public.learning_resources using gin (tags);

-- Reuse existing updated_at trigger function (set_updated_at) from 001
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated_at') THEN
    CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_learning_resources_updated_at') THEN
    CREATE TRIGGER trg_learning_resources_updated_at BEFORE UPDATE ON public.learning_resources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_updated_at') THEN
    CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RSVP attendee count maintenance
create or replace function public.sync_event_attendee_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.events set attendees = attendees + 1 where id = new.event_id;
  elsif tg_op = 'DELETE' then
    update public.events set attendees = greatest(0, attendees - 1) where id = old.event_id;
  end if;
  return null;
end;$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_rsvps_sync') THEN
    CREATE TRIGGER trg_event_rsvps_sync AFTER INSERT OR DELETE ON public.event_rsvps
    FOR EACH ROW EXECUTE FUNCTION public.sync_event_attendee_count();
  END IF;
END $$;

-- Tag normalization for new tables (reuse normalize_tags_lower from 001)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_normalize_tags') THEN
    CREATE TRIGGER trg_events_normalize_tags BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_learning_resources_normalize_tags') THEN
    CREATE TRIGGER trg_learning_resources_normalize_tags BEFORE INSERT OR UPDATE ON public.learning_resources
    FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
  END IF;
END $$;

-- RLS ENABLE
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.learning_resources enable row level security;
alter table public.user_profiles enable row level security;

-- POLICIES (guarded for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_select') THEN
    CREATE POLICY events_select ON public.events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_insert') THEN
    CREATE POLICY events_insert ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_update') THEN
    CREATE POLICY events_update ON public.events FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_delete') THEN
    CREATE POLICY events_delete ON public.events FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_select') THEN
    CREATE POLICY event_rsvps_select ON public.event_rsvps FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_insert') THEN
    CREATE POLICY event_rsvps_insert ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_delete') THEN
    CREATE POLICY event_rsvps_delete ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_select') THEN
    CREATE POLICY learning_resources_select ON public.learning_resources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_insert') THEN
    CREATE POLICY learning_resources_insert ON public.learning_resources FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_update') THEN
    CREATE POLICY learning_resources_update ON public.learning_resources FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_delete') THEN
    CREATE POLICY learning_resources_delete ON public.learning_resources FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_select_public') THEN
    CREATE POLICY user_profiles_select_public ON public.user_profiles FOR SELECT USING (public_profile = true OR auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_insert') THEN
    CREATE POLICY user_profiles_insert ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_update') THEN
    CREATE POLICY user_profiles_update ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_delete') THEN
    CREATE POLICY user_profiles_delete ON public.user_profiles FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- END 002
