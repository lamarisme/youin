DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.set_mark_seq()',
    'public.tg_set_updated_at()',
    'public.seed_default_mark_workflow_statuses()',
    'public.sync_mark_workflow_status()',
    'public.log_mark_change()',
    'public.log_comment_added()'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
