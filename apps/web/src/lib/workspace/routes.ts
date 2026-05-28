const ACCOUNT_SECTIONS = [
  "overview",
  "team",
  "integrations",
  "labels",
  "statuses",
  "profile",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export function isAccountSection(value: string | null | undefined): value is AccountSection {
  return ACCOUNT_SECTIONS.includes(value as AccountSection);
}

function queryWithout(
  searchParams: { toString: () => string } | URLSearchParams,
  keys: string[],
): string {
  const params = new URLSearchParams(searchParams.toString());
  for (const key of keys) params.delete(key);
  return params.toString();
}

function withQuery(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

export function dashboardHref(searchParams: { toString: () => string } | URLSearchParams): string {
  return withQuery("/dashboard", queryWithout(searchParams, ["mark"]));
}

export function markHref(
  displayKey: string,
  searchParams: { toString: () => string } | URLSearchParams,
): string {
  return withQuery(
    `/dashboard/${encodeURIComponent(displayKey)}`,
    queryWithout(searchParams, ["mark", "page"]),
  );
}

export function accountHref(section: AccountSection): string {
  return section === "overview" ? "/account" : `/account/${section}`;
}
