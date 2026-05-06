-- Per-space shortcut codes and Jira-style mark numbers (e.g. WEB-42).

-- 1. Marks: add seq, backfill, then enforce uniqueness ----------------------------
ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "seq" integer;
UPDATE "marks" SET "seq" = sub.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY space_id ORDER BY created_at) AS rn
  FROM marks
) AS sub
WHERE marks.id = sub.id;

ALTER TABLE "marks" ALTER COLUMN "seq" SET NOT NULL;
ALTER TABLE "marks" ALTER COLUMN "seq" SET DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "marks_space_seq_unique" ON "marks" USING btree ("space_id", "seq");

-- 2. Spaces: add code + counter, backfill -----------------------------------------
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "next_mark_seq" integer NOT NULL DEFAULT 0;

UPDATE spaces
SET code = upper(substring(regexp_replace(trim(name), '[^a-zA-Z0-9]', '', 'g'), 1, 8))
WHERE code IS NULL;

UPDATE spaces
SET code = 'SP' || substring(replace(id::text, '-', ''), 1, 4)
WHERE code IS NULL OR code = '';

-- Resolve duplicate codes within the same workspace
WITH numbered AS (
  SELECT
    id,
    code || CASE WHEN rn = 1 THEN '' ELSE rn::text END AS new_code
  FROM (
    SELECT
      id,
      code,
      row_number() OVER (PARTITION BY workspace_id, code ORDER BY created_at) AS rn
    FROM spaces
  ) t
)
UPDATE spaces s
SET code = left(numbered.new_code, 16)
FROM numbered
WHERE s.id = numbered.id;

ALTER TABLE "spaces" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "spaces_workspace_code_unique" ON "spaces" USING btree ("workspace_id", "code");

UPDATE spaces s
SET next_mark_seq = COALESCE(m.mx, 0)
FROM (
  SELECT space_id, max(seq) AS mx
  FROM marks
  GROUP BY space_id
) m
WHERE s.id = m.space_id;

-- 3. Trigger: allocate seq on insert and when moving to another space --------------
CREATE OR REPLACE FUNCTION marks_assign_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_n integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE spaces
    SET next_mark_seq = next_mark_seq + 1
    WHERE id = NEW.space_id
    RETURNING next_mark_seq INTO next_n;
    IF next_n IS NULL THEN
      RAISE EXCEPTION 'space % not found for mark', NEW.space_id;
    END IF;
    NEW.seq := next_n;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.space_id IS DISTINCT FROM NEW.space_id THEN
    UPDATE spaces
    SET next_mark_seq = next_mark_seq + 1
    WHERE id = NEW.space_id
    RETURNING next_mark_seq INTO next_n;
    IF next_n IS NULL THEN
      RAISE EXCEPTION 'space % not found for mark', NEW.space_id;
    END IF;
    NEW.seq := next_n;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marks_assign_sequence_trg ON marks;
CREATE TRIGGER marks_assign_sequence_trg
  BEFORE INSERT OR UPDATE OF space_id ON marks
  FOR EACH ROW
  EXECUTE PROCEDURE marks_assign_sequence();
