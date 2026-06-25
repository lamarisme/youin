import { notFound, redirect } from "next/navigation";

import {
  DashboardIndexView,
  DashboardMarkDetailView,
} from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import type { PageSearchParams } from "@/lib/page-search-params";
import {
  dashboardHref,
  markHref,
  type DashboardRouteScope,
} from "@/lib/workspace/routes";

import {
  dashboardRouteScopeCacheKey,
  dashboardSearchParamsKey,
  getDashboardIndexRouteState,
  getDashboardMarkRouteState,
} from "./dashboard-route-state";

function legacyScopeRedirect(
  urlParams: URLSearchParams,
  scope: DashboardRouteScope,
  mark?: string,
) {
  if (scope.kind !== "all") return;

  const projectId = urlParams.get("project")?.trim();
  if (projectId && projectId !== "all") {
    const nextScope = { kind: "project", projectId } satisfies DashboardRouteScope;
    redirect(mark ? markHref(mark, urlParams, nextScope) : dashboardHref(urlParams, nextScope));
  }

  if (urlParams.get("assignee") === "me") {
    const nextScope = { kind: "mine" } satisfies DashboardRouteScope;
    redirect(mark ? markHref(mark, urlParams, nextScope) : dashboardHref(urlParams, nextScope));
  }
}

function ensureProjectScopeExists(
  scope: DashboardRouteScope,
  projects: { id: string }[],
) {
  if (scope.kind !== "project") return;
  if (!projects.some((project) => project.id === scope.projectId)) {
    notFound();
  }
}

export async function renderDashboardIndexPage(
  searchParams: PageSearchParams,
  scope: DashboardRouteScope = { kind: "all" },
) {
  const {
    readModel,
    readModelRequest,
    pendingInvites,
    requestedProjectId,
    urlParams,
  } = await getDashboardIndexRouteState(searchParams, scope);

  legacyScopeRedirect(urlParams, scope);
  ensureProjectScopeExists(scope, readModel.workspace.projects);

  if (
    scope.kind === "all" &&
    requestedProjectId &&
    !readModel.workspace.projects.some((project) => project.id === requestedProjectId)
  ) {
    redirect(dashboardHref(urlParams, { kind: "all" }));
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      request={readModelRequest}
    >
      <DashboardIndexView pendingInvites={pendingInvites} routeScope={scope} />
    </DashboardReadModelProvider>
  );
}

export async function getDashboardMarkMetadata(
  mark: string,
  searchParams: PageSearchParams,
  scope: DashboardRouteScope = { kind: "all" },
) {
  const { selectedMark } = await getDashboardMarkRouteState(
    mark,
    dashboardSearchParamsKey(searchParams),
    dashboardRouteScopeCacheKey(scope),
  );

  return {
    title: selectedMark
      ? `${selectedMark.displayKey}: ${selectedMark.title}`
      : "Mark not found",
  };
}

export async function renderDashboardMarkPage({
  mark,
  searchParams,
  scope = { kind: "all" },
}: {
  mark: string;
  searchParams: PageSearchParams;
  scope?: DashboardRouteScope;
}) {
  const {
    readModel,
    readModelRequest,
    urlParams,
  } = await getDashboardMarkRouteState(
    mark,
    dashboardSearchParamsKey(searchParams),
    dashboardRouteScopeCacheKey(scope),
  );

  legacyScopeRedirect(urlParams, scope, mark);
  ensureProjectScopeExists(scope, readModel.workspace.projects);
  if (scope.kind === "project" && readModel.selectedProjectId !== scope.projectId) {
    notFound();
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      request={readModelRequest}
    >
      <DashboardMarkDetailView markParam={mark} routeScope={scope} />
    </DashboardReadModelProvider>
  );
}
