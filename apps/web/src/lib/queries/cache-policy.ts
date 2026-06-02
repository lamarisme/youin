export const QUERY_CACHE = {
  defaultStaleMs: 60_000,
  workspaceShellStaleMs: 2 * 60_000,
  readModelStaleMs: 2 * 60_000,
  inboxStaleMs: 45_000,
  commandPaletteStaleMs: 2 * 60_000,
  gcMs: 15 * 60_000,
} as const;

export function updatedAtFromIso(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
