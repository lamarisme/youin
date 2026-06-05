import { NextResponse, type NextRequest } from "next/server";

import { isMarkImageStoragePath } from "@/lib/mark-image-path";
import { requireWorkspaceContext } from "@/lib/workspace/actions/session";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim();
  if (!path || path.length > 512) {
    return NextResponse.json({ error: "Invalid image path." }, { status: 400 });
  }

  let ctx: Awaited<ReturnType<typeof requireWorkspaceContext>>;
  try {
    ctx = await requireWorkspaceContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isMarkImageStoragePath(path, { workspaceId: ctx.workspaceId })) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const { data, error } = await ctx.supabase.storage
    .from("mark-images")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
