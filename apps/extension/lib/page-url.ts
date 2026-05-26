/**
 * Mirrors apps/web mark-page-url normalization so extension marks match
 * dashboard URLs without depending on the web package.
 */
export function normalizePageUrlForMatch(value: string): string {
  const t = value.trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      return u.href
    } catch {
      return t
    }
  }
  if (t.startsWith("//")) {
    try {
      return new URL(`https:${t}`).href
    } catch {
      return t
    }
  }
  if (!t.startsWith("/")) {
    try {
      return new URL(`https://${t}`).href
    } catch {
      return t
    }
  }
  return t
}
