DO $$
DECLARE
  realtime_table text;
  realtime_tables text[] := ARRAY[
    'profiles',
    'workspaces',
    'workspace_members',
    'workspace_invites',
    'projects',
    'mark_labels',
    'mark_workflow_statuses',
    'marks',
    'mark_events',
    'inbox_read_states',
    'workspace_views',
    'workspace_review_links'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RETURN;
  END IF;

  FOREACH realtime_table IN ARRAY realtime_tables LOOP
    IF to_regclass(format('public.%I', realtime_table)) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        realtime_table
      );
    END IF;
  END LOOP;
END $$;
