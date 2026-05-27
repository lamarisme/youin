CREATE TABLE IF NOT EXISTS "mark_workflow_statuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT 'gray' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "lifecycle_status" "mark_status" DEFAULT 'open' NOT NULL,
  "is_default_open" boolean DEFAULT false NOT NULL,
  "is_default_closed" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "mark_workflow_statuses"
  ADD CONSTRAINT "mark_workflow_statuses_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE UNIQUE INDEX "mark_workflow_statuses_workspace_id_unique"
  ON "mark_workflow_statuses" USING btree ("workspace_id", "id");
--> statement-breakpoint

CREATE UNIQUE INDEX "mark_workflow_statuses_workspace_active_name_unique"
  ON "mark_workflow_statuses" USING btree ("workspace_id", lower("name"))
  WHERE "archived_at" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "mark_workflow_statuses_default_open_unique"
  ON "mark_workflow_statuses" USING btree ("workspace_id")
  WHERE "is_default_open" = true AND "archived_at" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "mark_workflow_statuses_default_closed_unique"
  ON "mark_workflow_statuses" USING btree ("workspace_id")
  WHERE "is_default_closed" = true AND "archived_at" IS NULL;
--> statement-breakpoint

CREATE INDEX "mark_workflow_statuses_workspace_position_idx"
  ON "mark_workflow_statuses" USING btree ("workspace_id", "position");
--> statement-breakpoint

ALTER TABLE "mark_workflow_statuses"
  ADD CONSTRAINT "mark_workflow_statuses_name_not_blank"
  CHECK (length(trim("name")) > 0);
--> statement-breakpoint

ALTER TABLE "mark_workflow_statuses"
  ADD CONSTRAINT "mark_workflow_statuses_default_open_lifecycle"
  CHECK ("is_default_open" = false OR "lifecycle_status" = 'open');
--> statement-breakpoint

ALTER TABLE "mark_workflow_statuses"
  ADD CONSTRAINT "mark_workflow_statuses_default_closed_lifecycle"
  CHECK ("is_default_closed" = false OR "lifecycle_status" = 'closed');
--> statement-breakpoint

ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "workflow_status_id" uuid;
--> statement-breakpoint

ALTER TABLE "marks"
  ADD CONSTRAINT "marks_workflow_status_workspace_fk"
  FOREIGN KEY ("workspace_id", "workflow_status_id")
  REFERENCES "public"."mark_workflow_statuses"("workspace_id", "id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "marks_workspace_workflow_status_idx"
  ON "marks" USING btree ("workspace_id", "workflow_status_id");
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
SELECT w."id", 'Resolved', 'green', 1, 'closed', true
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1
  FROM "mark_workflow_statuses" s
  WHERE s."workspace_id" = w."id"
    AND s."archived_at" IS NULL
    AND s."lifecycle_status" = 'closed'
);
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
  VALUES (NEW.id, 'Resolved', 'green', 1, 'closed'::public.mark_status, true);

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS workspaces_seed_mark_workflow_statuses ON public.workspaces;
--> statement-breakpoint

CREATE TRIGGER workspaces_seed_mark_workflow_statuses
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.seed_default_mark_workflow_statuses();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.sync_mark_workflow_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lifecycle public.mark_status;
  v_default_status_id uuid;
BEGIN
  IF NEW.workflow_status_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      SELECT s.lifecycle_status INTO v_lifecycle
      FROM public.mark_workflow_statuses s
      WHERE s.id = NEW.workflow_status_id
        AND s.workspace_id = NEW.workspace_id
        AND s.archived_at IS NULL;

      IF v_lifecycle IS NULL THEN
        RAISE EXCEPTION 'Workflow status does not belong to this workspace.';
      END IF;

      NEW.status := v_lifecycle;
      RETURN NEW;
    END IF;

    IF NEW.workflow_status_id IS DISTINCT FROM OLD.workflow_status_id THEN
      SELECT s.lifecycle_status INTO v_lifecycle
      FROM public.mark_workflow_statuses s
      WHERE s.id = NEW.workflow_status_id
        AND s.workspace_id = NEW.workspace_id
        AND s.archived_at IS NULL;

      IF v_lifecycle IS NULL THEN
        RAISE EXCEPTION 'Workflow status does not belong to this workspace.';
      END IF;

      NEW.status := v_lifecycle;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT s.id INTO v_default_status_id
    FROM public.mark_workflow_statuses s
    WHERE s.workspace_id = NEW.workspace_id
      AND s.lifecycle_status = NEW.status
      AND s.archived_at IS NULL
    ORDER BY
      CASE
        WHEN NEW.status = 'open' AND s.is_default_open THEN 0
        WHEN NEW.status = 'closed' AND s.is_default_closed THEN 0
        ELSE 1
      END,
      s.position,
      s.created_at
    LIMIT 1;

    NEW.workflow_status_id := v_default_status_id;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.workflow_status_id IS NULL
  THEN
    SELECT s.id INTO v_default_status_id
    FROM public.mark_workflow_statuses s
    WHERE s.workspace_id = NEW.workspace_id
      AND s.lifecycle_status = NEW.status
      AND s.archived_at IS NULL
    ORDER BY
      CASE
        WHEN NEW.status = 'open' AND s.is_default_open THEN 0
        WHEN NEW.status = 'closed' AND s.is_default_closed THEN 0
        ELSE 1
      END,
      s.position,
      s.created_at
    LIMIT 1;

    NEW.workflow_status_id := v_default_status_id;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS marks_sync_workflow_status ON public.marks;
--> statement-breakpoint

CREATE TRIGGER marks_sync_workflow_status
BEFORE INSERT OR UPDATE OF status, workflow_status_id ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.sync_mark_workflow_status();
--> statement-breakpoint

UPDATE "marks" m
SET "workflow_status_id" = s."id"
FROM "mark_workflow_statuses" s
WHERE m."workflow_status_id" IS NULL
  AND s."workspace_id" = m."workspace_id"
  AND s."lifecycle_status" = m."status"
  AND s."archived_at" IS NULL
  AND (
    (m."status" = 'open' AND s."is_default_open" = true)
    OR (m."status" = 'closed' AND s."is_default_closed" = true)
  );
--> statement-breakpoint

ALTER TABLE public.mark_workflow_statuses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY mark_workflow_statuses_all_member ON public.mark_workflow_statuses
  FOR ALL TO authenticated
  USING (public.user_workspace_member(workspace_id))
  WITH CHECK (public.user_workspace_member(workspace_id));
--> statement-breakpoint
