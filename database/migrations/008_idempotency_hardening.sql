-- 008_idempotency_hardening.sql
-- Purpose: Make schema objects from earlier migrations safely re-runnable.
-- - Ensure foreign keys that couldn't be created early are in place.
-- - Create triggers only if missing.
-- - Create RLS policies only if missing (works on PG versions without IF NOT EXISTS).
-- - Reaffirm RLS enabled on relevant tables.

-- ========= Foreign keys =========
-- Ensure forum_threads.answered_reply_id FK exists (added after both tables exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'answered_reply_id'
    WHERE n.nspname = 'public'
      AND t.relname = 'forum_threads'
      AND c.contype = 'f'
      AND rt.relname = 'thread_replies'
      AND a.attnum = ANY (c.conkey)
  ) THEN
    ALTER TABLE public.forum_threads
      ADD CONSTRAINT fk_forum_threads_answered_reply
      FOREIGN KEY (answered_reply_id) REFERENCES public.thread_replies(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END$$;

-- ========= Triggers: updated_at =========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_feed_posts_updated_at') THEN
    CREATE TRIGGER trg_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_forum_threads_updated_at') THEN
    CREATE TRIGGER trg_forum_threads_updated_at BEFORE UPDATE ON public.forum_threads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_thread_replies_updated_at') THEN
    CREATE TRIGGER trg_thread_replies_updated_at BEFORE UPDATE ON public.thread_replies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

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

-- ========= Triggers: counters/metrics =========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_feed_post_reactions_sync') THEN
    CREATE TRIGGER trg_feed_post_reactions_sync AFTER INSERT OR DELETE ON public.feed_post_reactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_feed_like_count();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_thread_replies_metrics') THEN
    CREATE TRIGGER trg_thread_replies_metrics AFTER INSERT OR DELETE ON public.thread_replies
    FOR EACH ROW EXECUTE FUNCTION public.sync_thread_reply_metrics();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_forum_threads_answer_flag') THEN
    CREATE TRIGGER trg_forum_threads_answer_flag AFTER UPDATE OF answered_reply_id ON public.forum_threads
    FOR EACH ROW EXECUTE FUNCTION public.sync_answer_flags();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_rsvps_sync') THEN
    CREATE TRIGGER trg_event_rsvps_sync AFTER INSERT OR DELETE ON public.event_rsvps
    FOR EACH ROW EXECUTE FUNCTION public.sync_event_attendee_count();
  END IF;
END $$;

-- ========= Triggers: tag normalization =========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_feed_posts_normalize_tags') THEN
    CREATE TRIGGER trg_feed_posts_normalize_tags BEFORE INSERT OR UPDATE ON public.feed_posts
    FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_forum_threads_normalize_tags') THEN
    CREATE TRIGGER trg_forum_threads_normalize_tags BEFORE INSERT OR UPDATE ON public.forum_threads
    FOR EACH ROW EXECUTE FUNCTION public.normalize_tags_lower();
  END IF;
END $$;

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

-- ========= RLS enable (safe to repeat) =========
ALTER TABLE public.feed_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_replies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS storage.objects  ENABLE ROW LEVEL SECURITY;

-- ========= Policies: create if missing =========
-- helper macro-ish note: we check pg_policies to avoid duplicate CREATEs

-- Feed Posts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_select') THEN
    CREATE POLICY "feed_posts_select" ON public.feed_posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_insert') THEN
    CREATE POLICY "feed_posts_insert" ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_update') THEN
    CREATE POLICY "feed_posts_update" ON public.feed_posts FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_posts' AND policyname='feed_posts_delete') THEN
    CREATE POLICY "feed_posts_delete" ON public.feed_posts FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

-- Feed Post Reactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_select') THEN
    CREATE POLICY "feed_post_reactions_select" ON public.feed_post_reactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_insert') THEN
    CREATE POLICY "feed_post_reactions_insert" ON public.feed_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feed_post_reactions' AND policyname='feed_post_reactions_delete') THEN
    CREATE POLICY "feed_post_reactions_delete" ON public.feed_post_reactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Forum Threads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_select') THEN
    CREATE POLICY "forum_threads_select" ON public.forum_threads FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_insert') THEN
    CREATE POLICY "forum_threads_insert" ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_update') THEN
    CREATE POLICY "forum_threads_update" ON public.forum_threads FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='forum_threads' AND policyname='forum_threads_delete') THEN
    CREATE POLICY "forum_threads_delete" ON public.forum_threads FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

-- Thread Replies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_select') THEN
    CREATE POLICY "thread_replies_select" ON public.thread_replies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_insert') THEN
    CREATE POLICY "thread_replies_insert" ON public.thread_replies FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_update') THEN
    CREATE POLICY "thread_replies_update" ON public.thread_replies FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='thread_replies' AND policyname='thread_replies_delete') THEN
    CREATE POLICY "thread_replies_delete" ON public.thread_replies FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

-- Events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_select') THEN
    CREATE POLICY "events_select" ON public.events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_insert') THEN
    CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_update') THEN
    CREATE POLICY "events_update" ON public.events FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_delete') THEN
    CREATE POLICY "events_delete" ON public.events FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- Event RSVPs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_select') THEN
    CREATE POLICY "event_rsvps_select" ON public.event_rsvps FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_insert') THEN
    CREATE POLICY "event_rsvps_insert" ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_delete') THEN
    CREATE POLICY "event_rsvps_delete" ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Learning Resources
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_select') THEN
    CREATE POLICY "learning_resources_select" ON public.learning_resources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_insert') THEN
    CREATE POLICY "learning_resources_insert" ON public.learning_resources FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_update') THEN
    CREATE POLICY "learning_resources_update" ON public.learning_resources FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_resources' AND policyname='learning_resources_delete') THEN
    CREATE POLICY "learning_resources_delete" ON public.learning_resources FOR DELETE USING (auth.uid() = author_id);
  END IF;
END $$;

-- User Profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_select_public') THEN
    CREATE POLICY "user_profiles_select_public" ON public.user_profiles FOR SELECT USING (public_profile = true OR auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_insert') THEN
    CREATE POLICY "user_profiles_insert" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_update') THEN
    CREATE POLICY "user_profiles_update" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_delete') THEN
    CREATE POLICY "user_profiles_delete" ON public.user_profiles FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Saved Items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='saved_items' AND policyname='saved_items_rw') THEN
    CREATE POLICY "saved_items_rw" ON public.saved_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Storage: avatars bucket policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read avatars') THEN
    CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner insert') THEN
    CREATE POLICY "Avatar owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner update') THEN
    CREATE POLICY "Avatar owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%')) WITH CHECK (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner delete') THEN
    CREATE POLICY "Avatar owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
  END IF;
END $$;
