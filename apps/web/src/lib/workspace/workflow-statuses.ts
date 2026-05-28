import type {
  MarkStatus,
  WorkflowStatusColor,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";

export const WORKFLOW_STATUS_COLORS = [
  "gray",
  "blue",
  "amber",
  "green",
  "red",
  "violet",
] as const;

export function normalizeWorkflowStatusColor(
  value: unknown,
): WorkflowStatusColor {
  return WORKFLOW_STATUS_COLORS.includes(value as WorkflowStatusColor)
    ? (value as WorkflowStatusColor)
    : "gray";
}

export function workflowStatusLabel(
  statusId: string | null | undefined,
  statuses: readonly WorkspaceWorkflowStatus[],
  lifecycle: MarkStatus,
): string {
  const status = statuses.find((item) => item.id === statusId);
  if (status) return status.name;
  return lifecycle === "closed" ? "Closed" : "Open";
}

export function defaultWorkflowStatusForLifecycle(
  statuses: readonly WorkspaceWorkflowStatus[],
  lifecycle: MarkStatus,
): WorkspaceWorkflowStatus | undefined {
  return (
    statuses.find((status) =>
      lifecycle === "open" ? status.isDefaultOpen : status.isDefaultClosed,
    ) ?? statuses.find((status) => status.lifecycleStatus === lifecycle)
  );
}
