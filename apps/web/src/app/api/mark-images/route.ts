import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspaceContext } from "@/lib/workspace/actions/session";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("/")) return false;
  return value.includes("/");
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim();
  if (!isStoragePath(path)) {
    return NextResponse.json({ error: "Invalid image path." }, { status: 400 });
  }

  const { supabase, workspaceId } = await requireWorkspaceContext();
  if (!path.startsWith(`${workspaceId}/`)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("mark-images")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
