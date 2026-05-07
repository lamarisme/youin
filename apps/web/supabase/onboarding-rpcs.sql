/*
  youin onboarding RPCs (idempotent).

  Run AFTER bootstrap.sql / rls-and-auth.sql. Safe to re-run.

  Provides two SECURITY DEFINER functions used during user creation:

    bootstrap_workspace(name, space_name, space_notes, invite_emails)
      Atomically creates a workspace, adds the caller as owner,
      creates a default space, seeds default tags, and fans out invites.

    attach_user_via_invite()
      If the caller's email matches a pending invite, attach them
      as a member of that workspace and mark all matching invites
      accepted. Returns the workspace_id, or NULL if no invite.

  Both bypass RLS for the bootstrap window (when the user has no
  memberships yet) but are scoped to the current auth.uid().
*/

DROP FUNCTION IF EXISTS public.bootstrap_workspace(text, text, text, text[]);
DROP FUNCTION IF EXISTS public.attach_user_via_invite();

CREATE OR REPLACE FUNCTION public.member_username_from_email(p_workspace_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  cand text;
  n int := 0;
BEGIN
  base := substring(
    regexp_replace(lower(split_part(trim(coalesce(p_email, '')), '@', 1)), '[^a-z0-9_]', '_', 'g'),
    1,
    32
  );
  base := trim(both '_' from base);
  IF base IS NULL OR length(base) < 2 THEN
    base := 'member';
  END IF;

  LOOP
    cand := substring(base || CASE WHEN n = 0 THEN '' ELSE n::text END FROM 1 FOR 48);
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND lower(wm.username) = lower(cand)
    );
    n := n + 1;
    IF n > 5000 THEN
      cand := substring('u' || replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 32);
      EXIT;
    END IF;
  END LOOP;
  RETURN lower(cand);
END;
$$;

REVOKE ALL ON FUNCTION public.member_username_from_email(uuid, text) FROM PUBLIC;

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
  v_space_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NULLIF(TRIM(p_workspace_name), ''), 'My workspace'))
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, username)
  VALUES (
    v_workspace_id,
    v_user_id,
    'owner'::public.workspace_role,
    public.member_username_from_email(
      v_workspace_id,
      (SELECT COALESCE(email, '') FROM auth.users WHERE id = v_user_id LIMIT 1)
    )
  );

  v_space_code :=
    upper(substring(
      regexp_replace(
        COALESCE(NULLIF(TRIM(p_space_name), ''), 'General'),
        '[^a-zA-Z0-9]',
        '',
        'g'
      ),
      1,
      8
    ));
  IF length(v_space_code) < 2 THEN
    v_space_code := 'GN';
  END IF;

  INSERT INTO public.spaces (workspace_id, code, name, notes, priority, pinned)
  VALUES (
    v_workspace_id,
    v_space_code,
    COALESCE(NULLIF(TRIM(p_space_name), ''), 'General'),
    COALESCE(p_space_notes, ''),
    'medium'::public.mark_priority,
    false
  );

  INSERT INTO public.mark_labels (workspace_id, name)
  SELECT v_workspace_id, name
  FROM unnest(ARRAY['Copy', 'UI', 'A11y', 'Bug']) AS name;

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

  INSERT INTO public.workspace_members (workspace_id, user_id, role, username)
  VALUES (
    v_workspace_id,
    v_user_id,
    'member'::public.workspace_role,
    public.member_username_from_email(v_workspace_id, v_email)
  )
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
