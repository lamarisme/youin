import type { MarkEventType } from "@/lib/collab-types";

export function formatMarkEvent(
  type: MarkEventType,
  fromValue?: string,
  toValue?: string,
  metadata?: string,
): string {
  const summary = metadataSummary(metadata);

  if (type === "created") {
    return summary ?? "Created this mark.";
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
  if (type === "prompt_copied") {
    return summary ?? "Copied an AI prompt.";
  }
  if (type === "assignee_changed") {
    if (!toValue) return "Unassigned this mark.";
    if (!fromValue) return "Assigned this mark.";
    return "Reassigned this mark.";
  }
  if (type === "label_changed") {
    return summary ?? "Updated the mark's labels.";
  }
  return summary ?? "Added a comment.";
}

function metadataSummary(metadata?: string): string | undefined {
  if (!metadata) return undefined;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const summary = (parsed as { summary?: unknown }).summary;
      if (typeof summary === "string" && summary.trim()) return summary;
    }
  } catch {
    // Older events can store plain text metadata.
  }
  return metadata;
}

export function shortMarkLabel(displayKeyOrUuid: string): string {
  const t = displayKeyOrUuid.trim();
  if (/^[a-z\d]+-\d+$/i.test(t)) return t.toUpperCase();
  return displayKeyOrUuid.replace(/-/g, "").slice(0, 6).toUpperCase();
}
