CREATE TABLE IF NOT EXISTS "workspace_review_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "name" text NOT NULL,
  "target_origin" text NOT NULL,
  "token" text NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT now() + interval '30 days',
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  CONSTRAINT "workspace_review_links_token_unique" UNIQUE("token")
);--> statement-breakpoint
ALTER TABLE "workspace_review_links" DROP CONSTRAINT IF EXISTS "workspace_review_links_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_review_links" ADD CONSTRAINT "workspace_review_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_review_links" DROP CONSTRAINT IF EXISTS "workspace_review_links_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_review_links" ADD CONSTRAINT "workspace_review_links_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_review_links" DROP CONSTRAINT IF EXISTS "workspace_review_links_created_by_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_review_links" ADD CONSTRAINT "workspace_review_links_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_review_links_workspace_created_at_idx" ON "workspace_review_links" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_review_links_workspace_active_idx" ON "workspace_review_links" USING btree ("workspace_id","revoked_at","expires_at");--> statement-breakpoint
ALTER TABLE public.workspace_review_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_review_links_all_member ON public.workspace_review_links;--> statement-breakpoint
CREATE POLICY workspace_review_links_all_member ON public.workspace_review_links
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));--> statement-breakpoint
