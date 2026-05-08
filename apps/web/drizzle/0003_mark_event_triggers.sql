-- =============================================================================
-- Move event-log writes off the application code and onto Postgres triggers.
--
-- Every mutation in workspace-actions used to manually insert a mark_events
-- row alongside the actual change. Triggers are simpler, harder to forget,
-- and run inside the same transaction as the change itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_mark_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by_user_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.mark_events (workspace_id, mark_id, actor_user_id, type, metadata)
    VALUES (
      NEW.workspace_id, NEW.id, v_actor, 'created'::mark_event_type,
      jsonb_build_object('summary', 'Mark created.')
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'status_changed',
            OLD.status::text, NEW.status::text);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'priority_changed',
            OLD.priority::text, NEW.priority::text);
  END IF;

  IF NEW.pinned IS DISTINCT FROM OLD.pinned THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'pinned_changed',
            OLD.pinned::text, NEW.pinned::text);
  END IF;

  IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'assignee_changed',
            OLD.assignee_user_id::text, NEW.assignee_user_id::text);
  END IF;

  IF NEW.linear_url IS DISTINCT FROM OLD.linear_url THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'linear_link_updated',
            COALESCE(OLD.linear_url, ''), COALESCE(NEW.linear_url, ''));
  END IF;

  IF NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value, metadata)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'label_changed',
            OLD.space_id::text, NEW.space_id::text,
            jsonb_build_object('summary', 'Moved to a different space.'));
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS marks_log_change ON public.marks;--> statement-breakpoint
CREATE TRIGGER marks_log_change
AFTER INSERT OR UPDATE ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.log_mark_change();
--> statement-breakpoint

-- Comment additions get their own trigger because they touch a different table.
CREATE OR REPLACE FUNCTION public.log_comment_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mark_events (workspace_id, mark_id, actor_user_id, type, metadata)
  SELECT m.workspace_id, NEW.mark_id, NEW.author_user_id, 'comment_added',
         jsonb_build_object(
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
DROP TRIGGER IF EXISTS mark_comments_log_added ON public.mark_comments;--> statement-breakpoint
CREATE TRIGGER mark_comments_log_added
AFTER INSERT ON public.mark_comments
FOR EACH ROW EXECUTE FUNCTION public.log_comment_added();
