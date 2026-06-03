import type { MarkComment, MarkItem } from "@/lib/collab-types";

export function buildCommentCountByMarkId(
  marks: readonly MarkItem[],
  comments: readonly MarkComment[],
): Map<string, number> {
  const hydratedCounts = new Map<string, number>();
  for (const comment of comments) {
    hydratedCounts.set(
      comment.markId,
      (hydratedCounts.get(comment.markId) ?? 0) + 1,
    );
  }

  const counts = new Map<string, number>();
  for (const mark of marks) {
    counts.set(
      mark.id,
      Math.max(mark.commentCount ?? 0, hydratedCounts.get(mark.id) ?? 0),
    );
  }

  return counts;
}
