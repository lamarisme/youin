/*
  youin — full Supabase bootstrap (idempotent)

  Paste this entire file into the Supabase SQL editor and Run.
  Safe to re-run: every step uses IF NOT EXISTS / DROP-then-CREATE.

  Order:
    1. Enums          (mark_priority, mark_status, workspace_role, mark_event_type)
    2. Tables         (profiles, workspaces, workspace_members, workspace_invites,
                       spaces, mark_tags, marks, marks_to_tags, mark_comments, mark_events)
    3. Foreign keys
    4. Indexes
    5. Auth + profiles trigger
    6. SECURITY DEFINER membership helper
    7. Row-level security policies
    8. Storage bucket + policies (mark-images)
*/

-- ── 1. ENUMS ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."mark_priority" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."mark_status" AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."workspace_role" AS ENUM ('owner', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."mark_event_type" AS ENUM (
    'created', 'status_changed', 'priority_changed', 'pinned_changed',
    'linear_link_updated', 'comment_added', 'assignee_changed', 'tag_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- in case the type already exists at an older version, top up missing values
ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'assignee_changed';
ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'tag_changed';

-- ── 2. TABLES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text,
  "full_name" text,
  "title" text DEFAULT '' NOT NULL,
  "bio" text DEFAULT '' NOT NULL,
  "avatar_url" text DEFAULT '' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "workspace_role" DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY ("workspace_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "workspace_invites" (
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

CREATE TABLE IF NOT EXISTS "spaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "priority" "mark_priority" DEFAULT 'medium' NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mark_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marks" (
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

CREATE TABLE IF NOT EXISTS "marks_to_tags" (
  "mark_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  CONSTRAINT "marks_to_tags_mark_id_tag_id_pk" PRIMARY KEY ("mark_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "mark_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mark_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "type" text DEFAULT 'text' NOT NULL,
  "body" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mark_events" (
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

-- ── 3. FOREIGN KEYS ─────────────────────────────────────────────────────────
ALTER TABLE "workspace_members"
  DROP CONSTRAINT IF EXISTS "workspace_members_workspace_id_workspaces_id_fk";
ALTER TABLE "workspace_members"
  ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "workspace_invites"
  DROP CONSTRAINT IF EXISTS "workspace_invites_workspace_id_workspaces_id_fk";
ALTER TABLE "workspace_invites"
  ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "spaces"
  DROP CONSTRAINT IF EXISTS "spaces_workspace_id_workspaces_id_fk";
ALTER TABLE "spaces"
  ADD CONSTRAINT "spaces_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mark_tags"
  DROP CONSTRAINT IF EXISTS "mark_tags_workspace_id_workspaces_id_fk";
ALTER TABLE "mark_tags"
  ADD CONSTRAINT "mark_tags_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "marks"
  DROP CONSTRAINT IF EXISTS "marks_workspace_id_workspaces_id_fk";
ALTER TABLE "marks"
  ADD CONSTRAINT "marks_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "marks"
  DROP CONSTRAINT IF EXISTS "marks_space_id_spaces_id_fk";
ALTER TABLE "marks"
  ADD CONSTRAINT "marks_space_id_spaces_id_fk"
  FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "marks_to_tags"
  DROP CONSTRAINT IF EXISTS "marks_to_tags_mark_id_marks_id_fk";
ALTER TABLE "marks_to_tags"
  ADD CONSTRAINT "marks_to_tags_mark_id_marks_id_fk"
  FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "marks_to_tags"
  DROP CONSTRAINT IF EXISTS "marks_to_tags_tag_id_mark_tags_id_fk";
ALTER TABLE "marks_to_tags"
  ADD CONSTRAINT "marks_to_tags_tag_id_mark_tags_id_fk"
  FOREIGN KEY ("tag_id") REFERENCES "public"."mark_tags"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mark_comments"
  DROP CONSTRAINT IF EXISTS "mark_comments_mark_id_marks_id_fk";
ALTER TABLE "mark_comments"
  ADD CONSTRAINT "mark_comments_mark_id_marks_id_fk"
  FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mark_events"
  DROP CONSTRAINT IF EXISTS "mark_events_workspace_id_workspaces_id_fk";
ALTER TABLE "mark_events"
  ADD CONSTRAINT "mark_events_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mark_events"
  DROP CONSTRAINT IF EXISTS "mark_events_mark_id_marks_id_fk";
ALTER TABLE "mark_events"
  ADD CONSTRAINT "mark_events_mark_id_marks_id_fk"
  FOREIGN KEY ("mark_id") REFERENCES "public"."marks"("id")
  ON DELETE cascade ON UPDATE no action;

-- ── 4. INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "workspaces_name_idx" ON "workspaces" USING btree ("name");
CREATE INDEX IF NOT EXISTS "workspace_members_user_workspace_idx" ON "workspace_members" USING btree ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_invites_workspace_email_idx" ON "workspace_invites" USING btree ("workspace_id", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "spaces_workspace_name_unique" ON "spaces" USING btree ("workspace_id", "name");
CREATE INDEX IF NOT EXISTS "spaces_workspace_priority_idx" ON "spaces" USING btree ("workspace_id", "priority");
CREATE INDEX IF NOT EXISTS "spaces_workspace_pinned_idx" ON "spaces" USING btree ("workspace_id", "pinned");
CREATE UNIQUE INDEX IF NOT EXISTS "mark_tags_workspace_label_unique" ON "mark_tags" USING btree ("workspace_id", "label");
CREATE INDEX IF NOT EXISTS "marks_space_status_priority_idx" ON "marks" USING btree ("space_id", "status", "priority");
CREATE INDEX IF NOT EXISTS "marks_workspace_pinned_idx" ON "marks" USING btree ("workspace_id", "pinned");
CREATE INDEX IF NOT EXISTS "marks_workspace_created_at_idx" ON "marks" USING btree ("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "mark_comments_mark_created_at_idx" ON "mark_comments" USING btree ("mark_id", "created_at");
CREATE INDEX IF NOT EXISTS "mark_events_mark_created_at_idx" ON "mark_events" USING btree ("mark_id", "created_at");
CREATE INDEX IF NOT EXISTS "mark_events_workspace_created_at_idx" ON "mark_events" USING btree ("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "mark_events_workspace_type_idx" ON "mark_events" USING btree ("workspace_id", "type");

-- ── 5. AUTH ↔ PROFILES TRIGGER ──────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(nullif(trim(public.profiles.full_name), ''), EXCLUDED.full_name),
    updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- backfill profile rows for any existing auth.users
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1)
  )
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(nullif(trim(public.profiles.full_name), ''), EXCLUDED.full_name);

-- ── 6. SECURITY DEFINER HELPER ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_workspace_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_workspace_member(uuid) TO authenticated;

-- ── 7. ROW-LEVEL SECURITY ───────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks_to_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'workspaces', 'workspace_members', 'workspace_invites',
        'spaces', 'mark_tags', 'marks', 'marks_to_tags', 'mark_comments', 'mark_events'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
CREATE POLICY profiles_select_self_or_teammates ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members me
      INNER JOIN public.workspace_members them
        ON me.workspace_id = them.workspace_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = profiles.id
    )
  );

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- workspaces
CREATE POLICY workspaces_select_member ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(id));

CREATE POLICY workspaces_insert_authenticated ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY workspaces_update_member ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.user_workspace_member(id))
  WITH CHECK (public.user_workspace_member(id));

-- workspace_members
CREATE POLICY workspace_members_select_member ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY workspace_members_insert ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.workspace_members x
        WHERE x.workspace_id = workspace_members.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspace_members o
        WHERE o.workspace_id = workspace_members.workspace_id
          AND o.user_id = auth.uid()
          AND o.role = 'owner'::public.workspace_role
      )
    )
  );

