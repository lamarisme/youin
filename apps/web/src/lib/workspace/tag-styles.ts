/** Rotating surface classes for tag chips — aligns with editorial neutrals + mark accent rhythm. */
const TAG_SURFACE_CLASSES = [
  "bg-mark-soft text-ink",
  "bg-paper-2 text-ink",
  "bg-paper-3 text-ink",
  "text-ink bg-ok-soft",
] as const;

export function tagColorClass(tagId: string): string {
  let h = 0;
  for (let i = 0; i < tagId.length; i++) h = (h + tagId.charCodeAt(i) * (i + 1)) % 997;
  return TAG_SURFACE_CLASSES[h % TAG_SURFACE_CLASSES.length];
}
