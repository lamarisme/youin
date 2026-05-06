/*
  Apply on Supabase (SQL editor or Supabase CLI) AFTER Drizzle migrations 0000–0003.

  Links profiles to auth, creates signup trigger, enables RLS, and adds member-scoped policies.
*/

-- ── Profiles ↔ auth (id must match auth.users) ───────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ── New user → profile row ─────────────────────────────────────────────────
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

-- ── Membership helper (SECURITY DEFINER avoids RLS recursion) ────────────
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

-- ── Enable RLS ──────────────────────────────────────────────────────────────
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

-- Drop old policies if re-running (names are stable)
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
        'spaces',
        'mark_tags',
        'marks',
        'marks_to_tags',
        'mark_comments',
        'mark_events'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── profiles ──────────────────────────────────────────────────────────────
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

-- ── workspaces ─────────────────────────────────────────────────────────────
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

-- ── workspace_members ───────────────────────────────────────────────────────
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

-- ── workspace_invites ───────────────────────────────────────────────────────
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

-- ── spaces ───────────────────────────────────────────────────────────────────
CREATE POLICY spaces_all_member ON public.spaces
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

-- ── mark_tags ────────────────────────────────────────────────────────────────
CREATE POLICY mark_tags_all_member ON public.mark_tags
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));

-- ── marks ─────────────────────────────────────────────────────────────────────
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

-- ── marks_to_tags ───────────────────────────────────────────────────────────
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

-- ── mark_comments ─────────────────────────────────────────────────────────────
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

-- ── mark_events ──────────────────────────────────────────────────────────────
CREATE POLICY mark_events_select ON public.mark_events
  FOR SELECT TO authenticated
  USING (public.user_workspace_member(workspace_id));

CREATE POLICY mark_events_insert ON public.mark_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.user_workspace_member(workspace_id)
  );
