ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "next_mark_seq" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_id_unique"
  ON "projects" USING btree ("workspace_id", "id");
--> statement-breakpoint

ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint

ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "legacy_display_key" text;
--> statement-breakpoint

INSERT INTO "projects" ("workspace_id", "name", "description")
SELECT w."id", 'General', ''
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1 FROM "projects" p WHERE p."workspace_id" = w."id"
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint

UPDATE "mark_workflow_statuses"
SET "name" = 'Closed', "updated_at" = now()
WHERE "name" = 'Resolved'
  AND "is_default_closed" = true
  AND "archived_at" IS NULL;
--> statement-breakpoint

INSERT INTO "mark_workflow_statuses"
  ("workspace_id", "name", "color", "position", "lifecycle_status", "is_default_open")
SELECT w."id", 'Open', 'blue', 0, 'open', true
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1
  FROM "mark_workflow_statuses" s
  WHERE s."workspace_id" = w."id"
    AND s."archived_at" IS NULL
    AND s."lifecycle_status" = 'open'
);
--> statement-breakpoint

INSERT INTO "mark_workflow_statuses"
  ("workspace_id", "name", "color", "position", "lifecycle_status", "is_default_closed")
SELECT w."id", 'Closed', 'green', 1, 'closed', true
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1
  FROM "mark_workflow_statuses" s
  WHERE s."workspace_id" = w."id"
    AND s."archived_at" IS NULL
    AND s."lifecycle_status" = 'closed'
);
--> statement-breakpoint

UPDATE "mark_workflow_statuses"
SET "is_default_open" = false, "updated_at" = now()
WHERE "lifecycle_status" = 'open'
  AND "archived_at" IS NULL;
--> statement-breakpoint

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "workspace_id"
      ORDER BY "is_default_open" DESC, "position", "created_at", "id"
    ) AS rn
  FROM "mark_workflow_statuses"
  WHERE "lifecycle_status" = 'open'
    AND "archived_at" IS NULL
)
UPDATE "mark_workflow_statuses" s
SET "is_default_open" = true, "updated_at" = now()
FROM ranked r
WHERE s."id" = r."id"
  AND r.rn = 1;
--> statement-breakpoint

UPDATE "mark_workflow_statuses"
SET "is_default_closed" = false, "updated_at" = now()
WHERE "lifecycle_status" = 'closed'
  AND "archived_at" IS NULL;
--> statement-breakpoint

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "workspace_id"
      ORDER BY "is_default_closed" DESC, "position", "created_at", "id"
    ) AS rn
  FROM "mark_workflow_statuses"
  WHERE "lifecycle_status" = 'closed'
    AND "archived_at" IS NULL
)
UPDATE "mark_workflow_statuses" s
SET "is_default_closed" = true, "updated_at" = now()
FROM ranked r
WHERE s."id" = r."id"
  AND r.rn = 1;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.seed_default_mark_workflow_statuses()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mark_workflow_statuses
    (workspace_id, name, color, position, lifecycle_status, is_default_open)
  VALUES (NEW.id, 'Open', 'blue', 0, 'open'::public.mark_status, true);

  INSERT INTO public.mark_workflow_statuses
    (workspace_id, name, color, position, lifecycle_status, is_default_closed)
  VALUES (NEW.id, 'Closed', 'green', 1, 'closed'::public.mark_status, true);

  RETURN NEW;
END;
$$;
--> statement-breakpoint

UPDATE "marks" m
SET "legacy_display_key" =
  upper(COALESCE(NULLIF(trim(s."code"), ''), 'OLD')) || '-' || m."seq"
FROM "spaces" s
WHERE m."space_id" = s."id"
  AND m."legacy_display_key" IS NULL;
--> statement-breakpoint

UPDATE "marks" m
SET "project_id" = s."project_id"
FROM "spaces" s
WHERE m."space_id" = s."id"
  AND m."project_id" IS NULL;
--> statement-breakpoint

WITH first_project AS (
  SELECT DISTINCT ON ("workspace_id") "workspace_id", "id"
  FROM "projects"
  ORDER BY "workspace_id", "created_at", "id"
)
UPDATE "marks" m
SET "project_id" = fp."id"
FROM first_project fp
WHERE m."workspace_id" = fp."workspace_id"
  AND m."project_id" IS NULL;
