/** User-facing explanation when stored page text is not a usable absolute URL (e.g. legacy relative paths). */
export const NON_ABSOLUTE_MARK_PAGE_HINT =
  "This isn’t a full http(s) URL yet — use an absolute URL (for example https://…) so teammates can open the page in one click.";

/**
 * Trims input and nudges bare hosts toward `https://`.
 * Paths that start with `/` are left unchanged (legacy data); {@link isValidMarkPageUrl} rejects them on save.
 */
export function normalizeMarkPageUrl(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) {
    try {
      return new URL(`https:${t}`).href;
    } catch {
      return t;
    }
  }
  if (!t.startsWith("/")) {
    try {
      return new URL(`https://${t}`).href;
    } catch {
      return t;
    }
  }
  return t;
}

export function isValidMarkPageUrl(normalized: string): boolean {
  if (!normalized.trim()) return false;
  try {
    const u = new URL(normalized);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** @deprecated Prefer {@link normalizeMarkPageUrl}. */
export function normalizePagePath(value: string): string {
  return normalizeMarkPageUrl(value);
}

/**
 * Resolves a mark `page` field to a browser-safe absolute href, or null if it is not a valid http(s) URL.
 */
export function resolveMarkPageHref(page: string): string | null {
  const n = normalizeMarkPageUrl(page);
  return isValidMarkPageUrl(n) ? n : null;
}

export function absoluteHrefForMarkPage(page: string): string | null {
  return resolveMarkPageHref(page);
}
