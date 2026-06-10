import type { WorkspaceInviteAcceptanceStatus } from "./invitations";

export interface WorkspaceInviteAcceptanceFeedback {
  title: string;
  body: string;
  tone: "danger" | "success";
  success: boolean;
}

export function workspaceInviteAcceptanceFeedback(
  status: WorkspaceInviteAcceptanceStatus,
  workspaceName: string,
): WorkspaceInviteAcceptanceFeedback {
  switch (status) {
    case "accepted":
      return {
        title: `Joined ${workspaceName}`,
        body: "The workspace is now active and ready to open.",
        tone: "success",
        success: true,
      };
    case "already_member":
      return {
        title: `Already a member of ${workspaceName}`,
        body: "The workspace is active and ready to open.",
        tone: "success",
        success: true,
      };
    case "already_accepted":
      return {
        title: "Invitation already used",
        body: `This invitation for ${workspaceName} was already accepted. Ask the workspace owner for a new invitation if you still need access.`,
        tone: "danger",
        success: false,
      };
    case "email_mismatch":
      return {
        title: "Invitation belongs to another account",
        body: `Sign in with the email address invited to ${workspaceName}, then try again.`,
        tone: "danger",
        success: false,
      };
    case "expired":
      return {
        title: "Invitation expired",
        body: `Ask the owner of ${workspaceName} to create a new invitation.`,
        tone: "danger",
        success: false,
      };
    case "revoked":
      return {
        title: "Invitation no longer available",
        body: `The owner of ${workspaceName} revoked this invitation.`,
        tone: "danger",
        success: false,
      };
    case "invalid_request":
      return {
        title: "Invitation could not be opened",
        body: "Refresh the page and choose an invitation again.",
        tone: "danger",
        success: false,
      };
    case "not_found":
      return {
        title: "Invitation not found",
        body: "It may have been removed or replaced. Refresh to check for another invitation.",
        tone: "danger",
        success: false,
      };
  }
}
