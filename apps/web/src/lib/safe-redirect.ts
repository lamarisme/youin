const LOCAL_REDIRECT_ORIGIN = "https://youin.local";
const DEFAULT_LOCAL_REDIRECT = "/dashboard";

function safeFallbackPath(fallback: string): string {
  return fallback.startsWith("/") && !fallback.startsWith("//") && !fallback.startsWith("/\\")
    ? fallback
    : DEFAULT_LOCAL_REDIRECT;
}

export function safeLocalRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_LOCAL_REDIRECT,
): string {
  const safeFallback = safeFallbackPath(fallback);
  const requested = typeof value === "string" ? value.trim() : "";
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    requested.startsWith("/\\")
  ) {
    return safeFallback;
  }

  try {
    const url = new URL(requested, LOCAL_REDIRECT_ORIGIN);
    if (url.origin !== LOCAL_REDIRECT_ORIGIN) return safeFallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return safeFallback;
  }
}
