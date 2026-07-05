/*
  youin onboarding RPCs (idempotent).

  Run AFTER `setup.sql` once Drizzle migrations have created the public tables.

  Provides two SECURITY DEFINER functions used during user creation:

    bootstrap_workspace(name, project_name, project_description, invite_emails)
      Atomically creates a workspace, adds the caller as owner,
      creates a default project, seeds default tags/statuses, and fans out invites.

    discover_pending_workspace_invites()
      Lists valid pending invites for the caller's authenticated email.

    accept_workspace_invite(invite_id, token)
      Explicitly accepts one pending invite after validating recipient,
      status, and expiration.

    attach_user_via_invite()
      Legacy bootstrap helper. If the caller's email matches a valid pending
      invite, attach them as a member of that workspace and mark one invite
      accepted. Returns the workspace_id, or NULL if no invite.

  Both bypass RLS for the bootstrap window (when the user has no
  memberships yet) but are scoped to the current auth.uid().
*/

DROP FUNCTION IF EXISTS public.bootstrap_workspace(text, text, text, text[]);
DROP FUNCTION IF EXISTS public.bootstrap_workspace(text, text, text, text[], text);
DROP FUNCTION IF EXISTS public.bootstrap_workspace(text[], text, text, text, text);
DROP FUNCTION IF EXISTS public.attach_user_via_invite();
DROP FUNCTION IF EXISTS public.attach_user_via_invite(text);
DROP FUNCTION IF EXISTS public.accept_workspace_invite(uuid, text);
DROP FUNCTION IF EXISTS public.discover_pending_workspace_invites();

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
  RETURN COALESCE(NULLIF(trim(lower(cand)), ''), 'member');
END;
$$;

REVOKE ALL ON FUNCTION public.member_username_from_email(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.bootstrap_workspace(
  p_workspace_name text,
  p_project_name text DEFAULT 'General',
  p_project_description text DEFAULT '',
  p_invite_emails text[] DEFAULT ARRAY[]::text[],
  p_username text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_project_id uuid;
  v_invite_email text;
  v_resolved_username text;
  v_user_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(email, '') INTO v_user_email
    FROM auth.users WHERE id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    v_user_email := '';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NULLIF(TRIM(p_workspace_name), ''), 'My workspace'))
  RETURNING id INTO v_workspace_id;

  -- Resolve username: try provided username first, fall back to auto-generation
  IF p_username IS NOT NULL AND length(TRIM(p_username)) >= 2 THEN
    v_resolved_username := lower(TRIM(p_username));
    -- If taken, auto-generate from email instead
    IF EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = v_workspace_id
        AND lower(wm.username) = v_resolved_username
    ) THEN
      v_resolved_username := public.member_username_from_email(v_workspace_id, v_user_email);
    END IF;
  ELSE
    v_resolved_username := public.member_username_from_email(v_workspace_id, v_user_email);
  END IF;

  v_resolved_username := COALESCE(
    NULLIF(trim(lower(v_resolved_username)), ''),
    public.member_username_from_email(v_workspace_id, v_user_email),
    'member'
  );

  INSERT INTO public.workspace_members (workspace_id, user_id, role, username)
  VALUES (
    v_workspace_id,
    v_user_id,
    'owner'::public.workspace_role,
    left(v_resolved_username, 48)
  );

  UPDATE public.profiles AS p
  SET current_workspace_id = v_workspace_id,
      updated_at = now()
  WHERE p.id = v_user_id;

  INSERT INTO public.projects (workspace_id, name, description)
  VALUES (
    v_workspace_id,
    COALESCE(NULLIF(TRIM(p_project_name), ''), 'General'),
    COALESCE(p_project_description, '')
  )
  RETURNING id INTO v_project_id;

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

