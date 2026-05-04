/*
  Run AFTER rls-and-auth.sql.

  Creates the `mark-images` private bucket and RLS policies that scope
  read/write to the workspace identified by the first path segment, e.g.
  `<workspace_id>/<mark_id>/<uuid>.<ext>`.

  Reuses the existing public.user_workspace_member(uuid) helper.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('mark-images', 'mark-images', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop old policies if re-running.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'mark_images_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY mark_images_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY mark_images_insert_member ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mark-images'
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY mark_images_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'mark-images'
    AND owner = auth.uid()
  );

CREATE POLICY mark_images_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND owner = auth.uid()
  );
