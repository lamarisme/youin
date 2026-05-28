import type { MarkItem } from "@/lib/collab-types";

/** UUID from URL (any version), case-insensitive. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const WORKSPACE_MARK_PREFIX = "YIN";

export function formatMarkDisplayKey(seq: number): string {
  return `${WORKSPACE_MARK_PREFIX}-${seq}`;
}

export function parseMarkRouteParam(raw: string | null): { kind: "uuid"; id: string } | { kind: "key"; key: string; seq: number } | null {
  if (raw == null) return null;
  const p = decodeURIComponent(raw).trim();
  if (!p) return null;
  if (UUID_RE.test(p)) return { kind: "uuid", id: p };

  const m = /^([A-Za-z0-9]{1,16})-(\d+)$/i.exec(p);
  if (!m) return null;
  const seq = Number.parseInt(m[2], 10);
  if (!Number.isFinite(seq) || seq < 1) return null;
  return { kind: "key", key: `${m[1].toUpperCase()}-${seq}`, seq };
}

export function findMarkByRouteParam(param: string | null, marks: MarkItem[]): MarkItem | undefined {
  const parsed = parseMarkRouteParam(param);
  if (!parsed) return undefined;
  if (parsed.kind === "uuid") return marks.find((p) => p.id === parsed.id);
  return marks.find((p) =>
    p.displayKey.toUpperCase() === parsed.key ||
    p.legacyDisplayKey?.toUpperCase() === parsed.key,
  );
}
