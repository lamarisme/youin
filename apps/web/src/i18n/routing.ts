import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

/** Pathname with optional `/[locale]` prefix removed for route matching */
export function pathnameWithoutLocale(
  pathname: string,
  locales: readonly string[],
): string {
  for (const locale of locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length);
      return rest.length ? rest : "/";
    }
  }
  return pathname;
}
