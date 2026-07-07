"use client";

import {
  Bug,
  ChartColumnBig,
  Check,
  ChevronDown,
  ClipboardList,
  Eye,
  Flag,
  Folder,
  Hammer,
  LayoutGrid,
  Lightbulb,
  ListTree,
  Monitor,
  Package,
  Palette,
  Search,
  Shield,
  SquareKanban,
  Star,
  View,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkspaceView, WorkspaceViewIcon, WorkspaceViewLayout } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

export const VIEW_TEMPLATES: ReadonlyArray<{
  layout: WorkspaceViewLayout;
  label: string;
  description: string;
  defaultName: string;
  icon: LucideIcon;
}> = [
  {
    layout: "list",
    label: "List",
    description: "A focused table for sorting, searching, and triage.",
    defaultName: "All marks",
    icon: ListTree,
  },
  {
    layout: "board",
    label: "Board",
    description: "Open and closed marks grouped into workflow columns.",
    defaultName: "Status board",
    icon: SquareKanban,
  },
  {
    layout: "analytics",
    label: "Insights",
    description: "Charts for volume, ownership, hotspots, and aging.",
    defaultName: "Workspace insights",
    icon: ChartColumnBig,
  },
];

export const WORKSPACE_VIEW_ICON_OPTIONS: ReadonlyArray<{
  id: WorkspaceViewIcon;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "lightbulb", label: "Idea", icon: Lightbulb },
  { id: "bug", label: "Bug", icon: Bug },
  { id: "folder", label: "Folder", icon: Folder },
  { id: "hammer", label: "Build", icon: Hammer },
  { id: "wrench", label: "Fix", icon: Wrench },
  { id: "zap", label: "Performance", icon: Zap },
  { id: "shield", label: "Security", icon: Shield },
  { id: "eye", label: "Review", icon: Eye },
  { id: "flag", label: "Priority", icon: Flag },
  { id: "star", label: "Important", icon: Star },
  { id: "package", label: "Release", icon: Package },
  { id: "monitor", label: "Frontend", icon: Monitor },
  { id: "search", label: "Research", icon: Search },
  { id: "palette", label: "Design", icon: Palette },
  { id: "layout-grid", label: "Architecture", icon: LayoutGrid },
  { id: "chart-column", label: "Insights", icon: ChartColumnBig },
  { id: "clipboard-list", label: "QA", icon: ClipboardList },
];

export function viewLayoutLabel(layout: WorkspaceViewLayout): string {
  return VIEW_TEMPLATES.find((template) => template.layout === layout)?.label ?? "View";
}

export function viewLayoutDescription(layout: WorkspaceViewLayout): string {
  return VIEW_TEMPLATES.find((template) => template.layout === layout)?.description ?? "";
}

export function ViewLayoutIcon({ layout, className }: { layout: WorkspaceViewLayout; className?: string }) {
  const Icon = VIEW_TEMPLATES.find((template) => template.layout === layout)?.icon ?? View;
  return <Icon className={className} aria-hidden />;
}

export function defaultWorkspaceViewIcon(layout: WorkspaceViewLayout): WorkspaceViewIcon {
  if (layout === "analytics") return "chart-column";
  return layout === "board" ? "layout-grid" : "folder";
}

export function workspaceViewIconLabel(icon: WorkspaceViewIcon | null | undefined): string {
  return WORKSPACE_VIEW_ICON_OPTIONS.find((option) => option.id === icon)?.label ?? "View";
}

export function WorkspaceViewIconGlyph({
  icon,
  layout,
  className,
}: {
  icon?: WorkspaceViewIcon | null;
  layout: WorkspaceViewLayout;
  className?: string;
}) {
  const Icon = WORKSPACE_VIEW_ICON_OPTIONS.find((option) => option.id === icon)?.icon;
  if (Icon) return <Icon className={className} aria-hidden />;
  return <ViewLayoutIcon layout={layout} className={className} />;
}

export function WorkspaceViewIcon({
  view,
  className,
}: {
  view: WorkspaceView;
  className?: string;
}) {
  return <WorkspaceViewIconGlyph icon={view.icon} layout={view.layout} className={className} />;
}

