import { isMarkImageStoragePath } from "@/lib/mark-image-path";

export function markImageSrc(value: string | null | undefined): string {
  if (!value) return "";
  if (!isMarkImageStoragePath(value)) return value;
  return `/api/mark-images?path=${encodeURIComponent(value)}`;
}
