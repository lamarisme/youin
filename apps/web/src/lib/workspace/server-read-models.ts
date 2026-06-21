import "server-only";

import {
  loadAccountReadModel,
  loadCommandPaletteIndexReadModel,
  loadDashboardReadModel,
  loadViewDetailReadModel,
  loadViewsIndexReadModel,
  loadWorkspaceShellBootstrap,
} from "@/lib/workspace/read-models";
import { loadInboxSnapshotForWorkspace } from "@/lib/workspace/inbox-query";
import {
  getWorkspaceSessionResult,
  requireWorkspaceContext,
} from "@/lib/workspace/actions/session";
import type {
  AccountReadModel,
  CommandPaletteIndexReadModel,
  DashboardReadModel,
  DashboardReadModelRequest,
  ViewDetailReadModel,
  ViewsIndexReadModel,
  WorkspaceShellBootstrap,
} from "@/lib/workspace/workspace-types";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";

export type AuthenticatedWorkspaceSession = {
  userId: string;
  workspaceId: string;
};

export type CurrentWorkspaceSessionResult =
  | { status: "authenticated"; session: AuthenticatedWorkspaceSession }
  | { status: "anonymous" }
  | { status: "unresolved" }
  | { status: "incomplete" };

export type CurrentWorkspaceShellBootstrapResult =
  | { status: "authenticated"; bootstrap: WorkspaceShellBootstrap }
  | { status: "anonymous" }
  | { status: "unresolved" }
  | { status: "incomplete" };

export type WorkspaceShellBootstrapForSessionResult =
  | { status: "authenticated"; bootstrap: WorkspaceShellBootstrap }
  | { status: "incomplete" };

function logWorkspaceBootstrapError(error: unknown): void {
  if (error instanceof Error) {
    const extra = error as { code?: unknown; digest?: unknown };
    console.error("getWorkspaceBootstrap failed:", {
      name: error.name,
      message: error.message,
      code: typeof extra.code === "string" ? extra.code : undefined,
      digest: typeof extra.digest === "string" ? extra.digest : undefined,
    });
    if (error.stack) console.error(error.stack);
    return;
  }
  console.error("getWorkspaceBootstrap failed:", String(error));
}

function isNextDynamicServerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { digest?: unknown; __NEXT_ERROR_CODE?: unknown };
  return (
    maybeError.digest === "DYNAMIC_SERVER_USAGE" ||
    maybeError.__NEXT_ERROR_CODE === "E558"
  );
}

export async function getCurrentWorkspaceShellBootstrap(): Promise<CurrentWorkspaceShellBootstrapResult> {
  const sessionResult = await getCurrentWorkspaceSession();
  if (sessionResult.status !== "authenticated") return sessionResult;
  return getWorkspaceShellBootstrapForSession(sessionResult.session);
}

export async function getCurrentWorkspaceSession(): Promise<CurrentWorkspaceSessionResult> {
  try {
    const session = await getWorkspaceSessionResult();
    if (session.status === "anonymous") return { status: "anonymous" };
    if (session.status === "unresolved") return { status: "unresolved" };
    return {
      status: "authenticated",
      session: {
        userId: session.userId,
        workspaceId: session.workspaceId,
      },
    };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logWorkspaceBootstrapError(error);
    return { status: "incomplete" };
  }
}

export async function getWorkspaceShellBootstrapForSession(
  session: AuthenticatedWorkspaceSession,
): Promise<WorkspaceShellBootstrapForSessionResult> {
  try {
    const bootstrap = await loadWorkspaceShellBootstrap(
      session.workspaceId,
      session.userId,
    );
    return { status: "authenticated", bootstrap };
  } catch (error) {
    if (isNextDynamicServerError(error)) throw error;
    logWorkspaceBootstrapError(error);
    return { status: "incomplete" };
  }
}

export async function getDashboardReadModelForCurrentWorkspace(
  request: DashboardReadModelRequest = {},
): Promise<DashboardReadModel> {
  const { workspaceId, supabase, userId } = await requireWorkspaceContext();
  return loadDashboardReadModel(workspaceId, request, supabase, userId);
}

export async function getAccountReadModelForCurrentWorkspace(): Promise<AccountReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadAccountReadModel(workspaceId);
}

export async function getViewsIndexReadModelForCurrentWorkspace(): Promise<ViewsIndexReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadViewsIndexReadModel(workspaceId);
}

export async function getViewDetailReadModelForCurrentWorkspace(): Promise<ViewDetailReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadViewDetailReadModel(workspaceId);
}

export async function getCommandPaletteIndexReadModelForCurrentWorkspace(): Promise<CommandPaletteIndexReadModel> {
  const { workspaceId } = await requireWorkspaceContext();
  return loadCommandPaletteIndexReadModel(workspaceId);
}

export async function getInboxReadModelForCurrentWorkspace(): Promise<InboxSnapshot> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  return loadInboxSnapshotForWorkspace({ db, userId, workspaceId });
}
