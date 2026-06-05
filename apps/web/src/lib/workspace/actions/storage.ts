"use server";

import { and, eq } from "drizzle-orm";

import { marks } from "@/db/schema";
import { normalizeMarkImageExtension } from "@/lib/mark-image-path";

import { requireWorkspaceContext } from "./session";

export async function getMarkUploadUrlAction(
  markId: string,
  fileExtRaw: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { db, supabase, workspaceId } = await requireWorkspaceContext();
  const [mark] = await db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.id, markId), eq(marks.workspaceId, workspaceId)))
    .limit(1);
  if (!mark) throw new Error("Mark not found.");

  const ext = normalizeMarkImageExtension(fileExtRaw);
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${workspaceId}/${markId}/${id}.${ext}`;

  const { data: upload, error: signErr } = await supabase.storage
    .from("mark-images")
    .createSignedUploadUrl(path);
  if (signErr || !upload)
    throw signErr ?? new Error("Could not sign upload URL.");

  return { path, token: upload.token, signedUrl: upload.signedUrl };
}
