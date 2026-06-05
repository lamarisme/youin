DROP POLICY IF EXISTS mark_comments_delete_own ON public.mark_comments;
--> statement-breakpoint
CREATE POLICY mark_comments_delete_own ON public.mark_comments
  FOR DELETE TO authenticated
  USING (
    author_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = mark_comments.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS mark_images_update_owner ON storage.objects;
--> statement-breakpoint
CREATE POLICY mark_images_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND owner = (SELECT auth.uid())
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'mark-images'
    AND owner = (SELECT auth.uid())
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
  );
--> statement-breakpoint
DROP POLICY IF EXISTS mark_images_delete_owner ON storage.objects;
--> statement-breakpoint
CREATE POLICY mark_images_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND owner = (SELECT auth.uid())
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
  );
