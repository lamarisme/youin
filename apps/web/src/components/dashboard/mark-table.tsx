"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistance } from "date-fns";
import { Bookmark, CheckCircle2, CircleDashed, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill } from "@/components/pill";
import type {
  DisplayNamePreference,
  MarkItem,
  MarkPriority,
  TeamMember,
  WorkspaceLabel,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { formatDateTimeFull } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { formatMarkPageLabel } from "./mark-page-label";
import { MarkPageOpenButton } from "./mark-page-open";

export interface MarkTableProps {
  marks: MarkItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  markHrefFor?: (mark: MarkItem) => string;
  onSelectMark?: (mark: MarkItem) => void;
  onToggleMarkStatus?: (mark: MarkItem) => void | Promise<void>;
  activeMarkId?: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sortable?: boolean;
  density?: "default" | "compact";
  sectionTitle?: string;
  showSectionHeader?: boolean;
  referenceTime?: string | Date;
}

export function MarkTable(props: MarkTableProps) {
  const {
    marks,
    membersById,
    labelsById,
    workflowStatusesById,
    commentCountByMarkId,
    displayNamePreference,
    markHrefFor,
    onSelectMark,
    onToggleMarkStatus,
    activeMarkId,
    selectedIds,
    onSelectionChange,
    density = "default",
    sectionTitle = "Marks",
    showSectionHeader = true,
    referenceTime,
  } = props;
  const selectable = Boolean(selectedIds && onSelectionChange);
  const selectableMarksCount = selectable
    ? marks.filter((mark) => !isOptimisticId(mark.id)).length
    : 0;
  const selectedCount = selectedIds
    ? marks.reduce(
        (count, mark) =>
          count + (!isOptimisticId(mark.id) && selectedIds.has(mark.id) ? 1 : 0),
        0,
      )
    : 0;
  const allVisibleSelected =
    selectable && selectableMarksCount > 0 && selectedCount === selectableMarksCount;
  const someVisibleSelected =
    selectable && selectedCount > 0 && selectedCount < selectableMarksCount;

  function toggleAllVisible(checked: boolean) {
    if (!selectedIds || !onSelectionChange) return;
    const next = new Set(selectedIds);
    for (const mark of marks) {
      if (isOptimisticId(mark.id)) continue;
      if (checked) next.add(mark.id);
      else next.delete(mark.id);
    }
    onSelectionChange(next);
  }

  function toggleSelection(markId: string, checked: boolean) {
    if (!selectedIds || !onSelectionChange) return;
    const next = new Set(selectedIds);
    if (checked) next.add(markId);
    else next.delete(markId);
    onSelectionChange(next);
  }

  return (
    <div className="outline-none" aria-label="Marks list">
      {showSectionHeader ? (
        <div
          className={cn(
            "grid min-h-11 items-center gap-2 bg-paper-2/65 px-3 text-ui-sm text-ink sm:min-h-10",
            markListGridClass(selectable),
          )}
        >
          {selectable ? (
            <Checkbox
              checked={allVisibleSelected || (someVisibleSelected && "indeterminate")}
              onCheckedChange={(value) => toggleAllVisible(value === true)}
              aria-label={
                allVisibleSelected
                  ? "Deselect all visible marks"
                  : "Select all visible marks"
              }
              disabled={selectableMarksCount === 0}
              className="sm:size-4"
            />
          ) : null}
          <span className={cn(markStatusCellClass, "text-ink-3")}>
            <CircleDashed className="size-4" aria-hidden />
          </span>
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate font-semibold">{sectionTitle}</h2>
            <span className="shrink-0 font-mono text-ui-sm tabular-nums text-ink-3">{marks.length}</span>
          </div>
          {selectedCount > 0 ? (
            <Pill size="sm" className="justify-self-end font-mono tabular-nums">
              {selectedCount} selected
            </Pill>
          ) : null}
        </div>
      ) : null}

      <ul role="list" className="divide-y divide-rule/40">
        {marks.map((mark) => {
          const optimistic = isOptimisticId(mark.id);
          const assignee = mark.assigneeId ? membersById.get(mark.assigneeId) : undefined;
          const commentCount = commentCountByMarkId.get(mark.id) ?? 0;
          const selected = optimistic ? false : selectedIds?.has(mark.id) ?? false;
          const active = activeMarkId === mark.id;
          return (
            <MarkRow
              key={mark.id}
              mark={mark}
              optimistic={optimistic}
              assignee={assignee}
              labelsById={labelsById}
              workflowStatusesById={workflowStatusesById}
              commentCount={commentCount}
              selected={selected}
              active={active}
              selectable={selectable}
              hasSelection={selectedCount > 0}
              density={density}
              displayNamePreference={displayNamePreference}
              referenceTime={referenceTime}
              href={markHrefFor?.(mark)}
              onSelect={onSelectMark ? () => onSelectMark(mark) : undefined}
              onToggleStatus={onToggleMarkStatus}
              onToggleSelected={(checked) => toggleSelection(mark.id, checked)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function MarkRow({
  mark,
  optimistic,
  assignee,
  labelsById,
  workflowStatusesById,
  commentCount,
  selected,
  active,
  selectable,
  hasSelection,
  density,
  displayNamePreference,
  referenceTime,
  href,
  onSelect,
  onToggleStatus,
  onToggleSelected,
}: {
  mark: MarkItem;
  optimistic: boolean;
  assignee?: TeamMember;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCount: number;
  selected: boolean;
  active: boolean;
  selectable: boolean;
  hasSelection: boolean;
  density: "default" | "compact";
  displayNamePreference: DisplayNamePreference;
  referenceTime?: string | Date;
  href?: string;
  onSelect?: () => void;
  onToggleStatus?: (mark: MarkItem) => void | Promise<void>;
  onToggleSelected: (checked: boolean) => void;
}) {
  const router = useRouter();
  const workflowLabel = mark.workflowStatusId
    ? workflowStatusesById.get(mark.workflowStatusId)?.name
    : undefined;
  const rawPage = mark.page.trim();
  const pageLabel = rawPage ? formatMarkPageLabel(mark.page) : "";
  const showPageContext = rawPage.length > 0 && density !== "compact";
  const rowHeight =
    density === "compact"
      ? "min-h-11 py-1 sm:min-h-9"
      : "min-h-12 py-2 sm:min-h-11 sm:py-1.5";
  const openLabel = `Open mark ${mark.displayKey}: ${mark.title}. ${mark.status === "open" ? "Open" : "Closed"}.${rawPage ? ` Page: ${pageLabel}.` : ""}`;
  const openClassName =
    "flex min-h-11 min-w-0 items-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-mark/30 sm:min-h-0";

  function prefetchDetail() {
    if (href && !optimistic) router.prefetch(href);
  }

  function renderPrimaryContent() {
    return (
      <span
        className={cn(
          "flex min-w-0",
          showPageContext ? "flex-col gap-0.5 py-1" : "items-baseline gap-2",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "shrink-0 font-mono text-ui-xs text-ink-3",
              optimistic && "motion-safe:animate-pulse",
            )}
          >
            {mark.displayKey}
          </span>
          <span className="min-w-0 flex-1 truncate text-ui-sm font-semibold text-ink group-hover/mark-row:text-ink-hover">
            {mark.title}
          </span>
          <RowLabels mark={mark} labelsById={labelsById} density={density} />
        </span>
        {showPageContext ? (
          <span
            className="min-w-0 truncate text-ui-xs font-normal text-ink-3"
            title={mark.page}
          >
            <span className="sr-only">Page URL: </span>
            {pageLabel}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <li
      data-mark-id={mark.id}
      data-state={selected ? "selected" : undefined}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group/mark-row transition-colors hover:bg-paper-2/80",
        active && "bg-paper-2",
        selected && "bg-mark-soft/35 hover:bg-mark-soft/45",
      )}
    >
      <div
        className={cn(
          "grid items-center gap-2 px-3",
          markListGridClass(selectable),
          rowHeight,
        )}
      >
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => {
              if (!optimistic) onToggleSelected(value === true);
            }}
            disabled={optimistic}
            aria-label={
              optimistic
                ? `${mark.title} is still saving`
                : selected
                  ? `Deselect ${mark.title}`
                  : `Select ${mark.title}`
            }
            className={cn(
              "transition-opacity sm:size-4",
              selected || hasSelection
                ? "opacity-100"
                : "opacity-100 lg:opacity-0 lg:group-hover/mark-row:opacity-100 lg:group-focus-within/mark-row:opacity-100",
            )}
          />
        ) : null}

        <RowStatusToggle
          mark={mark}
          label={workflowLabel}
          onToggle={optimistic ? undefined : onToggleStatus}
        />

        {href && !optimistic ? (
          <Link
            href={href}
            prefetch={false}
            onPointerDown={prefetchDetail}
            onMouseEnter={prefetchDetail}
            onFocus={prefetchDetail}
            aria-label={openLabel}
            className={openClassName}
          >
            {renderPrimaryContent()}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            disabled={optimistic || !onSelect}
            aria-label={openLabel}
            className={cn(openClassName, optimistic && "cursor-default opacity-75")}
          >
            {renderPrimaryContent()}
          </button>
        )}

        <RowMeta
          mark={mark}
          assignee={assignee}
          commentCount={commentCount}
          density={density}
          displayNamePreference={displayNamePreference}
          referenceTime={referenceTime}
        />
      </div>
    </li>
  );
}

function markListGridClass(selectable: boolean) {
  return selectable
    ? "grid-cols-[1rem_1.5rem_minmax(0,1fr)_auto] gap-x-3 sm:gap-x-2"
    : "grid-cols-[1.5rem_minmax(0,1fr)_auto]";
}

const markStatusCellClass = "inline-flex size-11 items-center justify-center sm:size-6";

function RowStatusToggle({
  mark,
  label,
  onToggle,
}: {
  mark: MarkItem;
  label?: string;
  onToggle?: (mark: MarkItem) => void | Promise<void>;
}) {
  const open = mark.status === "open";
  const title = label ?? (open ? "Open" : "Closed");
  const icon = open ? (
    <CircleDashed className="size-3.5" aria-hidden />
  ) : (
    <CheckCircle2 className="size-3.5" aria-hidden />
  );

  if (!onToggle) {
    return (
      <span
        className={cn(markStatusCellClass, open ? "text-ink-3" : "text-ok")}
        title={title}
        role="img"
        aria-label={title}
      >
        {icon}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void onToggle(mark);
      }}
      aria-label={open ? `Close ${mark.title}` : `Reopen ${mark.title}`}
      title={open ? `Close: ${title}` : `Reopen: ${title}`}
      className={cn(
        markStatusCellClass,
        "rounded-sm text-ink-3 outline-none transition-colors hover:bg-paper-3 focus-visible:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/25",
        open ? "hover:text-ok focus-visible:text-ok" : "text-ok hover:text-mark focus-visible:text-mark",
      )}
    >
      {icon}
    </button>
  );
}

function RowLabels({
  mark,
  labelsById,
  density,
}: {
  mark: MarkItem;
  labelsById: Map<string, WorkspaceLabel>;
  density: "default" | "compact";
}) {
  if (density === "compact" || mark.labelIds.length === 0) return null;
  const labels = mark.labelIds
    .map((id) => labelsById.get(id))
    .filter((label): label is WorkspaceLabel => Boolean(label));
  if (labels.length === 0) return null;
  const visible = labels.slice(0, 2);
  const remaining = labels.length - visible.length;

  return (
    <span className="hidden min-w-0 shrink-0 items-center gap-1 lg:inline-flex">
      {visible.map((label) => (
        <Pill
          key={label.id}
          size="sm"
          className="max-w-24 truncate"
        >
          {label.name}
        </Pill>
      ))}
      {remaining > 0 ? (
        <span className="text-ui-2xs text-ink-3">+{remaining}</span>
      ) : null}
    </span>
  );
}

function RowMeta({
  mark,
  assignee,
  commentCount,
  density,
  displayNamePreference,
  referenceTime,
}: {
  mark: MarkItem;
  assignee?: TeamMember;
  commentCount: number;
  density: "default" | "compact";
  displayNamePreference: DisplayNamePreference;
  referenceTime?: string | Date;
}) {
  return (
    <div className="ml-1 flex min-w-0 shrink-0 items-center justify-end gap-1 text-ink-3 sm:ml-2 sm:gap-2">
      {mark.pinned ? (
        <Bookmark className="size-3.5 shrink-0 text-mark" aria-label="Pinned" />
      ) : null}
      <PrioritySignal priority={mark.priority} />
      {commentCount > 0 ? (
        <span
          className="inline-flex items-center gap-1 text-ui-2xs"
          aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
        >
          <MessageCircle className="size-3" aria-hidden />
          <span aria-hidden>{commentCount}</span>
        </span>
      ) : null}
      {assignee ? (
        <span
          className="hidden sm:inline-flex"
          title={memberPickerLabel(assignee, displayNamePreference)}
          role="img"
          aria-label={`Assigned to ${memberPickerLabel(assignee, displayNamePreference)}`}
        >
          <Avatar className="size-5" aria-hidden>
            <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink-2">
              {assignee.initials}
            </AvatarFallback>
          </Avatar>
        </span>
      ) : null}
      <CreatedAt value={mark.createdAt} density={density} referenceTime={referenceTime} />
      {mark.page.trim() ? (
        <MarkPageOpenButton
          page={mark.page}
          markTitle={mark.title}
          appearance="icon"
          stopPropagation
          className="size-9 border-transparent bg-transparent shadow-none transition-opacity hover:bg-paper-3 lg:size-7 lg:opacity-0 lg:group-hover/mark-row:opacity-100 lg:group-focus-within/mark-row:opacity-100"
        />
      ) : (
        <span className="hidden size-7 lg:block" aria-hidden />
      )}
    </div>
  );
}

function CreatedAt({
  value,
  density,
  referenceTime,
}: {
  value: string;
  density: "default" | "compact";
  referenceTime?: string | Date;
}) {
  const fullTimestamp = formatDateTimeFull(value);
  const label = formatDistance(new Date(value), referenceTime ? new Date(referenceTime) : new Date(), {
    addSuffix: true,
  });
  const accessibleLabel = `Created ${fullTimestamp}`;

  return (
    <time
      dateTime={value}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className={cn(
        "hidden w-28 shrink-0 text-right text-ui-xs text-ink-3 sm:inline-block",
        density === "compact" && "text-ui-2xs",
      )}
    >
      {label}
    </time>
  );
}

function PrioritySignal({ priority }: { priority: MarkPriority }) {
  if (priority !== "critical" && priority !== "high") return null;
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        priority === "critical" ? "bg-destructive-token" : "bg-warn",
      )}
      title={`${priority[0].toUpperCase()}${priority.slice(1)} priority`}
      role="img"
      aria-label={`${priority} priority`}
    />
  );
}
