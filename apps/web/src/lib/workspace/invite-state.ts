import type { TeamInvite, TeamInviteStatus } from "@/lib/collab-types";

export function effectiveInviteStatus(
  invite: Pick<TeamInvite, "status" | "expiresAt">,
  now = Date.now(),
): TeamInviteStatus {
  if (
    invite.status === "pending" &&
    new Date(invite.expiresAt).getTime() <= now
  ) {
    return "expired";
  }

  return invite.status;
}