CREATE POLICY workspace_members_delete_owner ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members o
      WHERE o.workspace_id = workspace_members.workspace_id
        AND o.user_id = auth.uid()
        AND o.role = 'owner'::public.workspace_role
    )
  );

-- workspace_invites
CREATE POLICY invites_select_member ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY invites_all_member ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.user_workspace_member(workspace_id));

CREATE POLICY invites_update_member ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY invites_delete_member ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.user_workspace_member(workspace_id));

-- spaces
CREATE POLICY spaces_all_member ON public.spaces
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

-- mark_tags
CREATE POLICY mark_tags_all_member ON public.mark_tags
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

-- marks
CREATE POLICY marks_select_member ON public.marks
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY marks_insert_member ON public.marks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_workspace_member(workspace_id)
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY marks_update_member ON public.marks
  FOR UPDATE TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

CREATE POLICY marks_delete_member ON public.marks
  FOR DELETE TO authenticated
  USING (public.user_workspace_member(workspace_id));

-- marks_to_tags
CREATE POLICY marks_to_tags_select ON public.marks_to_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_tags.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY marks_to_tags_write ON public.marks_to_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_tags.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY marks_to_tags_delete ON public.marks_to_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_tags.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

-- mark_comments
CREATE POLICY mark_comments_select ON public.mark_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = mark_comments.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY mark_comments_insert ON public.mark_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = mark_comments.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY mark_comments_delete_own ON public.mark_comments
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

