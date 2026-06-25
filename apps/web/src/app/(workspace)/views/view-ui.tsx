import {
  Bug,
  Check,
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
}: {
  value?: WorkspaceViewIcon | null;
  onChange: (icon: WorkspaceViewIcon) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-1.5 sm:grid-cols-8", className)} role="radiogroup" aria-label="View icon">
      {WORKSPACE_VIEW_ICON_OPTIONS.map((option) => {
        const active = value === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative flex size-8 items-center justify-center rounded-md border border-rule/70 bg-paper-2 text-ink-3 transition-[background-color,border-color,box-shadow,color]",
              "hover:border-rule-strong/70 hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              active && "border-mark/45 bg-mark-soft text-mark ring-2 ring-mark/10",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {active ? (
              <Check className="absolute -right-1 -top-1 size-3 rounded-full bg-paper-elevated text-mark ring-1 ring-mark/25" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
