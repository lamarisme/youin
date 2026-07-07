CREATE TABLE IF NOT EXISTS "inbox_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "recipient_user_id" uuid NOT NULL,
  "activity_type" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "source_event_id" uuid,
  "actor_user_id" uuid,
  "subject_type" text,
  "subject_id" uuid,
  "mark_id" uuid,
  "required_context_type" text NOT NULL,
  "required_context_id" uuid NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "inbox_activity_read_states" (
  "activity_id" uuid NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "read_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_trigger" text NOT NULL,
  "context_viewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inbox_activity_read_states_activity_id_user_id_pk" PRIMARY KEY("activity_id","user_id")
);--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_recipient_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_recipient_user_id_profiles_id_fk"
  FOREIGN KEY ("recipient_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_actor_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_actor_user_id_profiles_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_mark_id_marks_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_mark_id_marks_id_fk"
  FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activity_read_states" DROP CONSTRAINT IF EXISTS "inbox_activity_read_states_activity_id_inbox_activities_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activity_read_states" ADD CONSTRAINT "inbox_activity_read_states_activity_id_inbox_activities_id_fk"
  FOREIGN KEY ("activity_id") REFERENCES "public"."inbox_activities"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activity_read_states" DROP CONSTRAINT IF EXISTS "inbox_activity_read_states_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activity_read_states" ADD CONSTRAINT "inbox_activity_read_states_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activity_read_states" DROP CONSTRAINT IF EXISTS "inbox_activity_read_states_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_activity_read_states" ADD CONSTRAINT "inbox_activity_read_states_user_id_profiles_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_activity_type_not_blank";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_activity_type_not_blank"
  CHECK (length(trim("activity_type")) > 0);--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_source_type_not_blank";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_source_type_not_blank"
  CHECK (length(trim("source_type")) > 0);--> statement-breakpoint

ALTER TABLE "inbox_activities" DROP CONSTRAINT IF EXISTS "inbox_activities_required_context_type_not_blank";--> statement-breakpoint
ALTER TABLE "inbox_activities" ADD CONSTRAINT "inbox_activities_required_context_type_not_blank"
  CHECK (length(trim("required_context_type")) > 0);--> statement-breakpoint

ALTER TABLE "inbox_activity_read_states" DROP CONSTRAINT IF EXISTS "inbox_activity_read_states_trigger_not_blank";--> statement-breakpoint
ALTER TABLE "inbox_activity_read_states" ADD CONSTRAINT "inbox_activity_read_states_trigger_not_blank"
  CHECK (length(trim("read_trigger")) > 0);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inbox_activities_recipient_created_at_idx"
  ON "inbox_activities" USING btree ("workspace_id", "recipient_user_id", "created_at");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "inbox_activities_source_unique"
  ON "inbox_activities" USING btree ("workspace_id", "recipient_user_id", "source_type", "source_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inbox_activities_required_context_idx"
  ON "inbox_activities" USING btree ("workspace_id", "recipient_user_id", "required_context_type", "required_context_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inbox_activities_mark_idx"
  ON "inbox_activities" USING btree ("mark_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "inbox_activity_read_states_user_workspace_idx"
  ON "inbox_activity_read_states" USING btree ("user_id", "workspace_id");--> statement-breakpoint

ALTER TABLE public.inbox_activities ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.inbox_activity_read_states ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS inbox_activities_select_own ON public.inbox_activities;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_activity_read_states_select_own ON public.inbox_activity_read_states;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_activity_read_states_insert_own ON public.inbox_activity_read_states;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_activity_read_states_update_own ON public.inbox_activity_read_states;--> statement-breakpoint

CREATE POLICY inbox_activities_select_own ON public.inbox_activities
  FOR SELECT TO authenticated
  USING (
    recipient_user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint

CREATE POLICY inbox_activity_read_states_select_own ON public.inbox_activity_read_states
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint

CREATE POLICY inbox_activity_read_states_insert_own ON public.inbox_activity_read_states
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1
      FROM public.inbox_activities ia
      WHERE ia.id = inbox_activity_read_states.activity_id
        AND ia.workspace_id = inbox_activity_read_states.workspace_id
        AND ia.recipient_user_id = inbox_activity_read_states.user_id
    )
  );--> statement-breakpoint

CREATE POLICY inbox_activity_read_states_update_own ON public.inbox_activity_read_states
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1
      FROM public.inbox_activities ia
      WHERE ia.id = inbox_activity_read_states.activity_id
        AND ia.workspace_id = inbox_activity_read_states.workspace_id
        AND ia.recipient_user_id = inbox_activity_read_states.user_id
    )
  );
