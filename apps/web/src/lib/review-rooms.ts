import type { WorkspaceProject, WorkspaceReviewLink } from "@/lib/collab-types";

export type ReviewRoomStatus = "Active" | "Expired" | "Revoked";

export function reviewScriptUrl(token: string, appOrigin: string): string {
  const path = `/api/review-links/${encodeURIComponent(token)}/script`;
  return appOrigin ? `${appOrigin}${path}` : path;
}

export function reviewScriptSnippet(token: string, appOrigin: string): string {
  return `<script async src="${reviewScriptUrl(token, appOrigin)}"></script>`;
}

export function reviewRoomStatus(room: WorkspaceReviewLink): ReviewRoomStatus {
  if (room.revokedAt) return "Revoked";
  if (room.expiresAt && new Date(room.expiresAt).getTime() <= Date.now()) {
    return "Expired";
  }
  return "Active";
}

export function reviewRoomStatusClassName(status: ReviewRoomStatus): string {
  switch (status) {
    case "Active":
      return "border-ok/30 bg-ok/10 text-ok";
    case "Expired":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "Revoked":
      return "border-rule/70 bg-paper-3 text-ink-3";
  }
}

export function reviewRoomProjectName(
  projects: WorkspaceProject[],
  projectId: string,
): string {
  return (
    projects.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}
