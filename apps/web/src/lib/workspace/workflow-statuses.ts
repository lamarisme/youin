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

export const WORKFLOW_STATUS_COLOR_OPTIONS: ReadonlyArray<{
  value: WorkflowStatusColor;
  label: string;
}> = [
  { value: "gray", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "amber", label: "Amber" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "violet", label: "Violet" },
];

const WORKFLOW_STATUS_DOT_CLASSES: Record<WorkflowStatusColor, string> = {
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

const WORKFLOW_STATUS_SURFACE_CLASSES: Record<WorkflowStatusColor, string> = {
  gray: "bg-zinc-500/10",
  blue: "bg-blue-500/10",
  amber: "bg-amber-500/10",
  green: "bg-emerald-500/10",
  red: "bg-red-500/10",
  violet: "bg-violet-500/10",
};

export function workflowStatusDotClass(color: WorkflowStatusColor): string {
  return WORKFLOW_STATUS_DOT_CLASSES[color];
}

export function workflowStatusSurfaceClass(color: WorkflowStatusColor): string {
  return WORKFLOW_STATUS_SURFACE_CLASSES[color];
}

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
