-- 007_create_avatars_bucket.sql
-- Ensure a public 'avatars' storage bucket exists (idempotent)

-- Create bucket if it doesn't exist yet
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (select 1 from storage.buckets where id = 'avatars');

-- Note: RLS policies for avatars are defined in 006_storage_avatars.sql
