CREATE TYPE "public"."mark_comment_type" AS ENUM('text', 'image');--> statement-breakpoint
CREATE TYPE "public"."workspace_invite_source" AS ENUM('signup', 'manual');--> statement-breakpoint
CREATE TYPE "public"."workspace_invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
-- Drop Supabase-managed partial index that has `status = 'pending'::text` in
-- its WHERE clause; we recreate it after the column is repointed at the enum.
DROP INDEX IF EXISTS "public"."workspace_invites_token_idx";--> statement-breakpoint
ALTER TABLE "mark_comments" ALTER COLUMN "type" SET DEFAULT 'text'::"public"."mark_comment_type";--> statement-breakpoint
ALTER TABLE "mark_comments" ALTER COLUMN "type" SET DATA TYPE "public"."mark_comment_type" USING "type"::"public"."mark_comment_type";--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."workspace_invite_status";--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "status" SET DATA TYPE "public"."workspace_invite_status" USING "status"::"public"."workspace_invite_status";--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "source" SET DEFAULT 'signup'::"public"."workspace_invite_source";--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "source" SET DATA TYPE "public"."workspace_invite_source" USING "source"::"public"."workspace_invite_source";--> statement-breakpoint
-- Recreate the partial token-lookup index, now using the enum literal.
CREATE INDEX "workspace_invites_token_idx" ON "workspace_invites" USING btree ("token") WHERE "token" IS NOT NULL AND "status" = 'pending';--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '14 days' NOT NULL;--> statement-breakpoint
ALTER TABLE "mark_comments" ADD CONSTRAINT "mark_comments_author_user_id_profiles_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mark_events" ADD CONSTRAINT "mark_events_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_assignee_user_id_profiles_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_user_id_profiles_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mark_comments_author_idx" ON "mark_comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "marks_workspace_status_idx" ON "marks" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "marks_workspace_assignee_idx" ON "marks" USING btree ("workspace_id","assignee_user_id");--> statement-breakpoint
CREATE INDEX "marks_to_labels_label_idx" ON "marks_to_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_status_idx" ON "workspace_invites" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_invites_expires_at_idx" ON "workspace_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invites_pending_email_unique" ON "workspace_invites" USING btree ("workspace_id",lower("email")) WHERE "workspace_invites"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "mark_comments" ADD CONSTRAINT "mark_comments_body_or_image" CHECK (("mark_comments"."type" = 'text' AND "mark_comments"."body" IS NOT NULL)
          OR ("mark_comments"."type" = 'image' AND "mark_comments"."image_url" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_code_format" CHECK ("spaces"."code" ~ '^[A-Z0-9]{1,12}$');--> statement-breakpoint
-- =============================================================================
-- Triggers (hand-written; Drizzle Kit does not generate trigger SQL).
-- =============================================================================

-- Per-space monotonic sequence numbers for marks (e.g. WEB-42).
-- Increments spaces.next_mark_seq atomically and writes the new value onto
-- marks.seq when a mark is inserted, or moved to a different space.
CREATE OR REPLACE FUNCTION public.set_mark_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR (TG_OP = 'UPDATE' AND NEW.space_id IS DISTINCT FROM OLD.space_id) THEN
    UPDATE public.spaces
       SET next_mark_seq = next_mark_seq + 1
     WHERE id = NEW.space_id
    RETURNING next_mark_seq INTO NEW.seq;

    IF NEW.seq IS NULL THEN
      RAISE EXCEPTION 'set_mark_seq: space % does not exist', NEW.space_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS marks_set_seq ON public.marks;--> statement-breakpoint
CREATE TRIGGER marks_set_seq
BEFORE INSERT OR UPDATE OF space_id ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.set_mark_seq();
--> statement-breakpoint
-- Generic updated_at maintenance.
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS workspaces_set_updated_at ON public.workspaces;--> statement-breakpoint
CREATE TRIGGER workspaces_set_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS spaces_set_updated_at ON public.spaces;--> statement-breakpoint
CREATE TRIGGER spaces_set_updated_at
BEFORE UPDATE ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS marks_set_updated_at ON public.marks;--> statement-breakpoint
CREATE TRIGGER marks_set_updated_at
BEFORE UPDATE ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();