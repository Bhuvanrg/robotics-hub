# Supabase setup and verification

## 1) Env (.env.local)

- VITE_SUPABASE_URL=PROJECT-REF.supabase.co
- VITE_SUPABASE_ANON_KEY=ANON-KEY
- Optional: YOUTUBE_API_KEY=API-KEY (for news ingestion)

## 2) Verify from repo root

- Run: `npm run -s verify:supabase`
  - Ensures public tables and storage are reachable.

## 3) Apply migrations (if sources/feed_items missing)

- In Supabase SQL Editor run: `supabase/migrations/20250824090101_news_feed.sql`
- If initial schema is missing, run `20240101*.sql` in order.

## 4) Edge Functions

- news-ingest: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY
- weekly-digest: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM
- Deploy, then schedule: ingestion hourly, digest weekly

## 5) Troubleshooting

- If verify fails on sources/feed_items: the migration isn’t applied to the project in `.env.local`.
- YouTube sources: `channel_handle` is auto-resolved to `channel_id` on first run when YOUTUBE_API_KEY is set.
