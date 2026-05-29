import type { MarkItem, WorkspaceProject } from "@/lib/collab-types";

export function projectMarkCountsFromMarks(
  projects: readonly WorkspaceProject[],
  marks: readonly MarkItem[],
): Map<string, number> {
  const hasHydratedMarks = marks.length > 0;
  const counts = new Map<string, number>();
  for (const project of projects) {
    counts.set(project.id, hasHydratedMarks ? 0 : (project.markCount ?? 0));
  }
  for (const mark of marks) {
    counts.set(mark.projectId, (counts.get(mark.projectId) ?? 0) + 1);
  }
  return counts;
}

export function labelUsageFromMarks(
  marks: readonly Pick<MarkItem, "labelIds">[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const mark of marks) {
    for (const labelId of mark.labelIds) {
      counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
    }
  }
  return counts;
}

export function workflowStatusUsageFromMarks(
  marks: readonly Pick<MarkItem, "workflowStatusId">[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const mark of marks) {
    if (mark.workflowStatusId) {
      counts.set(
        mark.workflowStatusId,
        (counts.get(mark.workflowStatusId) ?? 0) + 1,
      );
    }
  }
  return counts;
}
