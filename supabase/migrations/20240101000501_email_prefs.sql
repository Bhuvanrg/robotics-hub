-- mirrored from database/migrations/005_email_prefs.sql
alter table public.user_profiles
  add column if not exists email_frequency text not null default 'weekly' check (email_frequency in ('daily','weekly','off')),
  add column if not exists last_digest_at timestamptz;
create index if not exists idx_user_profiles_last_digest_at on public.user_profiles (last_digest_at);
