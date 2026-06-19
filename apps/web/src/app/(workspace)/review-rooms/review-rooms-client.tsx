"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Globe2,
  MessagesSquare,
} from "lucide-react";
import { useMemo } from "react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { ProductList, ProductListItem } from "@/components/product-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceProject, WorkspaceReviewLink } from "@/lib/collab-types";
import { formatDate, formatRelative } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";

type ReviewRoomStatus = "Active" | "Expired" | "Revoked";

function getReviewRoomStatus(room: WorkspaceReviewLink): ReviewRoomStatus {
  if (room.revokedAt) return "Revoked";
  if (room.expiresAt && new Date(room.expiresAt).getTime() <= Date.now()) {
    return "Expired";
  }
  return "Active";
}

function projectNameFor(
  projects: WorkspaceProject[],
  projectId: string,
): string {
  return projects.find((project) => project.id === projectId)?.name ?? "Unknown project";
}

function statusClassName(status: ReviewRoomStatus): string {
  switch (status) {
    case "Active":
      return "border-ok/30 bg-ok/10 text-ok";
    case "Expired":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "Revoked":
      return "border-rule/70 bg-paper-3 text-ink-3";
  }
}

export function ReviewRoomsClient() {
  const { projects, reviewRooms, workspaceName } = useWorkspaceData((s) => ({
    projects: s.workspace.projects,
    reviewRooms: s.workspace.reviewLinks,
    workspaceName: s.workspace.name,
  }));

  const sortedRooms = useMemo(
    () =>
      [...reviewRooms].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [reviewRooms],
  );

  return (
    <PageContainer>
      <AppHeader
        title="Review Rooms"
        eyebrow="Client review"
        subtitle={`Expose existing guest review links as controlled client review spaces for ${workspaceName || "this workspace"}.`}
      >
        <Button type="button" variant="outline" disabled>
          New Review Room
        </Button>
      </AppHeader>

      {sortedRooms.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No Review Rooms yet."
          description="Create a client-safe review space for each site, staging URL, or handoff window so agency feedback starts in the right project."
          action={
            <Button type="button" disabled>
              Create your first Review Room
            </Button>
          }
        />
      ) : (
        <ProductList>
          {sortedRooms.map((room) => {
            const status = getReviewRoomStatus(room);
            const projectName = projectNameFor(projects, room.projectId);
            return (
              <ProductListItem
                key={room.id}
                interactive={false}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-ui-sm font-medium text-ink">
                      {room.name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("text-ui-2xs", statusClassName(status))}
                    >
                      {status}
                    </Badge>
                  </div>

                  <div className="grid gap-1.5 text-ui-xs text-ink-3 md:grid-cols-2 xl:grid-cols-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Globe2 className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{room.targetOrigin}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <MessagesSquare className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{projectName}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                      <span>Created {formatDate(room.createdAt)}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Clock3 className="size-3.5 shrink-0" aria-hidden />
                      <span>
                        {room.lastUsedAt
                          ? `Last used ${formatRelative(room.lastUsedAt)}`
                          : "Never used"}
                      </span>
                    </span>
                  </div>
                </div>

                <Button asChild variant="ghost" size="sm">
                  <Link href={`/review-rooms/${room.id}`}>
                    Open details
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </ProductListItem>
            );
          })}
        </ProductList>
      )}
    </PageContainer>
  );
}
