CREATE TABLE IF NOT EXISTS "mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "mark_id" uuid,
  "mentioned_user_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "start_index" integer NOT NULL,
  "end_index" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_mark_id_marks_id_fk";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mark_id_marks_id_fk"
  FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_mentioned_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_profiles_id_fk"
  FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_created_by_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_created_by_user_id_profiles_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_source_type_not_blank";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_source_type_not_blank"
  CHECK (length(trim("source_type")) > 0);--> statement-breakpoint

ALTER TABLE "mentions" DROP CONSTRAINT IF EXISTS "mentions_offsets_valid";--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_offsets_valid"
  CHECK ("start_index" >= 0 AND "end_index" > "start_index");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mentions_source_occurrence_unique"
  ON "mentions" USING btree (
    "workspace_id",
    "source_type",
    "source_id",
    "mentioned_user_id",
    "start_index",
    "end_index"
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mentions_source_idx"
  ON "mentions" USING btree ("workspace_id", "source_type", "source_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mentions_mentioned_user_created_at_idx"
  ON "mentions" USING btree ("mentioned_user_id", "workspace_id", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mentions_created_by_user_created_at_idx"
  ON "mentions" USING btree ("created_by_user_id", "workspace_id", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mentions_mark_idx"
  ON "mentions" USING btree ("mark_id");--> statement-breakpoint

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS mentions_select_member ON public.mentions;--> statement-breakpoint
DROP POLICY IF EXISTS mentions_insert_member ON public.mentions;--> statement-breakpoint
DROP POLICY IF EXISTS mentions_delete_member ON public.mentions;--> statement-breakpoint

CREATE POLICY mentions_select_member ON public.mentions
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));--> statement-breakpoint

CREATE POLICY mentions_insert_member ON public.mentions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = mentions.workspace_id
        AND wm.user_id = mentions.mentioned_user_id
    )
  );--> statement-breakpoint

CREATE POLICY mentions_delete_member ON public.mentions
  FOR DELETE TO authenticated
  USING (public.user_workspace_member(workspace_id));

