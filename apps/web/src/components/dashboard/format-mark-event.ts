import type { MarkEventType } from "@/lib/collab-types";

export function formatMarkEvent(
  type: MarkEventType,
  fromValue?: string,
  toValue?: string,
  metadata?: string,
): string {
  if (type === "created") {
    return metadata ?? "Created this mark.";
  }
  if (type === "status_changed") {
    return `Changed status from ${fromValue ?? "unknown"} to ${toValue ?? "unknown"}.`;
  }
  if (type === "priority_changed") {
    return `Changed priority from ${fromValue ?? "unknown"} to ${toValue ?? "unknown"}.`;
  }
  if (type === "pinned_changed") {
    return toValue === "true" ? "Pinned this mark." : "Unpinned this mark.";
  }
  if (type === "linear_link_updated") {
    return toValue ? "Updated the Linear ticket link." : "Removed the Linear ticket link.";
  }
  if (type === "assignee_changed") {
    if (!toValue) return "Unassigned this mark.";
    if (!fromValue) return "Assigned this mark.";
    return "Reassigned this mark.";
  }
  if (type === "tag_changed") {
    return metadata ?? "Updated the mark's tags.";
  }
  return metadata ?? "Added a comment.";
}

export function shortMarkLabel(markId: string): string {
  return markId.replace(/-/g, "").slice(0, 6).toUpperCase();
}
