DROP FUNCTION IF EXISTS public.accept_workspace_invite(uuid, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.discover_pending_workspace_invites();
--> statement-breakpoint
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
--> statement-breakpoint
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
    UPDATE public.workspace_invites
    SET status = 'expired'
    WHERE id = v_invite.id
      AND status = 'pending';

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
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id
    AND status = 'pending';

  RETURN QUERY SELECT
    CASE WHEN v_is_member THEN 'already_member' ELSE 'accepted' END::text,
    v_invite.workspace_id,
    v_invite.id;
END;
$$;
--> statement-breakpoint
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.discover_pending_workspace_invites() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.attach_user_via_invite(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.discover_pending_workspace_invites() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid, text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.attach_user_via_invite(text) TO authenticated;
