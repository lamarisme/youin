import { getSupabase } from "./supabase"

const MAX_SCREENSHOT_DATA_URL_LENGTH = 900000
const ALLOWED_IMAGE_TYPES: Record<string, { ext: string; contentType: string }> = {
  gif: { ext: "gif", contentType: "image/gif" },
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  jpg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" }
}

export async function uploadMarkScreenshot(
  workspaceId: string,
  markId: string,
  dataUrl: string
): Promise<{ path: string; signedUrl?: string } | { error: string }> {
  if (dataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
    return { error: "Image is too large." }
  }
  const m = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/i)
  if (!m) return { error: "Invalid image data." }
  const mime = m[1].toLowerCase()
  const imageType = ALLOWED_IMAGE_TYPES[mime]
  if (!imageType) return { error: "Use a PNG, JPG, WebP, or GIF image." }
  let binary: Uint8Array
  try {
    binary = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
  } catch {
    return { error: "Could not read image bytes." }
  }
  if (!binary.byteLength) return { error: "Image is empty." }
  const path = `${workspaceId}/${markId}/${Date.now()}.${imageType.ext}`
  const supabase = getSupabase()
  const { error } = await supabase.storage.from("mark-images").upload(path, binary, {
    contentType: imageType.contentType,
    upsert: false
  })
  if (error) return { error: error.message }
  const { data } = await supabase.storage.from("mark-images").createSignedUrl(path, 60 * 60)
  return { path, signedUrl: data?.signedUrl }
}
