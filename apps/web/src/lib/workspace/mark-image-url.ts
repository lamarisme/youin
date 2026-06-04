function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("/")) return false;
  return value.includes("/");
}

export function markImageSrc(value: string | null | undefined): string {
  if (!value) return "";
  if (!isStoragePath(value)) return value;
  return `/api/mark-images?path=${encodeURIComponent(value)}`;
}
