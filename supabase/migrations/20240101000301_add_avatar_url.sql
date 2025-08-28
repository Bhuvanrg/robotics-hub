-- mirrored from database/migrations/003_add_avatar_url.sql
alter table public.user_profiles add column if not exists avatar_url text;
