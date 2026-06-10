export const WORKSPACE_INVITE_ACCEPTANCE_STATUSES = [
  "accepted",
  "already_member",
  "already_accepted",
  "email_mismatch",
  "expired",
  "invalid_request",
  "not_found",
  "revoked",
] as const;

export type WorkspaceInviteAcceptanceStatus =
  (typeof WORKSPACE_INVITE_ACCEPTANCE_STATUSES)[number];

export interface PendingWorkspaceInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  invitedByUserId: string;
  invitedBy: string;
  invitedByEmail: string | null;
  invitedAt: string;
  expiresAt: string;
  source: "signup" | "manual";
}

export interface WorkspaceInviteAcceptanceResult {
  status: WorkspaceInviteAcceptanceStatus;
  workspaceId: string | null;
  inviteId: string | null;
}

export interface AcceptWorkspaceInviteInput {
  inviteId?: string | null;
  token?: string | null;
}

type RpcPendingWorkspaceInviteRow = {
  invite_id?: unknown;
  workspace_id?: unknown;
  workspace_name?: unknown;
  invite_email?: unknown;
  invited_by_user_id?: unknown;
  invited_by_name?: unknown;
  invited_by_email?: unknown;
  invited_at?: unknown;
  expires_at?: unknown;
  source?: unknown;
};

type RpcWorkspaceInviteAcceptanceRow = {
  status?: unknown;
  workspace_id?: unknown;
  invite_id?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

function isInviteAcceptanceStatus(
  value: unknown,
): value is WorkspaceInviteAcceptanceStatus {
  return (
    typeof value === "string" &&
    WORKSPACE_INVITE_ACCEPTANCE_STATUSES.includes(
      value as WorkspaceInviteAcceptanceStatus,
    )
  );
}

function isInviteSource(value: unknown): value is PendingWorkspaceInvite["source"] {
  return value === "signup" || value === "manual";
}

export function isWorkspaceInviteUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function normalizePendingWorkspaceInviteRows(
  rows: unknown,
): PendingWorkspaceInvite[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): PendingWorkspaceInvite | null => {
      const invite = row as RpcPendingWorkspaceInviteRow;
      const id = asString(invite.invite_id);
      const workspaceId = asString(invite.workspace_id);
      const workspaceName = asString(invite.workspace_name);
      const email = asString(invite.invite_email);
      const invitedByUserId = asString(invite.invited_by_user_id);
      const source = isInviteSource(invite.source) ? invite.source : "manual";

      if (!id || !workspaceId || !workspaceName || !email || !invitedByUserId) {
        return null;
      }

      return {
        id,
        workspaceId,
        workspaceName,
        email,
        invitedByUserId,
        invitedBy: asString(invite.invited_by_name) || "Someone",
        invitedByEmail: asNullableString(invite.invited_by_email),
        invitedAt: asIsoString(invite.invited_at),
        expiresAt: asIsoString(invite.expires_at),
        source,
      };
    })
    .filter((invite): invite is PendingWorkspaceInvite => invite !== null);
}

export function normalizeWorkspaceInviteAcceptanceResult(
  rows: unknown,
): WorkspaceInviteAcceptanceResult {
  const row = Array.isArray(rows)
    ? (rows[0] as RpcWorkspaceInviteAcceptanceRow | undefined)
    : (rows as RpcWorkspaceInviteAcceptanceRow | undefined);

  if (!row) {
    return { status: "not_found", workspaceId: null, inviteId: null };
  }

  return {
    status: isInviteAcceptanceStatus(row.status) ? row.status : "not_found",
    workspaceId: asNullableString(row.workspace_id),
    inviteId: asNullableString(row.invite_id),
  };
}

