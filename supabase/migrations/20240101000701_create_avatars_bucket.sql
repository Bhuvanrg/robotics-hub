-- mirrored from database/migrations/007_create_avatars_bucket.sql
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (select 1 from storage.buckets where id = 'avatars');
