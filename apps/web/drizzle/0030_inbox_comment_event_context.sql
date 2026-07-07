CREATE OR REPLACE FUNCTION public.log_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mark_events (workspace_id, mark_id, actor_user_id, type, metadata)
  SELECT m.workspace_id, NEW.mark_id, NEW.author_user_id, 'comment_added',
         jsonb_build_object(
           'commentId', NEW.id,
           'summary',
           CASE NEW.type::text
             WHEN 'image' THEN 'Image comment added.'
             ELSE 'Text comment added.'
           END
         )
  FROM public.marks m WHERE m.id = NEW.mark_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.log_comment_added() FROM PUBLIC;
