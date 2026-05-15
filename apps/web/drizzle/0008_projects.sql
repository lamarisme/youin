CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_name_unique" ON "projects" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_workspace_created_at_idx" ON "projects" USING btree ("workspace_id","created_at");--> statement-breakpoint
INSERT INTO "projects" ("workspace_id", "name", "description")
SELECT w."id", 'General', 'Default project for existing spaces.'
FROM "workspaces" w
ON CONFLICT ("workspace_id", "name") DO NOTHING;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "project_id" uuid;--> statement-breakpoint
UPDATE "spaces" s
SET "project_id" = p."id"
FROM "projects" p
WHERE s."workspace_id" = p."workspace_id"
  AND p."name" = 'General'
  AND s."project_id" IS NULL;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" DROP CONSTRAINT IF EXISTS "spaces_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "spaces_workspace_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spaces_project_name_unique" ON "spaces" USING btree ("workspace_id","project_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_project_created_at_idx" ON "spaces" USING btree ("project_id","created_at");--> statement-breakpoint
DO $$
BEGIN
  IF to_regprocedure('public.user_workspace_member(uuid)') IS NOT NULL THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS projects_all_member ON public.projects;
    CREATE POLICY projects_all_member ON public.projects
      FOR ALL TO authenticated
      USING (public.user_workspace_member(workspace_id))
      WITH CHECK (public.user_workspace_member(workspace_id));
  END IF;
END $$;
