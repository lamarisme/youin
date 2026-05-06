-- Per-workspace username (handle) for mentions, assignment display, etc.

CREATE OR REPLACE FUNCTION public.member_username_from_email(p_workspace_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
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

ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "username" text;

UPDATE workspace_members wm
SET username = public.member_username_from_email(
  wm.workspace_id::uuid,
  COALESCE((SELECT email FROM profiles p WHERE p.id = wm.user_id LIMIT 1), '')
)
WHERE username IS NULL;

ALTER TABLE "workspace_members" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_username_lower"
  ON "workspace_members" USING btree ("workspace_id", lower("username"));