-- mark_events
CREATE POLICY mark_events_select ON public.mark_events
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY mark_events_insert ON public.mark_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.user_workspace_member(workspace_id)
  );

-- ── 8. STORAGE BUCKET + POLICIES ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('mark-images', 'mark-images', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'mark_images_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY mark_images_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mark-images'
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY mark_images_insert_member ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mark-images'
    AND public.user_workspace_member((storage.foldername(name))[1]::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY mark_images_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mark-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'mark-images' AND owner = auth.uid());

CREATE POLICY mark_images_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mark-images' AND owner = auth.uid());

-- ── 9. ONBOARDING RPCs (bypass RLS chicken-and-egg) ─────────────────────────
DROP FUNCTION IF EXISTS public.bootstrap_workspace(text, text, text, text[]);
DROP FUNCTION IF EXISTS public.attach_user_via_invite();

CREATE OR REPLACE FUNCTION public.bootstrap_workspace(
  p_workspace_name text,
  p_space_name text DEFAULT 'General',
  p_space_notes text DEFAULT '',
  p_invite_emails text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_invite_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NULLIF(TRIM(p_workspace_name), ''), 'My workspace'))
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner'::public.workspace_role);

  INSERT INTO public.spaces (workspace_id, name, notes, priority, pinned)
  VALUES (
    v_workspace_id,
    COALESCE(NULLIF(TRIM(p_space_name), ''), 'General'),
    COALESCE(p_space_notes, ''),
    'medium'::public.mark_priority,
    false
  );

  INSERT INTO public.mark_tags (workspace_id, label)
  SELECT v_workspace_id, label
  FROM unnest(ARRAY['Copy', 'UI', 'A11y', 'Bug']) AS label;

  IF p_invite_emails IS NOT NULL THEN
    FOREACH v_invite_email IN ARRAY p_invite_emails LOOP
      v_invite_email := lower(trim(v_invite_email));
      IF v_invite_email LIKE '%@%' AND v_invite_email LIKE '%.%' THEN
        INSERT INTO public.workspace_invites
          (workspace_id, email, invited_by_user_id, status, source)
        VALUES
          (v_workspace_id, v_invite_email, v_user_id, 'pending', 'signup');
      END IF;
    END LOOP;
  END IF;

  RETURN v_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_user_via_invite()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_workspace_id uuid;
  v_invite_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(COALESCE(email, ''))
    INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT
    array_agg(id ORDER BY invited_at DESC),
    (array_agg(workspace_id ORDER BY invited_at DESC))[1]
  INTO v_invite_ids, v_workspace_id
  FROM public.workspace_invites
  WHERE lower(email) = v_email
    AND status = 'pending';

  IF v_workspace_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'member'::public.workspace_role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = ANY(v_invite_ids);

  RETURN v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_workspace(text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_user_via_invite() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace(text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_user_via_invite() TO authenticated;

-- Done.