--> statement-breakpoint

UPDATE "marks"
SET "legacy_display_key" = 'LEGACY-' || "seq"
WHERE "legacy_display_key" IS NULL
  AND "seq" > 0;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "marks_set_seq" ON "marks";
--> statement-breakpoint

DROP TRIGGER IF EXISTS "marks_assign_sequence_trg" ON "marks";
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.set_mark_seq();
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.marks_assign_sequence();
--> statement-breakpoint

DROP INDEX IF EXISTS "marks_space_seq_unique";
--> statement-breakpoint

DROP INDEX IF EXISTS "marks_space_status_priority_idx";
--> statement-breakpoint

WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "workspace_id"
      ORDER BY "created_at", "id"
    )::integer AS seq
  FROM "marks"
)
UPDATE "marks" m
SET "seq" = ranked.seq
FROM ranked
WHERE m."id" = ranked."id";
--> statement-breakpoint

UPDATE "workspaces" w
SET "next_mark_seq" = COALESCE(mark_counts.max_seq, 0)
FROM (
  SELECT "workspace_id", max("seq") AS max_seq
  FROM "marks"
  GROUP BY "workspace_id"
) mark_counts
WHERE w."id" = mark_counts."workspace_id";
--> statement-breakpoint

UPDATE "workspaces" w
SET "next_mark_seq" = 0
WHERE NOT EXISTS (
  SELECT 1 FROM "marks" m WHERE m."workspace_id" = w."id"
);
--> statement-breakpoint

UPDATE "marks" m
SET "workflow_status_id" = s."id"
FROM "mark_workflow_statuses" s
WHERE (m."workflow_status_id" IS NULL OR m."workflow_status_id" NOT IN (
    SELECT active_status."id"
    FROM "mark_workflow_statuses" active_status
    WHERE active_status."workspace_id" = m."workspace_id"
      AND active_status."archived_at" IS NULL
  ))
  AND s."workspace_id" = m."workspace_id"
  AND s."lifecycle_status" = m."status"
  AND s."archived_at" IS NULL
  AND (
    (m."status" = 'open' AND s."is_default_open" = true)
    OR (m."status" = 'closed' AND s."is_default_closed" = true)
  );
--> statement-breakpoint

ALTER TABLE "marks" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "marks" ALTER COLUMN "workflow_status_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "marks" DROP CONSTRAINT IF EXISTS "marks_space_id_spaces_id_fk";
--> statement-breakpoint

ALTER TABLE "marks" DROP CONSTRAINT IF EXISTS "marks_project_id_projects_id_fk";
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marks_project_workspace_fk'
  ) THEN
    ALTER TABLE "marks"
      ADD CONSTRAINT "marks_project_workspace_fk"
      FOREIGN KEY ("workspace_id", "project_id")
      REFERENCES "projects"("workspace_id", "id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "marks_workspace_seq_unique"
  ON "marks" USING btree ("workspace_id", "seq");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "marks_project_status_priority_idx"
  ON "marks" USING btree ("project_id", "status", "priority");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "marks_workspace_project_idx"
  ON "marks" USING btree ("workspace_id", "project_id");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.set_mark_seq()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.seq IS NULL OR NEW.seq <= 0) THEN
    UPDATE public.workspaces
       SET next_mark_seq = next_mark_seq + 1
     WHERE id = NEW.workspace_id
    RETURNING next_mark_seq INTO NEW.seq;

    IF NEW.seq IS NULL THEN
      RAISE EXCEPTION 'set_mark_seq: workspace % does not exist', NEW.workspace_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "marks_set_seq"
BEFORE INSERT ON "marks"
FOR EACH ROW EXECUTE FUNCTION public.set_mark_seq();
--> statement-breakpoint

ALTER TABLE "workspace_review_links" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint

UPDATE "workspace_review_links" l
SET "project_id" = s."project_id"
FROM "spaces" s
WHERE l."space_id" = s."id"
  AND l."project_id" IS NULL;
--> statement-breakpoint

