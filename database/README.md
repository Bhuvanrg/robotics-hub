# Database migrations

These plain-SQL migrations are designed to be safe to re-run (idempotent-ish) and support ongoing schema evolution.

## Files and order

1. 001_init_content.sql — core feed/forums schema, triggers, policies
2. 002_extend_content.sql — events, learning resources, user profiles
3. 003_add_avatar_url.sql — profile avatar_url
4. 004_engagement.sql — followed_tags + saved_items
5. 005_email_prefs.sql — email digest prefs/last_digest
6. 006_storage_avatars.sql — storage RLS policies for avatars bucket
7. 007_create_avatars_bucket.sql — create avatars bucket if missing
8. 008_idempotency_hardening.sql — asserts triggers/policies/FKs exist

## Apply (options)

- Supabase SQL editor: run files in order (safe to re-run).
- Supabase CLI (optional):

```powershell
# From repo root (examples)
# Apply a single migration file to your project
supabase db execute --file .\database\migrations\007_create_avatars_bucket.sql

# Or push local migrations to a shadow db (advanced workflows)
supabase db push
```

## Patterns we follow

- CREATE TABLE IF NOT EXISTS for new tables.
- ALTER TABLE ... ADD COLUMN IF NOT EXISTS when adding fields.
- CREATE OR REPLACE FUNCTION for trigger functions.
- Triggers created only if missing (check pg_trigger by name).
- Policies created only if missing (check pg_policies by name) to support PG versions without IF NOT EXISTS.
- Indexes: CREATE INDEX IF NOT EXISTS.
- Storage: create buckets with an idempotent INSERT ... WHERE NOT EXISTS; policies live separately.

## Notes

- RLS is enabled across tables; policies are defined and hardened in migrations.
- Triggers maintain counters and timestamps; tag normalization applied on write.
- Email digest fields live in `user_profiles` (email_frequency, last_digest_at).
