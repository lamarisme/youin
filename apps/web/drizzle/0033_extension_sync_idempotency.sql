ALTER TABLE public.marks
ADD COLUMN IF NOT EXISTS client_mutation_id text;

ALTER TABLE public.mark_comments
ADD COLUMN IF NOT EXISTS client_mutation_id text;

ALTER TABLE public.marks
ADD COLUMN IF NOT EXISTS capture_kind text,
ADD COLUMN IF NOT EXISTS capture_bbox jsonb,
ADD COLUMN IF NOT EXISTS page_title text,
ADD COLUMN IF NOT EXISTS element_fingerprint jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS marks_extension_mutation_unique
ON public.marks (workspace_id, created_by_user_id, client_mutation_id)
WHERE client_mutation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mark_comments_extension_mutation_unique
ON public.mark_comments (author_user_id, client_mutation_id)
WHERE client_mutation_id IS NOT NULL;
