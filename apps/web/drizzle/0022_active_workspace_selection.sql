ALTER TABLE "profiles" ADD COLUMN "current_workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_current_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("current_workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "profiles_current_workspace_id_idx"
  ON "profiles" USING btree ("current_workspace_id");
--> statement-breakpoint
WITH ranked_memberships AS (
  SELECT
    wm.user_id,
    wm.workspace_id,
    row_number() OVER (
      PARTITION BY wm.user_id
      ORDER BY wm.created_at ASC, wm.workspace_id ASC
    ) AS membership_rank
  FROM public.workspace_members wm
)
UPDATE public.profiles AS p
SET current_workspace_id = ranked.workspace_id
FROM ranked_memberships AS ranked
WHERE ranked.user_id = p.id
  AND ranked.membership_rank = 1
  AND p.current_workspace_id IS NULL;
--> statement-breakpoint
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

  IF p_username IS NOT NULL AND length(TRIM(p_username)) >= 2 THEN
    v_resolved_username := lower(TRIM(p_username));
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
  SET status = 'accepted', accepted_at = now()
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.bootstrap_workspace(text, text, text, text[], text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.accept_workspace_invite(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace(text, text, text, text[], text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(uuid, text) TO authenticated;
