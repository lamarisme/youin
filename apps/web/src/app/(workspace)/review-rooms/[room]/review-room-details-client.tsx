"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  MessagesSquare,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageContainer } from "@/components/page-container";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate, formatRelative } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { useRevokeReviewLinkMutation } from "@/lib/queries/use-workspace-mutations";
import {
  reviewRoomProjectName,
  reviewRoomStatus,
  reviewRoomStatusClassName,
  reviewScriptSnippet,
} from "@/lib/review-rooms";
import { cn } from "@/lib/utils";

const SETUP_STEPS = [
  "Copy snippet",
  "Install on target site",
  "Open site",
  "Click Mark UI",
  "Confirm feedback appears in destination project",
] as const;

export function ReviewRoomDetailsClient({ roomId }: { roomId: string }) {
  const { projects, room, isOwner } = useWorkspaceData((s) => ({
    projects: s.workspace.projects,
    room: s.workspace.reviewLinks.find((link) => link.id === roomId) ?? null,
    isOwner:
      s.workspace.members.find((member) => member.id === s.userId)?.role ===
      "owner",
  }));
  const { mutate: revokeReviewRoom, isPending: isRevoking } =
    useRevokeReviewLinkMutation();
  const [appOrigin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

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

  const status = reviewRoomStatus(room);
  const projectName = reviewRoomProjectName(projects, room.projectId);
  const snippet = reviewScriptSnippet(room.token, appOrigin);
  const projectHref = `/dashboard?project=${encodeURIComponent(room.projectId)}`;
  const canRevoke = isOwner && status === "Active" && !isRevoking;

  async function handleCopySnippet() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyError("Couldn't copy the snippet. Select it manually.");
    }
  }

  function handleRevokeRoom() {
    if (!room || !canRevoke) return;
    revokeReviewRoom({ linkId: room.id, name: room.name });
  }

  return (
    <PageContainer>
      <AppHeader
        title={room.name}
        eyebrow="Review Room"
        subtitle="Install this room on the client site so guest feedback lands in the selected project."
      >
        <Button asChild variant="outline">
          <Link href="/review-rooms">
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </Link>
        </Button>
      </AppHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="space-y-3">
            <ProductSectionHeader
              title="Room details"
              description="The existing guest review link, promoted into a Review Room workflow."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={projectHref}>
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open destination project marks
                  </Link>
                </Button>
              }
            />

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
                  className={cn("text-ui-2xs", reviewRoomStatusClassName(status))}
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
                icon={CalendarDays}
                label="Expiry"
                value={room.expiresAt ? formatDate(room.expiresAt) : "No expiry"}
              />
              <DetailRow
                icon={Clock3}
                label="Last used"
                value={room.lastUsedAt ? formatRelative(room.lastUsedAt) : "Never used"}
              />
            </ProductList>
          </section>

          <section className="space-y-3">
            <ProductSectionHeader
              title="Installation snippet"
              description="Paste this existing guest review script into the target site. The underlying script system is unchanged."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopySnippet()}
                >
                  <Copy className="size-3.5" aria-hidden />
                  {copied ? "Copied" : "Copy snippet"}
                </Button>
              }
            />
            <pre className="overflow-x-auto rounded-md bg-paper-elevated p-3 text-ui-xs text-ink-2 ring-1 ring-rule/60">
              <code>{snippet}</code>
            </pre>
            {copyError ? <Notice tone="danger">{copyError}</Notice> : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-3">
            <ProductSectionHeader
              title="Setup checklist"
              description="Keep the handoff operational and boring on purpose."
            />
            <ProductList tone="subtle">
              {SETUP_STEPS.map((step, index) => (
                <ProductListItem
                  key={step}
                  interactive={false}
                  className="flex items-center gap-3"
                >
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-ui-2xs text-ink-3 ring-1 ring-rule/60">
                    {index + 1}
                  </span>
                  <span className="text-ui-sm text-ink-2">{step}</span>
                </ProductListItem>
              ))}
            </ProductList>
          </section>

          {isOwner ? (
            <section className="space-y-3">
              <ProductSectionHeader
                title="Room control"
                description="Revoking disables the room for future guest review sessions."
              />
              <SubmitButton
                type="button"
                variant="destructive"
                loading={isRevoking}
                loadingText="Revoking..."
                disabled={!canRevoke}
                onClick={handleRevokeRoom}
                className="w-full"
              >
                <ShieldOff className="size-3.5" aria-hidden />
                Revoke Room
              </SubmitButton>
              {status !== "Active" ? (
                <p className="text-ui-xs text-ink-3">
                  This room is already {status.toLowerCase()}.
                </p>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
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
