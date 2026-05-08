"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
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
  PinItem,
  TeamMember,
  WorkspaceLabel,
} from "@/lib/collab-types";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { MarkPageOpenButton } from "./mark-page-open";

// ─── Props ──────────────────────────────────────────────────────────────

export interface MarkTableProps {
  pins: PinItem[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  commentCountByPinId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  /** Called when a row is clicked (not the checkbox). */
  onSelectMark: (pin: PinItem) => void;
  /** If provided, enables row checkboxes. */
  selectedIds?: Set<string>;
  onToggleSelected?: (id: string) => void;
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
  commentCountByPinId,
  displayNamePreference,
  selectable,
}: {
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  commentCountByPinId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  selectable: boolean;
}): ColumnDef<PinItem>[] {
  const cols: ColumnDef<PinItem>[] = [];

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
          className="size-4"
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
          className="size-4"
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
          aria-label="Closed"
        />
      ),
  });

  // ── Title + page ──────────
  cols.push({
    accessorKey: "title",
    header: "Title",
    size: 999, // flexible
    cell: ({ row }) => {
      const pin = row.original;
      return (
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-semibold text-ink">
            {pin.title}
          </p>
          {pin.page.trim() ? (
            <p className="mt-0.5 truncate text-[0.6875rem] text-ink-3">
              {pin.page}
            </p>
          ) : null}
        </div>
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
      const pin = row.original;
      if (pin.labelIds.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {pin.labelIds.map((lid) => {
            const label = labelsById.get(lid);
            if (!label) return null;
            return (
              <span
                key={lid}
                className="rounded bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2"
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
            <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
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
      const count = commentCountByPinId.get(row.original.id) ?? 0;
      if (count === 0) return null;
      return (
        <span
          className="flex items-center gap-1 text-[0.625rem] text-ink-3"
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
          className="border-transparent bg-transparent opacity-0 shadow-none hover:bg-paper-3 group-hover/row:opacity-100"
        />
      ) : null,
  });

  // ── Display key ───────────
  cols.push({
    accessorKey: "displayKey",
    header: "ID",
    size: 72,
    cell: ({ row }) => (
      <span className="shrink-0 whitespace-nowrap font-mono text-[0.625rem] text-ink-3">
        {row.original.displayKey}
      </span>
    ),
  });

  return cols;
}

// ─── Component ──────────────────────────────────────────────────────────

export function MarkTable({
  pins,
  membersById,
  labelsById,
  commentCountByPinId,
  displayNamePreference,
  onSelectMark,
  selectedIds,
  onToggleSelected,
  sortable = true,
}: MarkTableProps) {
  const selectable = !!selectedIds && !!onToggleSelected;

  const columns = useMemo(
    () =>
      buildColumns({
        membersById,
        labelsById,
        commentCountByPinId,
        displayNamePreference,
        selectable,
      }),
    [membersById, labelsById, commentCountByPinId, displayNamePreference, selectable],
  );

  // Map Set<string> → TanStack RowSelectionState
  const rowSelection: RowSelectionState = useMemo(() => {
    if (!selectedIds) return {};
    const state: RowSelectionState = {};
    pins.forEach((pin, i) => {
      if (selectedIds.has(pin.id)) state[i] = true;
    });
    return state;
  }, [selectedIds, pins]);

  const table = useReactTable({
    data: pins,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable ? { getSortedRowModel: getSortedRowModel() } : {}),
    enableRowSelection: selectable,
    onRowSelectionChange: (updaterOrValue) => {
      if (!onToggleSelected) return;
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(rowSelection)
          : updaterOrValue;
      // Find which row toggled
      for (let i = 0; i < pins.length; i++) {
        const wasSelected = rowSelection[i] ?? false;
        const isSelected = next[i] ?? false;
        if (wasSelected !== isSelected) {
          onToggleSelected(pins[i].id);
        }
      }
    },
    state: {
      rowSelection,
    },
    getRowId: (row) => row.id,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className="border-rule hover:bg-transparent"
          >
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                style={{ width: header.getSize() === 999 ? undefined : header.getSize() }}
                className={cn(
                  "h-9 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-3",
                  header.column.getCanSort() && "cursor-pointer select-none",
                )}
                onClick={header.column.getToggleSortingHandler()}
              >
                <span className="flex items-center gap-1">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  {{
                    asc: <ArrowUp className="size-3" />,
                    desc: <ArrowDown className="size-3" />,
                  }[header.column.getIsSorted() as string] ?? null}
                </span>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn(
              "group/row cursor-pointer border-rule transition-colors hover:bg-paper-2",
              row.getIsSelected() && "bg-mark-soft/40 hover:bg-mark-soft/60",
            )}
            onClick={() => onSelectMark(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                style={{ width: cell.column.getSize() === 999 ? undefined : cell.column.getSize() }}
                className="py-3"
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
  );
}
