-- Rename mark_tags → mark_labels and related identifiers; data-preserving.

-- 1. Tables
ALTER TABLE "mark_tags" RENAME TO "mark_labels";
ALTER TABLE "marks_to_tags" RENAME TO "marks_to_labels";

-- 2. Columns
ALTER TABLE "mark_labels" RENAME COLUMN "label" TO "name";
ALTER TABLE "marks_to_labels" RENAME COLUMN "tag_id" TO "label_id";

-- 3. Indexes
ALTER INDEX "mark_tags_workspace_label_unique" RENAME TO "mark_labels_workspace_name_unique";

-- 4. Constraints (Postgres keeps old names after table rename; rename for hygiene)
ALTER TABLE "mark_labels" RENAME CONSTRAINT "mark_tags_workspace_id_workspaces_id_fk"
  TO "mark_labels_workspace_id_workspaces_id_fk";

ALTER TABLE "marks_to_labels" RENAME CONSTRAINT "marks_to_tags_mark_id_marks_id_fk"
  TO "marks_to_labels_mark_id_marks_id_fk";
ALTER TABLE "marks_to_labels" RENAME CONSTRAINT "marks_to_tags_tag_id_mark_tags_id_fk"
  TO "marks_to_labels_label_id_mark_labels_id_fk";
ALTER TABLE "marks_to_labels" RENAME CONSTRAINT "marks_to_tags_mark_id_tag_id_pk"
  TO "marks_to_labels_mark_id_label_id_pk";

-- 5. Enum value (mark_event_type.tag_changed → label_changed)
ALTER TYPE "mark_event_type" RENAME VALUE 'tag_changed' TO 'label_changed';
