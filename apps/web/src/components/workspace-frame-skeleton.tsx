import { AppShellFrame } from "@/components/app-shell";
import { AppSidebarSkeleton } from "@/components/app-sidebar-skeleton";
import { WorkspaceMainSkeleton } from "@/components/workspace-shell-skeleton";

export function WorkspaceFrameSkeleton() {
  return (
    <AppShellFrame sidebar={<AppSidebarSkeleton />}>
      <WorkspaceMainSkeleton id="Loading workspace data" />
    </AppShellFrame>
  );
}
