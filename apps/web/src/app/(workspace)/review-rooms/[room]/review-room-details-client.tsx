"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Globe2,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { ProductList, ProductListItem } from "@/components/product-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceReviewLink } from "@/lib/collab-types";
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

export function ReviewRoomDetailsClient({ roomId }: { roomId: string }) {
  const { projects, room } = useWorkspaceData((s) => ({
    projects: s.workspace.projects,
    room: s.workspace.reviewLinks.find((link) => link.id === roomId) ?? null,
  }));

  if (!room) {
    return (
      <PageContainer>
        <AppHeader title="Review Room not found" eyebrow="Client review">
          <Button asChild variant="outline">
            <Link href="/review-rooms">
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to Review Rooms
            </Link>
          </Button>
        </AppHeader>
        <EmptyState
          icon={MessagesSquare}
          title="This Review Room is not available."
          description="It may have been removed from the workspace data loaded in this session."
        />
      </PageContainer>
    );
  }

  const status = getReviewRoomStatus(room);
  const projectName =
    projects.find((project) => project.id === room.projectId)?.name ??
    "Unknown project";

  return (
    <PageContainer>
      <AppHeader
        title={room.name}
        eyebrow="Review Room"
        subtitle="Phase 1 exposes the existing guest review link as a read-only room surface."
      >
        <Button asChild variant="outline">
          <Link href="/review-rooms">
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </Link>
        </Button>
      </AppHeader>

      <ProductList>
        <ProductListItem interactive={false} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
              Status
            </p>
            <p className="mt-1 text-ui-sm text-ink">Current room availability</p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-ui-2xs", statusClassName(status))}
          >
            {status}
          </Badge>
        </ProductListItem>
        <DetailRow
          icon={Globe2}
          label="Target origin"
          value={room.targetOrigin}
        />
        <DetailRow
          icon={MessagesSquare}
          label="Destination project"
          value={projectName}
        />
        <DetailRow
          icon={CalendarDays}
          label="Created"
          value={formatDate(room.createdAt)}
        />
        <DetailRow
          icon={Clock3}
          label="Last used"
          value={room.lastUsedAt ? formatRelative(room.lastUsedAt) : "Never used"}
        />
      </ProductList>
    </PageContainer>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <ProductListItem interactive={false} className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-2">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
          {label}
        </p>
        <p className="mt-1 break-words text-ui-sm text-ink">{value}</p>
      </div>
    </ProductListItem>
  );
}
