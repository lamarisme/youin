const SENSITIVE_QUERY_PARAMETER =
  /(?:access|auth|code|credential|email|jwt|key|magic|password|refresh|secret|session|signature|state|token)/i

const TRACKING_QUERY_PARAMETER =
  /^(?:_hsenc|_hsmi|dclid|fbclid|gclid|gbraid|mc_cid|mc_eid|msclkid|ref_|utm_|wbraid)/i

/**
 * Produces the stable URL stored with a mark. Fragments and parameters that
 * commonly contain credentials, personal data, or ad attribution are omitted.
 * Benign query parameters remain because many applications use them as route
 * identity (for example `?view=board`).
 */
export function sanitizePageUrl(value: string): string {
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    url.username = ""
    url.password = ""
    url.hash = ""
    for (const key of Array.from(url.searchParams.keys())) {
      if (
        SENSITIVE_QUERY_PARAMETER.test(key) ||
        TRACKING_QUERY_PARAMETER.test(key)
      ) {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()
    return url.href
  } catch {
    return trimmed
  }
}

/**
 * Mirrors apps/web mark-page-url normalization so extension marks match
 * dashboard URLs without depending on the web package.
 */
export function normalizePageUrlForMatch(value: string): string {
  const t = value.trim()
  if (!t) return ""
  if (/^https?:\/\//i.test(t)) {
    return sanitizePageUrl(t)
  }
  if (t.startsWith("//")) {
    try {
      return sanitizePageUrl(new URL(`https:${t}`).href)
    } catch {
      return t
    }
  }
  if (!t.startsWith("/")) {
    try {
      return sanitizePageUrl(new URL(`https://${t}`).href)
    } catch {
      return t
    }
  }
  return t
}
