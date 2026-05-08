"use server";

import { requireSession } from "./session";

export async function getMarkUploadUrlAction(
  pinId: string,
  fileExtRaw: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { supabase, workspaceId } = await requireSession();
  const { data: mark, error } = await supabase
    .from("marks")
    .select("id")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error || !mark) throw error ?? new Error("Mark not found.");

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
