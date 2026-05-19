"use server";

import { and, eq } from "drizzle-orm";

import { marks } from "@/db/schema";

import { requireWorkspaceContext } from "./session";

export async function getMarkUploadUrlAction(
  pinId: string,
  fileExtRaw: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { db, supabase, workspaceId } = await requireWorkspaceContext();
  const [mark] = await db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.id, pinId), eq(marks.workspaceId, workspaceId)))
    .limit(1);
  if (!mark) throw new Error("Mark not found.");

  const ext =
    (fileExtRaw || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) ||
    "bin";
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${workspaceId}/${pinId}/${id}.${ext}`;

  const { data: upload, error: signErr } = await supabase.storage
    .from("mark-images")
    .createSignedUploadUrl(path);
  if (signErr || !upload)
    throw signErr ?? new Error("Could not sign upload URL.");

  return { path, token: upload.token, signedUrl: upload.signedUrl };
}
