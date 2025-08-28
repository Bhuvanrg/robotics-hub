-- mirrored from database/migrations/006_storage_avatars.sql
-- Note: storage.objects already has RLS enabled by Supabase; altering requires table owner.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read avatars') THEN
  CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner insert') THEN
  CREATE POLICY "Avatar owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner update') THEN
  CREATE POLICY "Avatar owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%')) WITH CHECK (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar owner delete') THEN
  CREATE POLICY "Avatar owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND name LIKE (auth.uid()::text || '/%'));
END IF; END $$;
