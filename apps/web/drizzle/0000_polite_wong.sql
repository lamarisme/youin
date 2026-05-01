CREATE TYPE "public"."mark_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."mark_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "mark_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mark_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"body" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mark_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"title" text NOT NULL,
	"page" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "mark_status" DEFAULT 'open' NOT NULL,
	"priority" "mark_priority" DEFAULT 'medium' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"linear_url" text,
	"assignee_user_id" uuid,
	"selector" text,
	"viewport" text,
	"browser" text,
	"os" text,
	"screenshot_url" text,
	"captured_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marks_to_tags" (
	"mark_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "marks_to_tags_mark_id_tag_id_pk" PRIMARY KEY("mark_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"priority" "mark_priority" DEFAULT 'medium' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'signup' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mark_comments" ADD CONSTRAINT "mark_comments_mark_id_marks_id_fk" FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark_tags" ADD CONSTRAINT "mark_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks_to_tags" ADD CONSTRAINT "marks_to_tags_mark_id_marks_id_fk" FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks_to_tags" ADD CONSTRAINT "marks_to_tags_tag_id_mark_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."mark_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mark_comments_mark_created_at_idx" ON "mark_comments" USING btree ("mark_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mark_tags_workspace_label_unique" ON "mark_tags" USING btree ("workspace_id","label");--> statement-breakpoint
CREATE INDEX "marks_space_status_priority_idx" ON "marks" USING btree ("space_id","status","priority");--> statement-breakpoint
CREATE INDEX "marks_workspace_pinned_idx" ON "marks" USING btree ("workspace_id","pinned");--> statement-breakpoint
CREATE INDEX "marks_workspace_created_at_idx" ON "marks" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spaces_workspace_name_unique" ON "spaces" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "spaces_workspace_priority_idx" ON "spaces" USING btree ("workspace_id","priority");--> statement-breakpoint
CREATE INDEX "spaces_workspace_pinned_idx" ON "spaces" USING btree ("workspace_id","pinned");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_email_idx" ON "workspace_invites" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "workspace_members_user_workspace_idx" ON "workspace_members" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "workspaces_name_idx" ON "workspaces" USING btree ("name");