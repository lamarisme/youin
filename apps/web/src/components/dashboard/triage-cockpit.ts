import type { MarkItem } from "@/lib/collab-types";

export interface TriageAttentionCounts {
  open: number;
  critical: number;
  mine: number;
  unassigned: number;
}

export function firstVisibleMark(marks: readonly MarkItem[]): MarkItem | null {
  return marks[0] ?? null;
}

export function getTriageAttentionCounts(
  marks: readonly MarkItem[],
  viewerId: string | null,
): TriageAttentionCounts {
  return marks.reduce<TriageAttentionCounts>(
    (counts, mark) => {
      if (mark.status !== "open") return counts;
      counts.open += 1;
      if (mark.priority === "critical") counts.critical += 1;
      if (viewerId && mark.assigneeId === viewerId) counts.mine += 1;
      if (!mark.assigneeId) counts.unassigned += 1;
      return counts;
    },
    { open: 0, critical: 0, mine: 0, unassigned: 0 },
  );
}
