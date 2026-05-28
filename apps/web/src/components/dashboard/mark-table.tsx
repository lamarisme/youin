"use client";

import { type KeyboardEvent, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Bookmark,
  CheckCircle2,
  CircleDashed,
  MessageCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DisplayNamePreference,
  MarkItem,
  TeamMember,
  WorkspaceLabel,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { formatDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { MarkPageOpenButton } from "./mark-page-open";
import { formatMarkPageLabel } from "./mark-page-label";

// ─── Props ──────────────────────────────────────────────────────────────

export interface MarkTableProps {
  marks: MarkItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  /** Called when a mark title is opened. */
  onSelectMark: (mark: MarkItem) => void;
  /** Optional quiet row action for resolving or reopening without opening detail. */
  onToggleMarkStatus?: (mark: MarkItem) => void | Promise<void>;
  /** Optional list keyboard navigation handler. */
  onNavigateAdjacent?: (direction: "prev" | "next", fromMark?: MarkItem) => void;
  /** Optional shortcut help handler for focused list usage. */
  onShowShortcuts?: () => void;
  /** Current mark shown in the detail pane. Independent from bulk selection. */
  activeMarkId?: string;
  /** If provided, enables row checkboxes. */
  selectedIds?: Set<string>;
  /** Fires with the full next selection set (replaces per-id toggle). */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Enable / disable sorting. Defaults to true. */
  sortable?: boolean;
  /** Compact density removes secondary columns for cockpit panes. */
  density?: "default" | "compact";
}

// ─── Helpers ────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Column definitions ─────────────────────────────────────────────────

function buildColumns({
  membersById,
  labelsById,
  workflowStatusesById,
  commentCountByMarkId,
  displayNamePreference,
  selectable,
  onSelectMark,
  onToggleMarkStatus,
  activeMarkId,
  density,
}: {
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  selectable: boolean;
  onSelectMark: (mark: MarkItem) => void;
  onToggleMarkStatus?: (mark: MarkItem) => void | Promise<void>;
  activeMarkId?: string;
  density: "default" | "compact";
}): ColumnDef<MarkItem>[] {
  const cols: ColumnDef<MarkItem>[] = [];

  // ── Checkbox column ───────
  if (selectable) {
    cols.push({
      id: "select",
      size: 32,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
          className="size-5 sm:size-4"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={
            row.getIsSelected()
              ? `Deselect ${row.original.title}`
              : `Select ${row.original.title}`
          }
          className="size-5 sm:size-4"
        />
      ),
    });
  }

  // ── Workflow status column ─────────
  cols.push({
    accessorKey: "status",
    header: "Status",
    size: density === "compact" ? 36 : 44,
    enableSorting: false,
    cell: ({ row }) => {
      const mark = row.original;
      return (
        <StatusInline
          status={mark.status}
          compact={true}
          label={
            mark.workflowStatusId
              ? workflowStatusesById.get(mark.workflowStatusId)?.name
              : undefined
          }
        />
      );
    },
  });

  // ── Title + page ──────────
  cols.push({
    accessorKey: "title",
    header: "Title",
    size: 999, // flexible
    cell: ({ row }) => {
      const mark = row.original;
      const active = activeMarkId === mark.id;
      return (
        <div className="-mx-1 flex min-w-0 items-start gap-1 rounded-md px-1 py-0.5">
          <button
            type="button"
            data-mark-id={mark.id}
            aria-current={active ? "true" : undefined}
            onClick={() => onSelectMark(mark)}
            className={cn(
              "block min-w-0 flex-1 rounded-md text-left outline-none transition-colors hover:text-mark focus-visible:ring-2 focus-visible:ring-mark/35",
              active && "text-mark",
            )}
          >
            <p className="flex min-w-0 items-center gap-2 truncate text-ui-sm text-ink">
              <span className="shrink-0 font-mono text-ui-xs text-ink-3">{mark.displayKey}</span>
              <span className="truncate font-semibold">{mark.title}</span>
              {density === "compact" && mark.pinned ? (
                <Bookmark className="size-3 shrink-0 text-mark" aria-label="Pinned" />
              ) : null}
            </p>
            {density === "compact" ? (
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-ui-xs text-ink-3">
                {mark.page.trim() ? (
                  <>
                    <span className="truncate" title={mark.page}>
                      {formatMarkPageLabel(mark.page)}
                    </span>
                  </>
                ) : null}
              </p>
            ) : mark.page.trim() ? (
              <p className="mt-0.5 truncate text-ui-xs text-ink-3" title={mark.page}>
                {formatMarkPageLabel(mark.page)}
              </p>
            ) : null}
          </button>
          <RowStatusAction mark={mark} onToggle={onToggleMarkStatus} />
        </div>
      );
    },
  });

  // ── Priority ──────────────
  if (density === "default") {
    cols.push({
      accessorKey: "priority",
      header: "Priority",
      size: 90,
      sortingFn: (a, b) =>
        (PRIORITY_ORDER[a.original.priority] ?? 99) -
        (PRIORITY_ORDER[b.original.priority] ?? 99),
      cell: ({ row }) => (
        <PriorityBadge priority={row.original.priority} size="sm" />
      ),
    });
  }

  // ── Labels ────────────────
  if (density === "default") {
    cols.push({
      id: "labels",
      header: "Labels",
      size: 140,
      enableSorting: false,
      cell: ({ row }) => {
        const mark = row.original;
        if (mark.labelIds.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {mark.labelIds.map((lid) => {
              const label = labelsById.get(lid);
              if (!label) return null;
              return (
                <span
                  key={lid}
                  className="rounded bg-paper-3 px-1.5 py-0.5 text-ui-2xs font-medium text-ink-2"
                >
                  {label.name}
                </span>
              );
            })}
          </div>
        );
      },
    });
  }

  // ── Assignee ──────────────
  cols.push({
    id: "assignee",
    header: "",
    size: 36,
    enableSorting: false,
    cell: ({ row }) => {
      const assignee = row.original.assigneeId
        ? membersById.get(row.original.assigneeId)
        : undefined;
      if (!assignee) return null;
      return (
        <span
          title={memberPickerLabel(assignee, displayNamePreference)}
          aria-label={`Assigned to ${memberPickerLabel(assignee, displayNamePreference)}`}
        >
          <Avatar className="size-5" aria-hidden>
            <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink-2">
              {assignee.initials}
            </AvatarFallback>
          </Avatar>
        </span>
      );
    },
  });

  // ── Pinned ────────────────
  if (density === "default") {
    cols.push({
      id: "pinned",
      header: "",
      size: 28,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.pinned ? (
          <Pill size="sm" icon={<Bookmark className="size-2.5" />}>
            Pinned
          </Pill>
        ) : null,
    });
  }

  // ── Comments ──────────────
  cols.push({
    id: "comments",
    header: "",
    size: 36,
    enableSorting: false,
    cell: ({ row }) => {
      const count = commentCountByMarkId.get(row.original.id) ?? 0;
      if (count === 0) return null;
      return (
        <span
          className="flex items-center gap-1 text-ui-2xs text-ink-3"
          aria-label={`${count} comment${count === 1 ? "" : "s"}`}
        >
          <MessageCircle className="size-3" aria-hidden />
          <span aria-hidden>{count}</span>
        </span>
      );
    },
  });

  // ── Created date ──────────
  cols.push({
    accessorKey: "createdAt",
    header: "Created",
    size: 72,
    cell: ({ row }) => (
      <span
        className="shrink-0 whitespace-nowrap text-ui-sm tabular-nums text-ink-3"
        title={row.original.createdAt}
      >
        {formatDateShort(row.original.createdAt)}
      </span>
    ),
  });

  // ── Page open ─────────────
  cols.push({
    id: "pageOpen",
    header: "",
    size: 32,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.page.trim() ? (
        <MarkPageOpenButton
          page={row.original.page}
          appearance="icon"
          stopPropagation
          className="border-transparent bg-transparent shadow-none hover:bg-paper-3 md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100"
        />
      ) : null,
  });

  return cols;
}

// ─── Component ──────────────────────────────────────────────────────────

export function MarkTable({
  marks,
  membersById,
  labelsById,
  workflowStatusesById,
  commentCountByMarkId,
  displayNamePreference,
  onSelectMark,
  onToggleMarkStatus,
  onNavigateAdjacent,
  onShowShortcuts,
  activeMarkId,
  selectedIds,
  onSelectionChange,
  sortable = true,
  density = "default",
}: MarkTableProps) {
  const selectable = !!selectedIds && !!onSelectionChange;

  const columns = useMemo(
    () =>
      buildColumns({
        membersById,
        labelsById,
        workflowStatusesById,
        commentCountByMarkId,
        displayNamePreference,
        selectable,
        onSelectMark,
        onToggleMarkStatus,
        activeMarkId,
        density,
      }),
    [membersById, labelsById, workflowStatusesById, commentCountByMarkId, displayNamePreference, selectable, onSelectMark, onToggleMarkStatus, activeMarkId, density],
  );

  // Map Set<string> → TanStack RowSelectionState keyed by mark.id
  const rowSelection: RowSelectionState = useMemo(() => {
    if (!selectedIds) return {};
    const state: RowSelectionState = {};
    for (const mark of marks) {
      if (selectedIds.has(mark.id)) state[mark.id] = true;
    }
    return state;
  }, [selectedIds, marks]);

  // TanStack Table intentionally returns imperative helpers that React Compiler skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: marks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable ? { getSortedRowModel: getSortedRowModel() } : {}),
    enableRowSelection: selectable,
    onRowSelectionChange: (updaterOrValue) => {
      if (!onSelectionChange) return;
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(rowSelection)
          : updaterOrValue;
      // Keys in `next` are mark IDs (from getRowId)
      const nextIds = new Set<string>();
      for (const [id, selected] of Object.entries(next)) {
        if (selected) nextIds.add(id);
      }
      onSelectionChange(nextIds);
    },
    state: {
      rowSelection,
    },
    getRowId: (row) => row.id,
  });

  return (
    <>
      <div
        className="md:hidden"
        onKeyDown={(event) =>
          handleListKeyDown(event, {
            marks,
            activeMarkId,
            onNavigateAdjacent,
            onToggleMarkStatus,
            onShowShortcuts,
          })
        }
      >
        <MobileMarkList
          marks={marks}
          membersById={membersById}
          labelsById={labelsById}
          workflowStatusesById={workflowStatusesById}
          commentCountByMarkId={commentCountByMarkId}
          displayNamePreference={displayNamePreference}
          selectable={selectable}
          selectedIds={selectedIds}
          activeMarkId={activeMarkId}
          onSelectionChange={onSelectionChange}
          onSelectMark={onSelectMark}
          onToggleMarkStatus={onToggleMarkStatus}
        />
      </div>

      <div
        className="hidden md:block outline-none"
        tabIndex={0}
        aria-label="Marks list"
        onKeyDown={(event) =>
          handleListKeyDown(event, {
            marks,
            activeMarkId,
            onNavigateAdjacent,
            onToggleMarkStatus,
            onShowShortcuts,
          })
        }
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const headerContent = header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      );
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() === 999 ? undefined : header.getSize() }}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className="h-7 border-b border-rule/60 bg-paper-2/70 px-3 text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3"
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="-mx-1 flex items-center gap-1 rounded px-1 py-1 text-left uppercase outline-none focus-visible:ring-2 focus-visible:ring-mark/35"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {headerContent}
                          {{
                            asc: <ArrowUp className="size-3" />,
                            desc: <ArrowDown className="size-3" />,
                          }[sorted as string] ?? null}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1">{headerContent}</span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const active = activeMarkId === row.original.id;
              const selected = row.getIsSelected();
              return (
                <TableRow
                  key={row.id}
                  data-mark-id={row.original.id}
                  data-state={selected ? "selected" : undefined}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group/row border-b border-rule/45 transition-colors last:border-b-0",
                    active && "[&>td]:bg-paper-2 hover:[&>td]:bg-paper-3/60",
                    selected && "[&>td]:bg-mark-soft/35 hover:[&>td]:bg-mark-soft/45",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() === 999 ? undefined : cell.column.getSize() }}
                      className={density === "compact" ? "py-1.5" : "py-2"}
                      onClick={
                        cell.column.id === "select"
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MobileMarkList({
  marks,
  membersById,
  labelsById,
  workflowStatusesById,
  commentCountByMarkId,
  displayNamePreference,
  selectable,
  selectedIds,
  activeMarkId,
  onSelectionChange,
  onSelectMark,
  onToggleMarkStatus,
}: {
  marks: MarkItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  selectable: boolean;
  selectedIds?: Set<string>;
  activeMarkId?: string;
  onSelectionChange?: (ids: Set<string>) => void;
  onSelectMark: (mark: MarkItem) => void;
  onToggleMarkStatus?: (mark: MarkItem) => void | Promise<void>;
}) {
  function toggleSelection(markId: string, checked: boolean) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (checked) next.add(markId);
    else next.delete(markId);
    onSelectionChange(next);
  }

  return (
    <ul>
      {marks.map((mark) => {
        const assignee = mark.assigneeId ? membersById.get(mark.assigneeId) : undefined;
        const commentCount = commentCountByMarkId.get(mark.id) ?? 0;
        const selected = selectedIds?.has(mark.id) ?? false;
        const active = activeMarkId === mark.id;
        const pageLabel = mark.page.trim() ? formatMarkPageLabel(mark.page) : null;
        return (
          <li
            key={mark.id}
            data-state={selected ? "selected" : undefined}
            aria-current={active ? "true" : undefined}
            className={cn(
              "border-b border-rule/50 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-paper-2",
              active && "bg-paper-2",
              selected && "bg-mark-soft/40 hover:bg-mark-soft/45",
            )}
          >
            <div className="flex items-start gap-3">
              {selectable ? (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(value) => toggleSelection(mark.id, !!value)}
                  aria-label={selected ? `Deselect ${mark.title}` : `Select ${mark.title}`}
                  className="mt-1 size-5"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectMark(mark)}
                    aria-current={active ? "true" : undefined}
                    className="min-h-10 min-w-0 flex-1 rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-mark/35"
                  >
                    <span className="flex min-w-0 items-center gap-2 break-words text-ui-md font-semibold leading-snug text-ink">
                      <span className="shrink-0 font-mono text-ui-xs font-medium text-ink-3">
                        {mark.displayKey}
                      </span>
                      <span className="min-w-0 flex-1">{mark.title}</span>
                    </span>
                    {pageLabel ? (
                      <span className="mt-1 block truncate text-ui-xs text-ink-3" title={mark.page}>
                        {pageLabel}
                      </span>
                    ) : null}
                  </button>
                  {mark.page.trim() ? (
                    <MarkPageOpenButton
                      page={mark.page}
                      appearance="icon"
                      stopPropagation
                      className="mt-0.5"
                    />
                  ) : null}
                  <RowStatusAction mark={mark} onToggle={onToggleMarkStatus} className="mt-0.5" />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusInline
                    status={mark.status}
                    label={
                      mark.workflowStatusId
                        ? workflowStatusesById.get(mark.workflowStatusId)?.name
                        : undefined
                    }
                  />
                  <PriorityBadge priority={mark.priority} size="sm" />
                  {mark.pinned ? (
                    <Pill size="sm" icon={<Bookmark className="size-2.5" />}>
                      Pinned
                    </Pill>
                  ) : null}
                  {commentCount > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-1 text-ui-xs text-ink-3"
                      aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
                    >
                      <MessageCircle className="size-3" aria-hidden />
                      <span aria-hidden>{commentCount}</span>
                    </span>
                  ) : null}
                  {assignee ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-1.5 py-0.5 text-ui-xs text-ink-3"
                      aria-label={`Assigned to ${memberPickerLabel(assignee, displayNamePreference)}`}
                    >
                      <Avatar className="size-5" aria-hidden>
                        <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink-2">
                          {assignee.initials}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                  ) : null}
                  <span className="text-ui-xs tabular-nums text-ink-3">
                    {formatDateShort(mark.createdAt)}
                  </span>
                </div>

                {mark.labelIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {mark.labelIds.map((lid) => {
                      const label = labelsById.get(lid);
                      if (!label) return null;
                      return (
                        <span
                          key={lid}
                          className="rounded bg-paper-3 px-1.5 py-0.5 text-ui-xs font-medium text-ink-2"
                        >
                          {label.name}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RowStatusAction({
  mark,
  onToggle,
  className,
}: {
  mark: MarkItem;
  onToggle?: (mark: MarkItem) => void | Promise<void>;
  className?: string;
}) {
  if (!onToggle) return null;
  const open = mark.status === "open";
  return (
    <button
      type="button"
      data-mark-id={mark.id}
      onClick={(event) => {
        event.stopPropagation();
        void onToggle(mark);
      }}
      aria-label={open ? `Close ${mark.title}` : `Reopen ${mark.title}`}
      title={open ? "Close" : "Reopen"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-3 outline-none transition-colors hover:bg-paper-3 hover:text-ink focus-visible:bg-paper-3 focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-mark/25 md:size-7 md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100",
        open && "hover:text-ok focus-visible:text-ok",
        !open && "hover:text-mark focus-visible:text-mark",
        className,
      )}
    >
      {open ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <CircleDashed className="size-3.5" aria-hidden />
      )}
    </button>
  );
}

function handleListKeyDown(
  event: KeyboardEvent<HTMLElement>,
  {
    marks,
    activeMarkId,
    onNavigateAdjacent,
    onToggleMarkStatus,
    onShowShortcuts,
  }: {
    marks: MarkItem[];
    activeMarkId?: string;
    onNavigateAdjacent?: (direction: "prev" | "next", fromMark?: MarkItem) => void;
    onToggleMarkStatus?: (mark: MarkItem) => void | Promise<void>;
    onShowShortcuts?: () => void;
  },
) {
  if (isEditableTarget(event.target)) return;

  const key = event.key;
  if ((key === "j" || key === "ArrowDown") && onNavigateAdjacent) {
    event.preventDefault();
    event.stopPropagation();
    onNavigateAdjacent("next", currentKeyboardMark(event.target, marks, activeMarkId));
    return;
  }
  if ((key === "k" || key === "ArrowUp") && onNavigateAdjacent) {
    event.preventDefault();
    event.stopPropagation();
    onNavigateAdjacent("prev", currentKeyboardMark(event.target, marks, activeMarkId));
    return;
  }
  if (key === "x" && onToggleMarkStatus) {
    const mark = currentKeyboardMark(event.target, marks, activeMarkId);
    if (!mark) return;
    event.preventDefault();
    event.stopPropagation();
    void onToggleMarkStatus(mark);
    return;
  }
  if ((key === "?" || (key === "/" && event.shiftKey)) && onShowShortcuts) {
    event.preventDefault();
    event.stopPropagation();
    onShowShortcuts();
  }
}

function currentKeyboardMark(
  target: EventTarget,
  marks: MarkItem[],
  activeMarkId?: string,
) {
  const targetElement = target instanceof HTMLElement ? target : null;
  const focusedMarkId = targetElement?.closest<HTMLElement>("[data-mark-id]")?.dataset.markId;
  return (
    marks.find((mark) => mark.id === focusedMarkId) ??
    marks.find((mark) => mark.id === activeMarkId) ??
    marks[0]
  );
}

function isEditableTarget(target: EventTarget) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.getAttribute("role") === "textbox"
  );
}

function StatusInline({
  status,
  label,
  compact = false,
}: {
  status: MarkItem["status"];
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    const open = status === "open";
    return (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full bg-paper-2",
          open ? "text-mark" : "text-ok",
        )}
        title={label ?? (open ? "Open" : "Closed")}
        aria-label={label ?? (open ? "Open" : "Closed")}
      >
        {open ? (
          <CircleDashed className="size-3" aria-hidden />
        ) : (
          <CheckCircle2 className="size-3" aria-hidden />
        )}
      </span>
    );
  }

  return status === "open" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-rule/55 bg-paper-2 px-2 py-1 text-ui-xs font-medium text-mark">
      <CircleDashed className="size-3" aria-hidden />
      {label ?? "Open"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-rule/55 bg-paper-2 px-2 py-1 text-ui-xs font-medium text-ok">
      <CheckCircle2 className="size-3" aria-hidden />
      {label ?? "Closed"}
    </span>
  );
}