export function ViewIconPicker({
  value,
  onChange,
  className,
  density = "comfortable",
  align,
}: {
  value?: WorkspaceViewIcon | null;
  onChange: (icon: WorkspaceViewIcon) => void;
  className?: string;
  density?: "comfortable" | "compact" | "inline";
  align?: "start" | "center" | "end";
}) {
  const selectedOption =
    WORKSPACE_VIEW_ICON_OPTIONS.find((option) => option.id === value) ??
    WORKSPACE_VIEW_ICON_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;
  const compact = density === "compact";
  const inline = density === "inline";
  const iconOnly = compact || inline;
  const [open, setOpen] = useState(false);

  function selectIcon(icon: WorkspaceViewIcon) {
    onChange(icon);
    setOpen(false);
  }

  function moveSelection(event: KeyboardEvent<HTMLDivElement>) {
    const columns =
      getComputedStyle(event.currentTarget)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length || 2;
    const currentIndex = Math.max(
      WORKSPACE_VIEW_ICON_OPTIONS.findIndex((option) => option.id === value),
      0,
    );
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = currentIndex + 1;
    if (event.key === "ArrowLeft") nextIndex = currentIndex - 1;
    if (event.key === "ArrowDown") nextIndex = currentIndex + columns;
    if (event.key === "ArrowUp") nextIndex = currentIndex - columns;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = WORKSPACE_VIEW_ICON_OPTIONS.length - 1;

    if (nextIndex === currentIndex) return;
    event.preventDefault();

    const boundedIndex =
      (nextIndex + WORKSPACE_VIEW_ICON_OPTIONS.length) %
      WORKSPACE_VIEW_ICON_OPTIONS.length;
    const nextOption = WORKSPACE_VIEW_ICON_OPTIONS[boundedIndex];
    onChange(nextOption.id);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-view-icon="${nextOption.id}"]`)
      ?.focus();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose view icon. Current icon: ${selectedOption.label}.`}
          className={cn(
            "group inline-flex items-center rounded-md border border-rule/70 bg-paper-elevated text-ink-2 transition-[background-color,border-color,color,box-shadow]",
            "hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink aria-expanded:border-rule-strong/70 aria-expanded:bg-paper-2 aria-expanded:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            iconOnly
              ? inline
                ? "size-10 justify-center rounded-none border-0 border-r border-rule/70 bg-transparent p-0 text-ink-3 hover:bg-paper-2 sm:size-9"
                : "size-9 justify-center p-0 sm:size-6"
              : "h-10 w-full justify-between gap-2 px-2.5 sm:h-9",
            className,
          )}
        >
          <span className={cn("inline-flex items-center gap-2", iconOnly && "gap-0")}>
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-sm bg-paper text-mark ring-1 ring-rule/70",
                compact ? "size-6 sm:size-5" : inline ? "size-6" : "size-7",
              )}
            >
              <SelectedIcon className={iconOnly ? "size-3.5" : "size-4"} aria-hidden />
            </span>
            {iconOnly ? null : (
              <span className="min-w-0 text-left">
                <span className="block truncate text-ui-sm font-medium text-ink">
                  {selectedOption.label}
                </span>
              </span>
            )}
          </span>
          {iconOnly ? null : <ChevronDown className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align ?? (compact ? "end" : "start")}
        className="w-[min(calc(100vw-2rem),21rem)] p-2"
      >
        <div className="flex items-center justify-between gap-2 px-1.5 pb-2 pt-1">
          <p className="text-ui-xs font-medium text-ink-2">Icon</p>
          <p className="truncate text-ui-xs text-ink-3">{selectedOption.label}</p>
        </div>
        <div
          className="grid grid-cols-4 gap-1.5"
          role="radiogroup"
          aria-label="View icon"
          onKeyDown={moveSelection}
        >
          {WORKSPACE_VIEW_ICON_OPTIONS.map((option) => {
            const active = value === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Use ${option.label} icon`}
                title={option.label}
                tabIndex={active || (!value && option.id === selectedOption.id) ? 0 : -1}
                data-view-icon={option.id}
                onClick={() => selectIcon(option.id)}
                className={cn(
                  "group relative flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-rule/65 bg-paper-2 px-1.5 py-2 text-center text-ui-2xs font-medium text-ink-2 transition-[background-color,border-color,box-shadow,color]",
                  "hover:border-rule-strong/70 hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  active && "border-mark/45 bg-mark-soft text-mark ring-1 ring-mark/20 hover:border-mark/55 hover:bg-mark-soft hover:text-mark",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-sm bg-paper text-ink-3 ring-1 ring-rule/60 transition-colors",
                    active && "bg-paper-elevated text-mark ring-mark/20",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="max-w-full truncate">{option.label}</span>
                {active ? (
                  <Check
                    className="absolute right-1.5 top-1.5 size-3.5 shrink-0 text-mark"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
