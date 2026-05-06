-- Allow each member to update their own workspace_members row (e.g. workspace username).

DROP POLICY IF EXISTS workspace_members_update_self ON public.workspace_members;

CREATE POLICY workspace_members_update_self ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    public.user_workspace_member(workspace_id)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.user_workspace_member(workspace_id)
    AND user_id = auth.uid()
  );
