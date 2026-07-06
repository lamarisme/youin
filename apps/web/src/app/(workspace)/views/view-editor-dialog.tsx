"use client";

import { Check, Loader2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Field } from "@/components/field";
import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { MARK_SORT_OPTIONS } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Workspace,
  WorkspaceViewAnalyticsTimeframe,
  WorkspaceViewAnalyticsWidget,
  WorkspaceViewConfig,
  WorkspaceViewDensity,
  WorkspaceViewFilters,
  WorkspaceViewIcon,
  WorkspaceViewLayout,
  WorkspaceViewSortMode,
  WorkspaceViewDashboardGroupBy,
} from "@/lib/collab-types";
import {
  DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME,
  DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS,
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
} from "@/lib/workspace/views";
import { cn } from "@/lib/utils";

import { ViewScopeFields } from "./view-filter-fields";
import {
  VIEW_TEMPLATES,
  ViewIconPicker,
  defaultWorkspaceViewIcon,
} from "./view-ui";

export type ViewEditorValue = {
  name: string;
  layout: WorkspaceViewLayout;
  icon?: WorkspaceViewIcon;
  filters: WorkspaceViewFilters;
  config: WorkspaceViewConfig;
};

const GROUP_OPTIONS: ReadonlyArray<FilterOption<WorkspaceViewDashboardGroupBy>> = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Workflow stage" },
  { value: "page", label: "Page" },
  { value: "assignee", label: "Assignee" },
  { value: "project", label: "Project" },
];

const DENSITY_OPTIONS: ReadonlyArray<FilterOption<WorkspaceViewDensity>> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const ANALYTICS_TIMEFRAME_OPTIONS: ReadonlyArray<FilterOption<WorkspaceViewAnalyticsTimeframe>> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const ANALYTICS_WIDGET_OPTIONS: ReadonlyArray<{
  value: WorkspaceViewAnalyticsWidget;
  label: string;
  description: string;
}> = [
  {
    value: "summary",
    label: "Summary cards",
    description: "Total, open, closed, urgent, and unassigned marks.",
  },
  {
    value: "createdTrend",
    label: "Created over time",
    description: "A compact trend of new marks in the selected window.",
  },
  {
    value: "openClosedTrend",
    label: "Open vs closed",
    description: "How incoming work compares with closed work.",
  },
  {
    value: "statusBreakdown",
    label: "Workflow breakdown",
    description: "Marks grouped by workflow stage.",
  },
  {
    value: "priorityBreakdown",
    label: "Priority breakdown",
    description: "Low through critical priority mix.",
  },
  {
    value: "assigneeWorkload",
    label: "Assignee workload",
    description: "Marks owned by each teammate plus unassigned.",
  },
  {
    value: "projectBreakdown",
    label: "Project breakdown",
    description: "Where feedback is clustering across projects.",
  },
  {
    value: "labelBreakdown",
    label: "Label breakdown",
    description: "Most-used feedback labels.",
  },
  {
    value: "pageHotspots",
    label: "Page hotspots",
    description: "Pages with the most matching marks.",
  },
  {
    value: "agingBuckets",
    label: "Aging buckets",
    description: "How long open work has been waiting.",
  },
];

