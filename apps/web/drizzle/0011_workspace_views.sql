DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'workspace_view_layout'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."workspace_view_layout" AS ENUM('list', 'board', 'analytics');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "layout" "workspace_view_layout" NOT NULL,
  "filters" jsonb NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "workspace_views" DROP CONSTRAINT IF EXISTS "workspace_views_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_views" ADD CONSTRAINT "workspace_views_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_views" DROP CONSTRAINT IF EXISTS "workspace_views_created_by_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_views" ADD CONSTRAINT "workspace_views_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_views_workspace_name_unique" ON "workspace_views" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_views_workspace_created_at_idx" ON "workspace_views" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_views_workspace_layout_idx" ON "workspace_views" USING btree ("workspace_id","layout");--> statement-breakpoint
ALTER TABLE public.workspace_views ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_views_all_member ON public.workspace_views;--> statement-breakpoint
CREATE POLICY workspace_views_all_member ON public.workspace_views
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS workspace_views_set_updated_at ON public.workspace_views;--> statement-breakpoint
CREATE TRIGGER workspace_views_set_updated_at
BEFORE UPDATE ON public.workspace_views
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
