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
    ON CONFLICT ON CONSTRAINT workspace_members_workspace_id_user_id_pk DO NOTHING;
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
REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid, text) TO authenticated;
