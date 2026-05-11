"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";

import { PageContainer } from "@/components/page-container";
import { useCollabStore } from "@/lib/collab-store";

import { WorkspaceMainSkeleton } from "@/components/workspace-shell-skeleton";

import { SpaceDetailView } from "./space-detail-view";
import { SpacesListView } from "./spaces-list-view";

function SpacesClientContent() {
  const spaces = useCollabStore((s) => s.workspace.spaces);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedSpace = useMemo(() => {
    const id = searchParams.get("space");
    if (!id) return null;
    return spaces.find((s) => s.id === id) ?? null;
  }, [searchParams, spaces]);

  const updateSpacesUrl = useCallback(
    (nextSpaceId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextSpaceId) params.set("space", nextSpaceId);
      else params.delete("space");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <PageContainer className="space-y-5">
      {selectedSpace ? (
        <SpaceDetailView space={selectedSpace} onBack={() => updateSpacesUrl(null)} />
      ) : (
        <SpacesListView onSelectSpace={(id) => updateSpacesUrl(id)} />
      )}
    </PageContainer>
  );
}

export default function SpacesClient() {
  return (
    <Suspense fallback={<WorkspaceMainSkeleton />}>
      <SpacesClientContent />
    </Suspense>
  );
}
