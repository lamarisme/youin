import {
  BarChart3,
  ListTree,
  SquareKanban,
  View,
  type LucideIcon,
} from "lucide-react";

import type { WorkspaceViewLayout } from "@/lib/collab-types";

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
    description: "Open and resolved marks grouped into workflow columns.",
    defaultName: "Status board",
    icon: SquareKanban,
  },
  {
    layout: "analytics",
    label: "Analytics",
    description: "Throughput and activity for the marks in this view.",
    defaultName: "Workspace analytics",
    icon: BarChart3,
  },
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
