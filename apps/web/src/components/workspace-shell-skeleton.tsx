import { BarChart3, Inbox as InboxIcon, Layers, LayoutGrid, type LucideIcon } from "lucide-react";

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-paper-3 dark:bg-muted ${className ?? ""}`}
    />
  );
}

const NAV_PLACEHOLDERS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Triage", icon: LayoutGrid },
  { label: "Inbox", icon: InboxIcon },
  { label: "Spaces", icon: Layers },
  { label: "Analytics", icon: BarChart3 },
];

/** Full AppShell-shaped placeholder for route transitions (sidebar + main). */
export function WorkspaceShellSkeleton({ id }: { id?: string }) {
  return (
    <div className="min-h-screen bg-paper" aria-busy="true" aria-label={id ?? "Loading workspace"}>
      <div className="grid w-full gap-0 lg:grid-cols-[240px_1fr]">
        <aside
          className="flex flex-col border-b border-rule bg-paper-2 px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-4 lg:py-7"
          aria-hidden="true"
        >
          <div className="mb-3 flex items-center justify-between lg:mb-10">
            <div className="flex items-center gap-2.5 px-1">
              <span className="pin-dot shrink-0">Y</span>
              <span className="font-display text-lg font-semibold text-ink">youin</span>
            </div>
          </div>

          <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {NAV_PLACEHOLDERS.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] text-ink-2 lg:flex lg:w-full lg:gap-2.5 lg:px-3"
              >
                <Icon className="size-[1.1rem]" />
                <span>{label}</span>
              </span>
            ))}
          </nav>

          <div className="mt-3 hidden items-center justify-between rounded-md px-2.5 py-1.5 text-[0.6875rem] text-ink-3 lg:flex">
            <span>Commands</span>
            <span className="inline-flex items-center gap-0.5">
              <kbd className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[0.625rem]">⌘</kbd>
              <kbd className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[0.625rem]">K</kbd>
            </span>
          </div>

          <div className="mt-auto hidden pt-10 lg:block">
            <div className="h-10" />
            <ShimmerBar className="mt-3 h-[3.375rem] w-full rounded-lg" />
            <div className="mt-3 h-10" />
          </div>
        </aside>

        <main className="page-y min-h-screen">
          <WorkspaceMainSkeleton />
        </main>
      </div>
    </div>
  );
}

/** Main column placeholders when the shell is already visible (e.g. useSearchParams Suspense). */
export function WorkspaceMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="shell-full space-y-6"
      aria-busy="true"
      aria-label={id ?? "Loading content"}
      aria-live="polite"
    >
      <div className="space-y-3">
        <ShimmerBar className="h-3 w-[5.25rem]" />
        <ShimmerBar className="h-9 max-w-xl" />
        <ShimmerBar className="h-4 max-w-[28rem]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBar key={`sk-${String(i)}`} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
