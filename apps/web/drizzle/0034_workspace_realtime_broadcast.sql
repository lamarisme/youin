ALTER TABLE "mark_comments" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "marks_to_labels" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint

UPDATE "mark_comments" AS comment
SET "workspace_id" = mark."workspace_id"
FROM "marks" AS mark
WHERE mark."id" = comment."mark_id";--> statement-breakpoint

UPDATE "marks_to_labels" AS link
SET "workspace_id" = mark."workspace_id"
FROM "marks" AS mark
WHERE mark."id" = link."mark_id";--> statement-breakpoint

ALTER TABLE "mark_comments" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "marks_to_labels" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "marks_workspace_id_id_unique"
  ON "marks" USING btree ("workspace_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "mark_labels_workspace_id_id_unique"
  ON "mark_labels" USING btree ("workspace_id", "id");--> statement-breakpoint
CREATE INDEX "mark_comments_workspace_idx"
  ON "mark_comments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "marks_to_labels_workspace_idx"
  ON "marks_to_labels" USING btree ("workspace_id");--> statement-breakpoint

ALTER TABLE "mark_comments"
  ADD CONSTRAINT "mark_comments_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks_to_labels"
  ADD CONSTRAINT "marks_to_labels_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark_comments"
  ADD CONSTRAINT "mark_comments_mark_workspace_fk"
  FOREIGN KEY ("workspace_id", "mark_id")
  REFERENCES "public"."marks"("workspace_id", "id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks_to_labels"
  ADD CONSTRAINT "marks_to_labels_mark_workspace_fk"
  FOREIGN KEY ("workspace_id", "mark_id")
  REFERENCES "public"."marks"("workspace_id", "id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks_to_labels"
  ADD CONSTRAINT "marks_to_labels_label_workspace_fk"
  FOREIGN KEY ("workspace_id", "label_id")
  REFERENCES "public"."mark_labels"("workspace_id", "id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

DROP POLICY IF EXISTS marks_to_labels_select ON public.marks_to_labels;--> statement-breakpoint
DROP POLICY IF EXISTS marks_to_labels_write ON public.marks_to_labels;--> statement-breakpoint
DROP POLICY IF EXISTS marks_to_labels_delete ON public.marks_to_labels;--> statement-breakpoint
CREATE POLICY marks_to_labels_select ON public.marks_to_labels
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY marks_to_labels_write ON public.marks_to_labels
  FOR INSERT TO authenticated
  WITH CHECK (public.user_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY marks_to_labels_delete ON public.marks_to_labels
  FOR DELETE TO authenticated
  USING (public.user_workspace_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS mark_comments_select ON public.mark_comments;--> statement-breakpoint
DROP POLICY IF EXISTS mark_comments_insert ON public.mark_comments;--> statement-breakpoint
DROP POLICY IF EXISTS mark_comments_delete_own ON public.mark_comments;--> statement-breakpoint
CREATE POLICY mark_comments_select ON public.mark_comments
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));--> statement-breakpoint
CREATE POLICY mark_comments_insert ON public.mark_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint
CREATE POLICY mark_comments_delete_own ON public.mark_comments
  FOR DELETE TO authenticated
  USING (
    author_user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.broadcast_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_row jsonb;
  changed_workspace_id text;
BEGIN
  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  changed_workspace_id := changed_row ->> 'workspace_id';
  IF changed_workspace_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
      'change',
      'workspace:' || changed_workspace_id,
      true
    );
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.broadcast_workspace_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_row jsonb;
  changed_workspace_id text;
BEGIN
  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  changed_workspace_id := changed_row ->> 'id';
  IF changed_workspace_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
      'change',
      'workspace:' || changed_workspace_id,
      true
    );
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.broadcast_profile_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_row jsonb;
  changed_user_id uuid;
  member_workspace_id uuid;
BEGIN
  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  changed_user_id := (changed_row ->> 'id')::uuid;
  FOR member_workspace_id IN
    SELECT member.workspace_id
    FROM public.workspace_members AS member
    WHERE member.user_id = changed_user_id
  LOOP
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
      'change',
      'workspace:' || member_workspace_id::text,
      true
    );
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.broadcast_inbox_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_row jsonb;
  changed_workspace_id text;
  recipient_user_id text;
BEGIN
  changed_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  changed_workspace_id := changed_row ->> 'workspace_id';
  recipient_user_id := COALESCE(
    changed_row ->> 'recipient_user_id',
    changed_row ->> 'user_id'
  );
  IF changed_workspace_id IS NOT NULL AND recipient_user_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
      'change',
      'workspace:' || changed_workspace_id || ':user:' || recipient_user_id,
      true
    );
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.broadcast_workspace_change() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.broadcast_workspace_identity_change() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.broadcast_profile_workspace_change() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.broadcast_inbox_change() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

CREATE TRIGGER broadcast_workspaces_change
  AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_identity_change();--> statement-breakpoint
CREATE TRIGGER broadcast_profiles_change
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_profile_workspace_change();--> statement-breakpoint

CREATE TRIGGER broadcast_projects_change AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_mark_labels_change AFTER INSERT OR UPDATE OR DELETE ON public.mark_labels
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_mark_workflow_statuses_change AFTER INSERT OR UPDATE OR DELETE ON public.mark_workflow_statuses
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_marks_change AFTER INSERT OR UPDATE OR DELETE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_marks_to_labels_change AFTER INSERT OR UPDATE OR DELETE ON public.marks_to_labels
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_mark_comments_change AFTER INSERT OR UPDATE OR DELETE ON public.mark_comments
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_mark_events_change AFTER INSERT OR UPDATE OR DELETE ON public.mark_events
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_workspace_members_change AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_workspace_invites_change AFTER INSERT OR UPDATE OR DELETE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_workspace_views_change AFTER INSERT OR UPDATE OR DELETE ON public.workspace_views
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint
CREATE TRIGGER broadcast_workspace_review_links_change AFTER INSERT OR UPDATE OR DELETE ON public.workspace_review_links
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_workspace_change();--> statement-breakpoint

CREATE TRIGGER broadcast_inbox_activities_change AFTER INSERT OR UPDATE OR DELETE ON public.inbox_activities
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_inbox_change();--> statement-breakpoint
CREATE TRIGGER broadcast_inbox_activity_read_states_change AFTER INSERT OR UPDATE OR DELETE ON public.inbox_activity_read_states
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_inbox_change();--> statement-breakpoint

DROP POLICY IF EXISTS youin_workspace_broadcast_select ON realtime.messages;--> statement-breakpoint
CREATE POLICY youin_workspace_broadcast_select ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members AS member
      WHERE member.workspace_id::text = split_part((SELECT realtime.topic()), ':', 2)
        AND member.user_id = (SELECT auth.uid())
        AND (
          split_part((SELECT realtime.topic()), ':', 3) = ''
          OR (
            split_part((SELECT realtime.topic()), ':', 3) = 'user'
            AND split_part((SELECT realtime.topic()), ':', 4) = (SELECT auth.uid())::text
          )
        )
    )
  );--> statement-breakpoint

DO $$
DECLARE
  realtime_table text;
  realtime_tables text[] := ARRAY[
    'profiles',
    'workspaces',
    'workspace_members',
    'workspace_invites',
    'projects',
    'mark_labels',
    'mark_workflow_statuses',
    'marks',
    'mark_events',
    'inbox_activities',
    'inbox_activity_read_states',
    'workspace_views',
    'workspace_review_links'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RETURN;
  END IF;

  FOREACH realtime_table IN ARRAY realtime_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',
        realtime_table
      );
    END IF;
  END LOOP;
END $$;
