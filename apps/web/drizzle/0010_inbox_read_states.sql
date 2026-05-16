CREATE TABLE IF NOT EXISTS "inbox_read_states" (
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inbox_read_states_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);--> statement-breakpoint
ALTER TABLE "inbox_read_states" DROP CONSTRAINT IF EXISTS "inbox_read_states_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_read_states" ADD CONSTRAINT "inbox_read_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_read_states" DROP CONSTRAINT IF EXISTS "inbox_read_states_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_read_states" ADD CONSTRAINT "inbox_read_states_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_read_states_user_workspace_idx" ON "inbox_read_states" USING btree ("user_id","workspace_id");--> statement-breakpoint
ALTER TABLE public.inbox_read_states ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_read_states_select_own ON public.inbox_read_states;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_read_states_insert_own ON public.inbox_read_states;--> statement-breakpoint
DROP POLICY IF EXISTS inbox_read_states_update_own ON public.inbox_read_states;--> statement-breakpoint
CREATE POLICY inbox_read_states_select_own ON public.inbox_read_states
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint
CREATE POLICY inbox_read_states_insert_own ON public.inbox_read_states
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );--> statement-breakpoint
CREATE POLICY inbox_read_states_update_own ON public.inbox_read_states
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );
