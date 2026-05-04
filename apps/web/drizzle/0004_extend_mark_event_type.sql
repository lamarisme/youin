ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'assignee_changed';--> statement-breakpoint
ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'tag_changed';
