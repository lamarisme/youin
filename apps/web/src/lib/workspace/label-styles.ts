/** Rotating surface classes for label chips — aligns with editorial neutrals + mark accent rhythm. */
const LABEL_SURFACE_CLASSES = [
  "bg-mark-soft text-ink",
  "bg-paper-2 text-ink",
  "bg-paper-3 text-ink",
  "text-ink bg-ok-soft",
] as const;

export function labelColorClass(labelId: string): string {
  let h = 0;
  for (let i = 0; i < labelId.length; i++) h = (h + labelId.charCodeAt(i) * (i + 1)) % 997;
  return LABEL_SURFACE_CLASSES[h % LABEL_SURFACE_CLASSES.length];
}
