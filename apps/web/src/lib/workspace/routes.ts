const ACCOUNT_SECTIONS = [
  "overview",
  "team",
  "projects",
  "integrations",
  "labels",
  "statuses",
  "profile",
  "danger",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export type DashboardRouteScope =
  | { kind: "all" }
  | { kind: "mine" }
  | { kind: "project"; projectId: string };

export function isAccountSection(value: string | null | undefined): value is AccountSection {
  return ACCOUNT_SECTIONS.includes(value as AccountSection);
}

function withQuery(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

function dashboardScopePath(scope: DashboardRouteScope): string {
  if (scope.kind === "mine") return "/dashboard/mine";
  if (scope.kind === "project") {
    return `/dashboard/projects/${encodeURIComponent(scope.projectId)}`;
  }
  return "/dashboard";
}

function dashboardScopeFromSearchParams(
  searchParams: { toString: () => string } | URLSearchParams,
): DashboardRouteScope {
  const params = new URLSearchParams(searchParams.toString());
  const projectId = params.get("project")?.trim();
  if (projectId && projectId !== "all") {
    return { kind: "project", projectId };
  }
  return { kind: "all" };
}

export function dashboardScopeFromPathname(pathname: string): DashboardRouteScope {
  const segments = pathname.split("?")[0]?.split("/").filter(Boolean) ?? [];
  if (segments[0] !== "dashboard") return { kind: "all" };
  if (segments[1] === "mine") return { kind: "mine" };
  if (segments[1] === "projects" && segments[2]) {
    return { kind: "project", projectId: decodeURIComponent(segments[2]) };
  }
  return { kind: "all" };
}

function dashboardQueryWithoutRouteScope(
  searchParams: { toString: () => string } | URLSearchParams,
  scope: DashboardRouteScope,
  options?: { resetPage?: boolean },
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("mark");
  params.delete("project");
  if (scope.kind === "mine") {
    params.delete("assignee");
  }
  if (options?.resetPage) params.delete("page");
  return params.toString();
}

export function dashboardHref(
  searchParams: { toString: () => string } | URLSearchParams,
  scope: DashboardRouteScope = dashboardScopeFromSearchParams(searchParams),
  options?: { resetPage?: boolean },
): string {
  return withQuery(
    dashboardScopePath(scope),
    dashboardQueryWithoutRouteScope(searchParams, scope, options),
  );
}

export function markHref(
  displayKey: string,
  searchParams: { toString: () => string } | URLSearchParams,
  scope: DashboardRouteScope = dashboardScopeFromSearchParams(searchParams),
  options?: { resetPage?: boolean },
): string {
  const base = `${dashboardScopePath(scope)}/${encodeURIComponent(displayKey)}`;
  return withQuery(base, dashboardQueryWithoutRouteScope(searchParams, scope, options));
}

export function accountHref(section: AccountSection): string {
  return section === "overview" ? "/account" : `/account/${section}`;
}
