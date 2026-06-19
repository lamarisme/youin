"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Globe2,
  MessagesSquare,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { ProductList, ProductListItem } from "@/components/product-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate, formatRelative } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { useCreateReviewLinkMutation } from "@/lib/queries/use-workspace-mutations";
import {
  reviewRoomProjectName,
  reviewRoomStatus,
  reviewRoomStatusClassName,
} from "@/lib/review-rooms";
import { cn } from "@/lib/utils";

export function ReviewRoomsClient() {
  const router = useRouter();
  const { projects, reviewRooms, workspaceName, isOwner } = useWorkspaceData((s) => ({
    projects: s.workspace.projects,
    reviewRooms: s.workspace.reviewLinks,
    workspaceName: s.workspace.name,
    isOwner:
      s.workspace.members.find((member) => member.id === s.userId)?.role ===
      "owner",
  }));
  const { mutateAsync: createReviewRoom, isPending: isCreating } =
    useCreateReviewLinkMutation();
  const reviewProjects = useMemo(
    () => projects.filter((project) => !isOptimisticId(project.id)),
    [projects],
  );

  const sortedRooms = useMemo(
    () =>
      [...reviewRooms].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [reviewRooms],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [targetOrigin, setTargetOrigin] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedProjectId = projectId || reviewProjects[0]?.id || "";
  const trimmedName = roomName.trim();
  const trimmedOrigin = targetOrigin.trim();
  const roomNameTooLong = roomName.trim().length > 80;
  const canCreate =
    isOwner &&
    trimmedName.length > 0 &&
    trimmedOrigin.length > 0 &&
    Boolean(selectedProjectId) &&
    !roomNameTooLong &&
    !isCreating;

  async function handleCreateReviewRoom() {
    if (!canCreate) return;
    setError(null);
    try {
      const created = await createReviewRoom({
        name: roomName,
        targetOrigin,
        projectId: selectedProjectId,
      });
      setRoomName("");
      setTargetOrigin("");
      setCreateOpen(false);
      router.push(`/review-rooms/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create this Review Room.");
    }
  }

  return (
    <PageContainer>
      <AppHeader
        title="Review Rooms"
        eyebrow="Client review"
        subtitle={`Expose existing guest review links as controlled client review spaces for ${workspaceName || "this workspace"}.`}
      >
        {isOwner ? (
          <Button type="button" variant="mark" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            New Review Room
          </Button>
        ) : null}
      </AppHeader>

      {sortedRooms.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No Review Rooms yet."
          description="Create a client-safe review space for each site, staging URL, or handoff window so agency feedback starts in the right project."
          action={
            isOwner ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Create your first Review Room
              </Button>
            ) : (
              <Button type="button" disabled>
                Create your first Review Room
              </Button>
            )
          }
        />
      ) : (
        <ProductList>
          {sortedRooms.map((room) => {
            const status = reviewRoomStatus(room);
            const projectName = reviewRoomProjectName(projects, room.projectId);
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
                      className={cn("text-ui-2xs", reviewRoomStatusClassName(status))}
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,34rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Review Room</DialogTitle>
            <DialogDescription>
              Create a client-safe script link for one site origin and one destination project.
            </DialogDescription>
          </DialogHeader>

          <div
            className="grid gap-4"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleCreateReviewRoom();
              }
            }}
          >
            <div>
              <Label htmlFor="review-room-name">Room name</Label>
              <Input
                id="review-room-name"
                value={roomName}
                onChange={(event) => {
                  setError(null);
                  setRoomName(event.target.value);
                }}
                placeholder="Client staging review"
                maxLength={80}
                required
                aria-invalid={roomNameTooLong || undefined}
                className="mt-1 h-10 bg-paper-elevated text-ui-md sm:h-8 sm:text-ui-sm"
              />
              {roomNameTooLong ? (
                <p className="mt-1 text-ui-xs text-destructive-token">
                  Room name must be 80 characters or less.
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="review-room-origin">Site origin</Label>
              <Input
                id="review-room-origin"
                value={targetOrigin}
                onChange={(event) => {
                  setError(null);
                  setTargetOrigin(event.target.value);
                }}
                placeholder="https://staging.client.com"
                aria-invalid={Boolean(error) || undefined}
                className="mt-1 h-10 bg-paper-elevated text-ui-md sm:h-8 sm:text-ui-sm"
              />
            </div>

            <div>
              <Label htmlFor="review-room-project">Destination project</Label>
              <select
                id="review-room-project"
                value={selectedProjectId}
                onChange={(event) => {
                  setError(null);
                  setProjectId(event.target.value);
                }}
                className="mt-1 h-10 w-full rounded-md border border-rule/80 bg-paper-elevated px-3 text-ui-sm text-ink outline-none transition-colors hover:bg-paper-2 focus:ring-2 focus:ring-focus-ring"
              >
                {reviewProjects.length > 0 ? (
                  reviewProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                ) : (
                  <option value="">Create a project first</option>
                )}
              </select>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive-token/30 bg-destructive-soft px-3 py-2 text-ui-xs text-destructive-token"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <SubmitButton
                type="button"
                loading={isCreating}
                loadingText="Creating..."
                disabled={!canCreate}
                onClick={() => void handleCreateReviewRoom()}
              >
                Create Review Room
              </SubmitButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
