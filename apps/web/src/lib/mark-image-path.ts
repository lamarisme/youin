const MARK_IMAGE_EXTENSIONS = new Set(["gif", "jpg", "jpeg", "png", "webp"]);
const STORAGE_SEGMENT_RE = /^[a-z0-9][a-z0-9_-]{0,127}$/i;

export function normalizeMarkImageExtension(raw: string): string {
  const ext = (raw || "png")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 8);
  if (!MARK_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Upload an image file as PNG, JPG, WebP, or GIF.");
  }
  return ext === "jpeg" ? "jpg" : ext;
}

export function isMarkImageStoragePath(
  value: string | null | undefined,
  options?: { workspaceId?: string; markId?: string },
): value is string {
  if (!value || value.length > 512) return false;
  if (value.startsWith("/") || value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;

  const parts = value.split("/");
  if (parts.length !== 3) return false;
  const [workspaceId, markId, fileName] = parts;
  if (options?.workspaceId && workspaceId !== options.workspaceId) return false;
  if (options?.markId && markId !== options.markId) return false;
  if (
    !STORAGE_SEGMENT_RE.test(workspaceId) ||
    !STORAGE_SEGMENT_RE.test(markId) ||
    fileName.includes("..")
  ) {
    return false;
  }

  const match = /^([a-z0-9][a-z0-9_.-]{0,180})\.([a-z0-9]{2,8})$/i.exec(
    fileName,
  );
  if (!match) return false;
  return MARK_IMAGE_EXTENSIONS.has(match[2].toLowerCase());
}
