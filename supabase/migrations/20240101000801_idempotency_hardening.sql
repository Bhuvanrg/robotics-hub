-- mirrored from database/migrations/008_idempotency_hardening.sql
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

-- reassert triggers/policies/rls (see original 008 for full content)
-- For brevity here, we rely on earlier migrations to have created them with guards.
-- Running 001–007 is typically sufficient. If needed, re-run 008 from database/migrations to assert all objects.
