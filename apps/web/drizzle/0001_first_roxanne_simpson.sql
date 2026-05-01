CREATE TYPE "public"."mark_event_type" AS ENUM('created', 'status_changed', 'priority_changed', 'pinned_changed', 'linear_link_updated', 'comment_added');--> statement-breakpoint
CREATE TABLE "mark_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"mark_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"type" "mark_event_type" NOT NULL,
	"from_value" text,
	"to_value" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mark_events" ADD CONSTRAINT "mark_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark_events" ADD CONSTRAINT "mark_events_mark_id_marks_id_fk" FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mark_events_mark_created_at_idx" ON "mark_events" USING btree ("mark_id","created_at");--> statement-breakpoint
CREATE INDEX "mark_events_workspace_created_at_idx" ON "mark_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "mark_events_workspace_type_idx" ON "mark_events" USING btree ("workspace_id","type");