CREATE OR REPLACE FUNCTION public.discover_pending_workspace_invites()
RETURNS TABLE (
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  invite_email text,
  invited_by_user_id uuid,
  invited_by_name text,
  invited_by_email text,
  invited_at timestamptz,
  expires_at timestamptz,
  source public.workspace_invite_source
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(COALESCE(email, ''))
    INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    wi.id AS invite_id,
    wi.workspace_id,
    w.name AS workspace_name,
    wi.email AS invite_email,
    wi.invited_by_user_id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), split_part(COALESCE(p.email, ''), '@', 1), 'Someone') AS invited_by_name,
    p.email AS invited_by_email,
    wi.invited_at,
    wi.expires_at,
    wi.source
  FROM public.workspace_invites wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  LEFT JOIN public.profiles p ON p.id = wi.invited_by_user_id
  WHERE lower(wi.email) = v_email
    AND wi.status = 'pending'
    AND wi.expires_at > now()
  ORDER BY wi.invited_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(
  p_invite_id uuid DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  workspace_id uuid,
  invite_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_token text := NULLIF(TRIM(COALESCE(p_token, '')), '');
  v_invite public.workspace_invites%ROWTYPE;
  v_is_member boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invite_id IS NULL AND v_token IS NULL THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT lower(COALESCE(email, ''))
    INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT wi.*
    INTO v_invite
  FROM public.workspace_invites wi
  WHERE (p_invite_id IS NOT NULL AND wi.id = p_invite_id)
     OR (v_token IS NOT NULL AND wi.token = v_token)
  ORDER BY wi.invited_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF lower(v_invite.email) <> v_email THEN
    RETURN QUERY SELECT 'email_mismatch'::text, v_invite.workspace_id, v_invite.id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_invite.workspace_id
      AND wm.user_id = v_user_id
  ) INTO v_is_member;

  IF v_invite.status = 'accepted' THEN
    IF v_is_member THEN
      UPDATE public.profiles AS p
      SET current_workspace_id = v_invite.workspace_id,
          updated_at = now()
      WHERE p.id = v_user_id;
    END IF;

    RETURN QUERY SELECT
      CASE WHEN v_is_member THEN 'already_member' ELSE 'already_accepted' END::text,
      v_invite.workspace_id,
      v_invite.id;
    RETURN;
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN QUERY SELECT 'revoked'::text, v_invite.workspace_id, v_invite.id;
    RETURN;
  END IF;

  IF v_invite.status = 'expired' THEN
    RETURN QUERY SELECT 'expired'::text, v_invite.workspace_id, v_invite.id;
    RETURN;
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.workspace_invites AS wi
    SET status = 'expired'
    WHERE wi.id = v_invite.id
      AND wi.status = 'pending';

    RETURN QUERY SELECT 'expired'::text, v_invite.workspace_id, v_invite.id;
    RETURN;
  END IF;

  IF NOT v_is_member THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, username)
    VALUES (
      v_invite.workspace_id,
      v_user_id,
      'member'::public.workspace_role,
      COALESCE(
        NULLIF(
          trim(lower(public.member_username_from_email(v_invite.workspace_id, v_email))),
          ''
        ),
        'member'
      )
    )
    ON CONFLICT ON CONSTRAINT workspace_members_workspace_id_user_id_pk DO NOTHING;
  END IF;

  UPDATE public.workspace_invites AS wi
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by_user_id = v_user_id
  WHERE wi.id = v_invite.id
    AND wi.status = 'pending';

  UPDATE public.profiles AS p
  SET current_workspace_id = v_invite.workspace_id,
      updated_at = now()
  WHERE p.id = v_user_id
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = v_invite.workspace_id
        AND wm.user_id = v_user_id
    );

  RETURN QUERY SELECT
    CASE WHEN v_is_member THEN 'already_member' ELSE 'accepted' END::text,
    v_invite.workspace_id,
    v_invite.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_user_via_invite(p_token text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_workspace_id uuid;
  v_invite_id uuid;
  v_acceptance record;
  v_token text := NULLIF(TRIM(COALESCE(p_token, '')), '');
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

  -- If a token is provided, match by token; otherwise match by email.
  -- This legacy helper intentionally accepts one valid invite only.
  IF v_token IS NOT NULL THEN
    SELECT wi.id
      INTO v_invite_id
    FROM public.workspace_invites wi
    WHERE wi.token = v_token
      AND lower(wi.email) = v_email
      AND wi.status = 'pending'
      AND wi.expires_at > now()
    ORDER BY wi.invited_at DESC
    LIMIT 1;
  ELSE
    SELECT wi.id
      INTO v_invite_id
    FROM public.workspace_invites wi
    WHERE lower(wi.email) = v_email
      AND wi.status = 'pending'
      AND wi.expires_at > now()
    ORDER BY wi.invited_at DESC
    LIMIT 1;
  END IF;

  IF v_invite_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT result.status, result.workspace_id, result.invite_id
    INTO v_acceptance
  FROM public.accept_workspace_invite(v_invite_id, NULL) AS result
  LIMIT 1;

  IF v_acceptance.status NOT IN ('accepted', 'already_member') THEN
    RETURN NULL;
  END IF;

  v_workspace_id := v_acceptance.workspace_id;
  RETURN v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_workspace(text, text, text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discover_pending_workspace_invites() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_user_via_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace(text, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discover_pending_workspace_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_user_via_invite(text) TO authenticated;
