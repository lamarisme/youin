import "server-only";

import { cache } from "react";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { workspaceMembers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/workspace/authz";
import { resolveWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export function revalidateWorkspaceViews(): void {
  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/inbox");
  revalidatePath("/views");
}

type AppDb = ReturnType<typeof getDb>;
export type WorkspaceTransaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

type RequestScopedDb = {
  execute(query: SQL): Promise<unknown>;
};

export interface WorkspaceContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  db: AppDb;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceSession {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId: string;
}

export type WorkspaceSessionResult =
  | { status: "anonymous" }
  | { status: "unresolved"; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { status: "authenticated"; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; workspaceId: string };

export async function setDbRequestUser(
  dbOrTx: RequestScopedDb,
  userId: string,
): Promise<void> {
  await dbOrTx.execute(
    sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
  );
}

export async function withWorkspaceActor<T>(
  ctx: WorkspaceContext,
  fn: (tx: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  return ctx.db.transaction(async (tx) => {
    await setDbRequestUser(tx, ctx.userId);
    return fn(tx);
  });
}

export const getWorkspaceSessionResult = cache(async (): Promise<WorkspaceSessionResult> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "anonymous" };
  const workspaceId = await resolveWorkspaceForUser(supabase, user);
  if (!workspaceId) {
    return { status: "unresolved", supabase, userId: user.id };
  }
  return { status: "authenticated", supabase, userId: user.id, workspaceId };
});

export const getWorkspaceSession = cache(async (): Promise<WorkspaceSession | null> => {
  const result = await getWorkspaceSessionResult();
  if (result.status !== "authenticated") return null;
  return {
    supabase: result.supabase,
    userId: result.userId,
    workspaceId: result.workspaceId,
  };
});

export const requireWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const session = await getWorkspaceSession();
  if (!session) throw new Error("Unauthorized");
  const db = getDb();
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, session.workspaceId),
        eq(workspaceMembers.userId, session.userId),
      ),
    )
    .limit(1);

  if (!member) throw new Error("Workspace membership not found.");
  return { ...session, db, role: member.role };
});

export const requireSession = requireWorkspaceContext;
