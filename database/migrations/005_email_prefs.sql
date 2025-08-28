-- 005_email_prefs.sql
-- Email digest preferences and tracking

alter table public.user_profiles
  add column if not exists email_frequency text not null default 'weekly' check (email_frequency in ('daily','weekly','off')),
  add column if not exists last_digest_at timestamptz;

-- Optional index if you plan to filter by last_digest_at frequently
create index if not exists idx_user_profiles_last_digest_at on public.user_profiles (last_digest_at);
