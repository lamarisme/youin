/*
  Supabase setup — run AFTER Drizzle has applied every migration in apps/web/drizzle/.

    cd apps/web && DATABASE_URL="<your connection string>" pnpm db:migrate

  Public tables, enums, indexes, and foreign keys live in Drizzle (`src/db/schema.ts`)
  as the single source of truth. This script adds:

    • cleanup for older setup-owned mark sequence trigger
    • optional mark_event_type enum toppings (harmless no-ops when already present)
    • project/space hierarchy RLS
    • profiles ↔ auth.users FK + signup trigger + RLS policies + storage
    • (separate step) onboarding-rpcs.sql for bootstrap_workspace RPCs

  Safe to re-run.
*/

-- ── 1. Marks sequence trigger ownership ──────────────────────────────────────
-- Drizzle migration 0002 owns mark sequencing via public.set_mark_seq and the
-- marks_set_seq trigger. Older versions of this setup file created a second
-- trigger, which double-incremented sequence numbers when both were installed.
DROP TRIGGER IF EXISTS marks_assign_sequence_trg ON public.marks;
DROP FUNCTION IF EXISTS public.marks_assign_sequence();

-- ── 2. Migration 0004-style enum toppings (idempotent) ──────────────────────
ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'assignee_changed';
ALTER TYPE "public"."mark_event_type" ADD VALUE IF NOT EXISTS 'label_changed';

-- ── 3. RLS + auth wiring + storage ───────────────────────────────────────────
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks_to_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_read_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_views ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'workspaces',
        'workspace_members',
        'workspace_invites',
        'projects',
        'spaces',
        'mark_labels',
        'marks',
        'marks_to_labels',
        'mark_comments',
        'mark_events',
        'inbox_read_states',
        'workspace_views'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

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

CREATE POLICY workspace_members_update_self ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    public.user_workspace_member(workspace_id)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.user_workspace_member(workspace_id)
    AND user_id = auth.uid()
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

CREATE POLICY projects_all_member ON public.projects
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

CREATE POLICY workspace_views_all_member ON public.workspace_views
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

CREATE POLICY spaces_all_member ON public.spaces
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

CREATE POLICY mark_labels_all_member ON public.mark_labels
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

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

CREATE POLICY marks_to_labels_select ON public.marks_to_labels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_labels.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY marks_to_labels_write ON public.marks_to_labels
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_labels.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

CREATE POLICY marks_to_labels_delete ON public.marks_to_labels
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.id = marks_to_labels.mark_id
        AND public.user_workspace_member(m.workspace_id)
    )
  );

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

CREATE POLICY mark_events_select ON public.mark_events
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY mark_events_insert ON public.mark_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.user_workspace_member(workspace_id)
  );

CREATE POLICY inbox_read_states_select_own ON public.inbox_read_states
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );

CREATE POLICY inbox_read_states_insert_own ON public.inbox_read_states
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.user_workspace_member(workspace_id)
  );

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

-- ── 4. Storage bucket + policies ────────────────────────────────────────────
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

-- ── 5. Onboarding RPCs ──────────────────────────────────────────────────────
-- Run apps/web/supabase/onboarding-rpcs.sql next (bootstrap_workspace, attach_user_via_invite).