export function ViewEditorDialog({
  open,
  mode,
  workspace,
  initialValue,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  workspace: Workspace;
  initialValue: ViewEditorValue;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: ViewEditorValue) => void;
}) {
  const [layout, setLayout] = useState<WorkspaceViewLayout>(initialValue.layout);
  const [icon, setIcon] = useState<WorkspaceViewIcon>(
    initialValue.icon ?? defaultWorkspaceViewIcon(initialValue.layout),
  );
  const [name, setName] = useState(initialValue.name);
  const [filters, setFilters] = useState<WorkspaceViewFilters>({
    ...DEFAULT_WORKSPACE_VIEW_FILTERS,
    ...initialValue.filters,
  });
  const [config, setConfig] = useState<WorkspaceViewConfig>({
    ...DEFAULT_WORKSPACE_VIEW_CONFIG,
    ...initialValue.config,
    boardGroupBy: "status",
  });

  const selectedTemplate = useMemo(
    () => VIEW_TEMPLATES.find((template) => template.layout === layout) ?? VIEW_TEMPLATES[0],
    [layout],
  );
  const selectedAnalyticsWidgets = useMemo(
    () =>
      config.analyticsWidgets?.length
        ? config.analyticsWidgets
        : [...DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS],
    [config.analyticsWidgets],
  );

  function selectLayout(next: WorkspaceViewLayout) {
    setIcon((current) =>
      current === defaultWorkspaceViewIcon(layout)
        ? defaultWorkspaceViewIcon(next)
        : current,
    );
    setLayout(next);
    const template = VIEW_TEMPLATES.find((item) => item.layout === next);
    if (
      mode === "create" &&
      template &&
      (!name.trim() || VIEW_TEMPLATES.some((item) => item.defaultName === name))
    ) {
      setName(template.defaultName);
    }
    if (next === "analytics") {
      setConfig((current) => ({
        ...current,
        analyticsTimeframe:
          current.analyticsTimeframe ?? DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME,
        analyticsWidgets: current.analyticsWidgets?.length
          ? current.analyticsWidgets
          : [...DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS],
      }));
    }
  }

  function setAnalyticsWidget(widget: WorkspaceViewAnalyticsWidget, checked: boolean) {
    setConfig((current) => {
      const widgets = current.analyticsWidgets?.length
        ? current.analyticsWidgets
        : [...DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS];
      const nextWidgets = checked
        ? Array.from(new Set([...widgets, widget]))
        : widgets.filter((item) => item !== widget);
      return {
        ...current,
        analyticsWidgets: nextWidgets.length ? nextWidgets : widgets,
      };
    });
  }

  function submit() {
    if (!name.trim() || isSaving) return;
    const nextConfig: WorkspaceViewConfig = {
      ...DEFAULT_WORKSPACE_VIEW_CONFIG,
      ...config,
      boardGroupBy: "status",
    };
    if (layout === "analytics") {
      nextConfig.analyticsTimeframe =
        nextConfig.analyticsTimeframe ?? DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME;
      nextConfig.analyticsWidgets = nextConfig.analyticsWidgets?.length
        ? nextConfig.analyticsWidgets
        : [...DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS];
    } else {
      delete nextConfig.analyticsTimeframe;
      delete nextConfig.analyticsWidgets;
    }
    onSubmit({
      name,
      layout,
      icon,
      filters,
      config: nextConfig,
    });
  }

  const title = mode === "create" ? "Create a saved view" : "Edit saved view";
  const description =
    mode === "create"
      ? "Save a reusable lens for the marks your team checks often."
      : "Update the icon, filters, layout, and display options for this view.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-rule/70 px-4 py-3 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 overflow-y-auto px-4 py-4">
          <div className="grid gap-4">
            <Field id="view-name" label="View name">
              <div className="flex h-10 overflow-hidden rounded-md border border-transparent bg-paper-elevated transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] hover:bg-paper-2 focus-within:border-focus-ring/20 focus-within:bg-paper focus-within:ring-1 focus-within:ring-focus-ring/25 sm:h-9">
                <ViewIconPicker value={icon} onChange={setIcon} density="inline" />
                <input
                  id="view-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={selectedTemplate.defaultName}
                  maxLength={80}
                  className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-ui-md font-medium text-ink outline-none placeholder:text-ink-3 sm:text-ui-sm"
                />
              </div>
            </Field>
          </div>

          <section className="space-y-2">
            <p className="text-ui-xs font-medium text-ink-2">View layout</p>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="View layout">
              {VIEW_TEMPLATES.map((template) => {
                const active = layout === template.layout;
                return (
                  <button
                    key={template.layout}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectLayout(template.layout)}
                    className={cn(
                      "group flex min-h-14 items-start gap-2.5 rounded-md border border-rule/70 bg-paper-2 p-2.5 text-left transition-[background-color,border-color,box-shadow]",
                      "hover:border-rule-strong/70 hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                      active && "border-mark/45 bg-mark-soft ring-2 ring-mark/10",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-paper text-ink-3 transition-colors",
                        active && "bg-paper-elevated text-mark",
                      )}
                    >
                      <template.icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ui-sm font-medium text-ink">{template.label}</span>
                        {active ? <Check className="size-4 shrink-0 text-mark" aria-hidden /> : null}
                      </span>
                      <span className="mt-0.5 block text-ui-xs leading-snug text-ink-3">
                        {template.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-rule/70 bg-paper-2/70">
            <div className="border-b border-rule/70 px-3 py-2">
              <p className="text-ui-xs font-medium text-ink-2">Filters</p>
            </div>
            <div className="grid gap-4 p-3">
              <ViewScopeFields
                workspace={workspace}
                filters={filters}
                includeAdvanced
                labeled
                onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              />
              <Field
                id="view-search"
                label="Search terms"
                className="border-t border-rule/70 pt-3"
              >
                <Input
                  id="view-search"
                  type="search"
                  value={filters.q}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, q: event.target.value }))
                  }
                  placeholder="Title, description, page, or mark ID"
                  maxLength={160}
                  className="h-10 bg-paper-elevated text-ui-md sm:h-9 sm:text-ui-sm"
                />
              </Field>
            </div>
          </section>

          {layout === "analytics" ? (
            <section className="overflow-hidden rounded-md border border-rule/70 bg-paper-2/70">
              <div className="border-b border-rule/70 px-3 py-2">
                <p className="text-ui-xs font-medium text-ink-2">Insight widgets</p>
              </div>
              <div className="grid gap-3 p-3">
                <EditorSelect label="Timeframe">
                  <FilterSelect<WorkspaceViewAnalyticsTimeframe>
                    value={config.analyticsTimeframe ?? DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME}
                    onValueChange={(value) =>
                      setConfig((current) => ({ ...current, analyticsTimeframe: value }))
                    }
                    options={ANALYTICS_TIMEFRAME_OPTIONS}
                    ariaLabel="Set analytics timeframe"
                    triggerClassName="w-full sm:w-48"
                  />
                </EditorSelect>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ANALYTICS_WIDGET_OPTIONS.map((option) => {
                    const checked = selectedAnalyticsWidgets.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-16 cursor-pointer gap-2.5 rounded-md border border-rule/70 bg-paper-elevated p-2.5 transition-[background-color,border-color,box-shadow]",
                          "hover:border-rule-strong/70 hover:bg-paper-3 focus-within:ring-2 focus-within:ring-focus-ring/35",
                          checked && "border-mark/45 bg-mark-soft ring-1 ring-mark/15",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setAnalyticsWidget(option.value, event.currentTarget.checked)
                          }
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-rule-strong bg-paper text-paper",
                            checked && "border-mark bg-mark text-white",
                          )}
                        >
                          <Check className="size-3" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-ui-sm font-medium text-ink">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-ui-xs leading-snug text-ink-3">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-md border border-rule/70 bg-paper-2/70">
              <div className="border-b border-rule/70 px-3 py-2">
                <p className="text-ui-xs font-medium text-ink-2">Display options</p>
              </div>
              <div className="grid gap-3 p-3 sm:grid-cols-3">
                <EditorSelect label="Sort">
                  <FilterSelect<WorkspaceViewSortMode>
                    value={filters.sort}
                    onValueChange={(value) => setFilters((current) => ({ ...current, sort: value }))}
                    options={MARK_SORT_OPTIONS}
                    ariaLabel="Sort view marks"
                    triggerClassName="w-full"
                  />
                </EditorSelect>
                <EditorSelect label="Group">
                  <FilterSelect<WorkspaceViewDashboardGroupBy>
                    value={config.dashboardGroupBy ?? DEFAULT_WORKSPACE_VIEW_CONFIG.dashboardGroupBy ?? "none"}
                    onValueChange={(value) =>
                      setConfig((current) => ({ ...current, dashboardGroupBy: value }))
                    }
                    options={GROUP_OPTIONS}
                    ariaLabel="Group view marks"
                    triggerClassName="w-full"
                  />
                </EditorSelect>
                <EditorSelect label="Density">
                  <FilterSelect<WorkspaceViewDensity>
                    value={config.dashboardDensity ?? DEFAULT_WORKSPACE_VIEW_CONFIG.dashboardDensity ?? "comfortable"}
                    onValueChange={(value) =>
                      setConfig((current) => ({ ...current, dashboardDensity: value }))
                    }
                    options={DENSITY_OPTIONS}
                    ariaLabel="Set view density"
                    triggerClassName="w-full"
                  />
                </EditorSelect>
              </div>
            </section>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-rule/70 bg-paper-2/70 p-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!name.trim() || isSaving} aria-busy={isSaving || undefined}>
            {isSaving ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {isSaving
              ? mode === "create"
                ? "Creating"
                : "Saving"
              : mode === "create"
                ? `Create ${selectedTemplate.label.toLowerCase()} view`
                : "Save view"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorSelect({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-ui-xs font-medium text-ink-3">{label}</span>
      {children}
    </div>
  );
}
