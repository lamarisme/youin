"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo } from "react";

import { PageContainer } from "@/components/page-container";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { spaceHref, spacesHref } from "@/lib/workspace/routes";

import { WorkspaceMainSkeleton } from "@/components/workspace-shell-skeleton";

import { SpaceDetailView } from "./space-detail-view";
import { SpacesListView } from "./spaces-list-view";

function SpacesClientContent({ spaceParam = null }: { spaceParam?: string | null }) {
  const spaces = useWorkspaceData((s) => s.workspace.spaces);
  const projects = useWorkspaceData((s) => s.workspace.projects);
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedSpace = useMemo(() => {
    const routeParam = spaceParam ? decodeURIComponent(spaceParam).trim().toUpperCase() : "";
    const id = searchParams.get("space");
    if (routeParam) {
      return spaces.find((s) => s.code.toUpperCase() === routeParam || s.id === routeParam) ?? null;
    }
    if (!id) return null;
    return spaces.find((s) => s.id === id) ?? null;
  }, [searchParams, spaceParam, spaces]);

  useEffect(() => {
    if (spaceParam || !selectedSpace || !searchParams.get("space")) return;
    router.replace(spaceHref(selectedSpace.code, searchParams));
  }, [router, searchParams, selectedSpace, spaceParam]);

  const selectedProjectId = useMemo(() => {
    const id = searchParams.get("project");
    if (id && projects.some((project) => project.id === id)) return id;
    return projects[0]?.id ?? "";
  }, [projects, searchParams]);

  const updateSpacesUrl = useCallback(
    (nextSpaceId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextSpaceId) {
        const spaceProjectId = spaces.find((space) => space.id === nextSpaceId)?.projectId;
        if (spaceProjectId) params.set("project", spaceProjectId);
        const nextSpace = spaces.find((space) => space.id === nextSpaceId);
        if (nextSpace) {
          router.push(spaceHref(nextSpace.code, params));
          return;
        }
      } else {
        params.delete("space");
      }
      router.push(spacesHref(params));
    },
    [router, searchParams, spaces],
  );

  const updateProjectUrl = useCallback(
    (nextProjectId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextProjectId) params.set("project", nextProjectId);
      else params.delete("project");
      params.delete("space");
      const query = params.toString();
      router.push(query ? `/spaces?${query}` : "/spaces");
    },
    [router, searchParams],
  );

  return (
    <PageContainer>
      {selectedSpace ? (
        <SpaceDetailView space={selectedSpace} onBack={() => updateSpacesUrl(null)} />
      ) : (
        <SpacesListView
          selectedProjectId={selectedProjectId}
          onSelectProject={updateProjectUrl}
          onSelectSpace={(id) => updateSpacesUrl(id)}
        />
      )}
    </PageContainer>
  );
}

export default function SpacesClient({ spaceParam = null }: { spaceParam?: string | null }) {
  return (
    <Suspense fallback={<WorkspaceMainSkeleton />}>
      <SpacesClientContent spaceParam={spaceParam} />
    </Suspense>
  );
}
