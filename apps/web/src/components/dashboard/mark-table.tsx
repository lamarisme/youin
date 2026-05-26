"use client";

import { useMemo } from "react";
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
} from "@/lib/collab-types";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { MarkPageOpenButton } from "./mark-page-open";
import { formatMarkPageLabel } from "./mark-page-label";

// ─── Props ──────────────────────────────────────────────────────────────

export interface MarkTableProps {
  marks: MarkItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  /** Called when a mark title is opened. */
  onSelectMark: (mark: MarkItem) => void;
  /** If provided, enables row checkboxes. */
  selectedIds?: Set<string>;
  /** Fires with the full next selection set (replaces per-id toggle). */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Enable / disable sorting. Defaults to true. */
  sortable?: boolean;
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
  commentCountByMarkId,
  displayNamePreference,
  selectable,
  onSelectMark,
}: {
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  selectable: boolean;
  onSelectMark: (mark: MarkItem) => void;
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

  // ── Status column ─────────
  cols.push({
    accessorKey: "status",
    header: "",
    size: 28,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.status === "open" ? (
        <CircleDashed
          className="size-3.5 text-mark"
          aria-label="Open"
        />
      ) : (
        <CheckCircle2
          className="size-3.5 text-ok"
          aria-label="Resolved"
        />
      ),
  });

  // ── Title + page ──────────
  cols.push({
    accessorKey: "title",
    header: "Title",
    size: 999, // flexible
    cell: ({ row }) => {
      const mark = row.original;
      return (
        <button
          type="button"
          onClick={() => onSelectMark(mark)}
          className="-mx-1 block min-w-0 rounded-md px-1 py-1 text-left outline-none transition-colors hover:text-mark focus-visible:ring-2 focus-visible:ring-mark/35"
        >
          <p className="truncate text-ui-sm font-semibold text-ink">
            {mark.title}
          </p>
          {mark.page.trim() ? (
            <p className="mt-0.5 truncate text-ui-xs text-ink-3" title={mark.page}>
              {formatMarkPageLabel(mark.page)}
            </p>
          ) : null}
        </button>
      );
    },
  });

  // ── Priority ──────────────
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

  // ── Labels ────────────────
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

  // ── Assignee ──────────────
  cols.push({
    id: "assignee",
    header: "Assignee",
    size: 44,
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

  // ── Comments ──────────────
  cols.push({
    id: "comments",
    header: "",
    size: 44,
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

  // ── Display key ───────────
  cols.push({
    accessorKey: "displayKey",
    header: "ID",
    size: 72,
    cell: ({ row }) => (
      <span className="shrink-0 whitespace-nowrap font-mono text-ui-2xs text-ink-3">
        {row.original.displayKey}
      </span>
    ),
  });

  return cols;
}

// ─── Component ──────────────────────────────────────────────────────────

export function MarkTable({
  marks,
  membersById,
  labelsById,
  commentCountByMarkId,
  displayNamePreference,
  onSelectMark,
  selectedIds,
  onSelectionChange,
  sortable = true,
}: MarkTableProps) {
  const selectable = !!selectedIds && !!onSelectionChange;

  const columns = useMemo(
    () =>
      buildColumns({
        membersById,
        labelsById,
        commentCountByMarkId,
        displayNamePreference,
        selectable,
        onSelectMark,
      }),
    [membersById, labelsById, commentCountByMarkId, displayNamePreference, selectable, onSelectMark],
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
      <div className="md:hidden">
        <MobileMarkList
          marks={marks}
          membersById={membersById}
          labelsById={labelsById}
          commentCountByMarkId={commentCountByMarkId}
          displayNamePreference={displayNamePreference}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onSelectMark={onSelectMark}
        />
      </div>

      <div className="hidden md:block">
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
                      className="h-8 bg-paper-2 px-3 text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3"
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  "group/row transition-colors",
                  row.getIsSelected() && "[&>td]:bg-mark-soft/35 hover:[&>td]:bg-mark-soft/45",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() === 999 ? undefined : cell.column.getSize() }}
                    className="py-2.5"
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
            ))}
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
  commentCountByMarkId,
  displayNamePreference,
  selectable,
  selectedIds,
  onSelectionChange,
  onSelectMark,
}: {
  marks: MarkItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  selectable: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onSelectMark: (mark: MarkItem) => void;
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
        const pageLabel = mark.page.trim() ? formatMarkPageLabel(mark.page) : null;
        return (
          <li
            key={mark.id}
            data-state={selected ? "selected" : undefined}
            className={cn(
              "px-3 py-3 transition-colors hover:bg-paper-2",
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
                    className="min-h-11 min-w-0 flex-1 rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-mark/35"
                  >
                    <span className="block break-words text-ui-lg font-semibold leading-snug text-ink">
                      {mark.title}
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
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusInline status={mark.status} />
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
                  <span className="font-mono text-ui-xs text-ink-3">
                    {mark.displayKey}
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

function StatusInline({ status }: { status: MarkItem["status"] }) {
  return status === "open" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-1 text-ui-xs font-medium text-mark">
      <CircleDashed className="size-3" aria-hidden />
      Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-1 text-ui-xs font-medium text-ok">
      <CheckCircle2 className="size-3" aria-hidden />
      Resolved
    </span>
  );
}
