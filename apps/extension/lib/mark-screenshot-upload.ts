import { getSupabase } from "./supabase"

export async function uploadMarkScreenshot(
  workspaceId: string,
  markId: string,
  dataUrl: string
): Promise<{ path: string } | { error: string }> {
  const m = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/i)
  if (!m) return { error: "Invalid image data." }
  const mime = m[1].toLowerCase()
  const ext =
    mime === "jpeg" || mime === "jpg"
      ? "jpg"
      : mime === "png"
        ? "png"
        : mime === "webp"
          ? "webp"
          : "png"
  let binary: Uint8Array
  try {
    binary = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
  } catch {
    return { error: "Could not read image bytes." }
  }
  const path = `${workspaceId}/${markId}/${Date.now()}.${ext}`
  const supabase = getSupabase()
  const { error } = await supabase.storage.from("mark-images").upload(path, binary, {
    contentType: `image/${mime === "jpg" ? "jpeg" : mime}`,
    upsert: false
  })
  if (error) return { error: error.message }
  return { path }
}
