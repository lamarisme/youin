-- Drop the marks.linear_url column. It was loaded into the workspace bundle
-- but never rendered in any component. The trigger logic in 0003 also references
-- the column, so we recreate the trigger function without the linear_link branch.

DROP TRIGGER IF EXISTS marks_log_change ON public.marks;--> statement-breakpoint

ALTER TABLE "marks" DROP COLUMN IF EXISTS "linear_url";--> statement-breakpoint

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

CREATE TRIGGER marks_log_change
AFTER INSERT OR UPDATE ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.log_mark_change();
