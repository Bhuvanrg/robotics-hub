-- 003_add_avatar_url.sql
-- Adds avatar_url column to user_profiles and (optionally) future index

alter table public.user_profiles
  add column if not exists avatar_url text;

-- No extra index needed; lookups are by primary key user_id.
-- RLS policies already cover user_profiles; no change required.

-- Updating updated_at handled by existing trigger.