WITH first_project AS (
  SELECT DISTINCT ON ("workspace_id") "workspace_id", "id"
  FROM "projects"
  ORDER BY "workspace_id", "created_at", "id"
)
UPDATE "workspace_review_links" l
SET "project_id" = fp."id"
FROM first_project fp
WHERE l."workspace_id" = fp."workspace_id"
  AND l."project_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "workspace_review_links" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "workspace_review_links" DROP CONSTRAINT IF EXISTS "workspace_review_links_space_id_spaces_id_fk";
--> statement-breakpoint

ALTER TABLE "workspace_review_links" DROP CONSTRAINT IF EXISTS "workspace_review_links_project_id_projects_id_fk";
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_review_links_project_workspace_fk'
  ) THEN
    ALTER TABLE "workspace_review_links"
      ADD CONSTRAINT "workspace_review_links_project_workspace_fk"
      FOREIGN KEY ("workspace_id", "project_id")
      REFERENCES "projects"("workspace_id", "id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

UPDATE "workspace_views"
SET
  "filters" = COALESCE("filters", '{}'::jsonb) - 'spaceId',
  "config" = COALESCE("config", '{}'::jsonb) - 'analyticsTimeframe';
--> statement-breakpoint

UPDATE "workspace_views"
SET "layout" = 'list'
WHERE "layout"::text = 'analytics';
--> statement-breakpoint

ALTER TYPE "workspace_view_layout" RENAME TO "workspace_view_layout_old";
--> statement-breakpoint

CREATE TYPE "workspace_view_layout" AS ENUM('list', 'board');
--> statement-breakpoint

ALTER TABLE "workspace_views"
  ALTER COLUMN "layout" TYPE "workspace_view_layout"
  USING "layout"::text::"workspace_view_layout";
--> statement-breakpoint

DROP TYPE "workspace_view_layout_old";
--> statement-breakpoint

DROP TRIGGER IF EXISTS "marks_log_change" ON "marks";
--> statement-breakpoint

DROP FUNCTION IF EXISTS public.log_mark_change();
--> statement-breakpoint

DELETE FROM "mark_events"
WHERE "type"::text = 'linear_link_updated';
--> statement-breakpoint

ALTER TYPE "mark_event_type" RENAME TO "mark_event_type_old";
--> statement-breakpoint

CREATE TYPE "mark_event_type" AS ENUM(
  'created',
  'status_changed',
  'priority_changed',
  'pinned_changed',
  'comment_added',
  'assignee_changed',
  'label_changed'
);
--> statement-breakpoint

ALTER TABLE "mark_events"
  ALTER COLUMN "type" TYPE "mark_event_type"
  USING "type"::text::"mark_event_type";
--> statement-breakpoint

DROP TYPE "mark_event_type_old";
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.log_mark_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by_user_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.mark_events (workspace_id, mark_id, actor_user_id, type, metadata)
    VALUES (
      NEW.workspace_id, NEW.id, v_actor, 'created'::public.mark_event_type,
      jsonb_build_object('summary', 'Mark created.')
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'status_changed',
            OLD.status::text, NEW.status::text);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'priority_changed',
            OLD.priority::text, NEW.priority::text);
  END IF;

  IF NEW.pinned IS DISTINCT FROM OLD.pinned THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'pinned_changed',
            OLD.pinned::text, NEW.pinned::text);
  END IF;

  IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id THEN
    INSERT INTO public.mark_events
      (workspace_id, mark_id, actor_user_id, type, from_value, to_value)
    VALUES (NEW.workspace_id, NEW.id, v_actor, 'assignee_changed',
            OLD.assignee_user_id::text, NEW.assignee_user_id::text);
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "marks_log_change"
AFTER INSERT OR UPDATE ON "marks"
FOR EACH ROW EXECUTE FUNCTION public.log_mark_change();
--> statement-breakpoint

ALTER TABLE "marks" DROP COLUMN IF EXISTS "space_id";
--> statement-breakpoint

ALTER TABLE "workspace_review_links" DROP COLUMN IF EXISTS "space_id";
--> statement-breakpoint

DROP TRIGGER IF EXISTS "spaces_set_updated_at" ON "spaces";
--> statement-breakpoint

DROP TABLE IF EXISTS "spaces" CASCADE;
--> statement-breakpoint
