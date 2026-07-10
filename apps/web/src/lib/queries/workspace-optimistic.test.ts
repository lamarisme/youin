import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { useWorkspaceUiStore } from "@/lib/collab-store";
import { workspaceKeys } from "@/lib/queries/keys";
import {
  prepareOptimisticMutation,
  restoreWorkspace,
  settleWorkspaceMutation,
  updateWorkspace,
} from "@/lib/queries/workspace-optimistic";
import { emptyWorkspaceBootstrap } from "@/lib/workspace/snapshot";

function createWorkspaceQueryClient() {
  const queryClient = new QueryClient();
  const bootstrap = emptyWorkspaceBootstrap();
  bootstrap.workspaceId = "workspace-a";
  bootstrap.workspace.id = "workspace-a";
  bootstrap.workspace.marks = [
    {
      id: "mark-a",
      projectId: "project-a",
      seq: 1,
      displayKey: "YIN-1",
      title: "Original",
      page: "https://example.com",
      description: "",
      status: "open",
      workflowStatusId: "status-open",
      priority: "medium",
      pinned: false,
      labelIds: [],
      createdAt: "2026-07-10T00:00:00.000Z",
    },
  ];
  queryClient.setQueryData(workspaceKeys.bootstrap(), bootstrap);
  queryClient.setQueryData(workspaceKeys.dashboards(), { loadedAt: "now" });
  queryClient.setQueryData(workspaceKeys.account(), { loadedAt: "now" });
  return queryClient;
}

test("keeps optimistic server state in the query cache", async () => {
  const queryClient = createWorkspaceQueryClient();
  const context = await prepareOptimisticMutation(queryClient);

  updateWorkspace(queryClient, (workspace) => ({
    ...workspace,
    marks: workspace.marks.map((mark) =>
      mark.id === "mark-a" ? { ...mark, title: "Optimistic" } : mark,
    ),
  }));

  const current = queryClient.getQueryData<ReturnType<typeof emptyWorkspaceBootstrap>>(
    workspaceKeys.bootstrap(),
  );
  assert.equal(current?.workspace.marks[0]?.title, "Optimistic");

  restoreWorkspace(queryClient, context);
  assert.equal(
    queryClient.getQueryData<ReturnType<typeof emptyWorkspaceBootstrap>>(
      workspaceKeys.bootstrap(),
    )?.workspace.marks[0]?.title,
    "Original",
  );

  await settleWorkspaceMutation(queryClient, context, [workspaceKeys.dashboards()]);
});

test("batches concurrent mutation invalidations and preserves newer overlays", async () => {
  const queryClient = createWorkspaceQueryClient();
  const first = await prepareOptimisticMutation(queryClient);
  updateWorkspace(queryClient, (workspace) => ({
    ...workspace,
    marks: workspace.marks.map((mark) => ({ ...mark, title: "First" })),
  }));

  const second = await prepareOptimisticMutation(queryClient);
  updateWorkspace(queryClient, (workspace) => ({
    ...workspace,
    marks: workspace.marks.map((mark) => ({ ...mark, pinned: true })),
  }));

  restoreWorkspace(queryClient, first);
  const current = queryClient.getQueryData<ReturnType<typeof emptyWorkspaceBootstrap>>(
    workspaceKeys.bootstrap(),
  );
  assert.equal(current?.workspace.marks[0]?.title, "First");
  assert.equal(current?.workspace.marks[0]?.pinned, true);

  await settleWorkspaceMutation(queryClient, first, [workspaceKeys.dashboards()]);
  assert.equal(
    queryClient.getQueryState(workspaceKeys.dashboards())?.isInvalidated,
    false,
  );

  await settleWorkspaceMutation(queryClient, second, [workspaceKeys.account()]);
  assert.equal(
    queryClient.getQueryState(workspaceKeys.dashboards())?.isInvalidated,
    true,
  );
  assert.equal(
    queryClient.getQueryState(workspaceKeys.account())?.isInvalidated,
    true,
  );
  assert.equal(useWorkspaceUiStore.getState().pendingOptimisticMutationIds.length, 0);
});
