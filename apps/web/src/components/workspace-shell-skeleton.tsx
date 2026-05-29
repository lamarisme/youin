import { cn } from "@/lib/utils";

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-paper-3/85 motion-safe:animate-pulse dark:bg-muted",
        className,
      )}
    />
  );
}

function DashboardViewChipsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 items-center gap-1 overflow-hidden border-b border-rule/70 pb-2"
    >
      {["w-[4.75rem]", "w-[5.5rem]", "w-[6.25rem]", "w-[4.75rem]", "w-[5rem]"].map((width, index) => (
        <ShimmerBar key={`dashboard-view-${String(index)}`} className={cn("h-7 shrink-0 rounded-md", width)} />
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ShimmerBar className="hidden h-7 w-14 rounded-md sm:block" />
        <ShimmerBar className="h-7 w-[4.5rem] rounded-md" />
      </div>
    </div>
  );
}

function DashboardFiltersSkeleton() {
  return (
    <div aria-hidden="true" className="w-full space-y-1.5">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-b border-rule/70 pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {["w-[4.75rem]", "w-[5.75rem]", "w-[4.5rem]", "w-[7rem]"].map((width, index) => (
            <ShimmerBar key={`dashboard-attention-${String(index)}`} className={cn("h-8 rounded-md", width)} />
          ))}
        </div>
        <ShimmerBar className="h-9 min-w-[min(100%,13rem)] flex-1 rounded-md sm:h-8 sm:flex-none sm:basis-[280px]" />
        <ShimmerBar className="h-9 w-[5.75rem] rounded-md sm:h-8" />
        <div className="ml-auto flex items-center gap-2">
          <ShimmerBar className="hidden h-5 w-20 rounded-sm sm:block" />
          <ShimmerBar className="h-7 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function DashboardMobileListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule/60 md:hidden"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`dashboard-mobile-row-${String(index)}`}
          className="border-b border-rule/50 px-3 py-3 last:border-b-0"
        >
          <div className="flex items-start gap-3">
            <ShimmerBar className="mt-1 size-5 shrink-0 rounded-sm" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShimmerBar className="h-3 w-10 rounded-sm" />
                    <ShimmerBar className="h-4 w-3/4 max-w-[18rem] rounded-sm" />
                  </div>
                  <ShimmerBar className="h-3 w-2/3 max-w-[16rem] rounded-sm" />
                </div>
                <ShimmerBar className="size-8 shrink-0 rounded-md" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <ShimmerBar className="h-6 w-[5.75rem] rounded-full" />
                <ShimmerBar className="h-6 w-[4.5rem] rounded-full" />
                <ShimmerBar className="h-6 w-8 rounded-full" />
                <ShimmerBar className="h-5 w-12 rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardTableSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="hidden overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule/60 md:block"
    >
      <div className="grid h-7 grid-cols-[1.25rem_8rem_minmax(10rem,1fr)_6rem_7rem_6.5rem_2.5rem_4rem_2rem] items-center gap-3 border-b border-rule/60 bg-paper-2/70 px-3">
        <ShimmerBar className="size-4 rounded-sm" />
        <ShimmerBar className="h-2.5 w-14 rounded-sm" />
        <ShimmerBar className="h-2.5 w-12 rounded-sm" />
        <ShimmerBar className="h-2.5 w-14 rounded-sm" />
        <ShimmerBar className="h-2.5 w-12 rounded-sm" />
        <ShimmerBar className="h-2.5 w-16 rounded-sm" />
        <span />
        <ShimmerBar className="h-2.5 w-10 rounded-sm" />
        <span />
      </div>
      <div className="divide-y divide-rule/45">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`dashboard-table-row-${String(index)}`}
            className="grid min-h-[3.5rem] grid-cols-[1.25rem_8rem_minmax(10rem,1fr)_6rem_7rem_6.5rem_2.5rem_4rem_2rem] items-center gap-3 px-3 py-2"
          >
            <ShimmerBar className="size-4 rounded-sm" />
            <ShimmerBar className="h-7 w-full rounded-md" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <ShimmerBar className="h-3 w-10 shrink-0 rounded-sm" />
                <ShimmerBar
                  className={cn(
                    "h-4 rounded-sm",
                    index % 3 === 0 ? "w-4/5" : index % 3 === 1 ? "w-2/3" : "w-3/5",
                  )}
                />
              </div>
              <ShimmerBar className="h-3 w-1/2 max-w-[18rem] rounded-sm" />
            </div>
            <ShimmerBar className="h-7 w-full rounded-md" />
            <div className="flex min-w-0 gap-1">
              <ShimmerBar className="h-5 w-12 rounded-sm" />
              {index % 2 === 0 ? <ShimmerBar className="h-5 w-10 rounded-sm" /> : null}
            </div>
            <ShimmerBar className="h-7 w-full rounded-md" />
            {index % 4 === 0 ? <ShimmerBar className="h-5 w-full rounded-full" /> : <span />}
            <ShimmerBar className="h-3 w-10 rounded-sm" />
            <ShimmerBar className="size-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Route-level loading placeholder (renders inside `AppShell`’s single `<main>` — no nested landmark). */
export function WorkspaceShellSkeleton({ id }: { id?: string }) {
  return <WorkspaceMainSkeleton id={id ?? "Loading workspace"} />;
}

/** Main column placeholders when the shell is already visible (e.g. useSearchParams Suspense). */
export function WorkspaceMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="shell-full space-y-5"
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
          <ShimmerBar key={`sk-${String(i)}`} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DashboardMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading dashboard"}
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="-mx-3 -mt-3 flex min-h-9 items-center justify-between gap-2 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <ShimmerBar className="h-4 w-16 rounded-sm" />
        </div>
        <ShimmerBar className="h-7 w-[5.5rem] rounded-md" />
      </div>

      <DashboardViewChipsSkeleton />
      <DashboardFiltersSkeleton />
      <DashboardMobileListSkeleton />
      <DashboardTableSkeleton />

      <div aria-hidden="true" className="hidden items-center justify-center gap-1.5 md:flex">
        <ShimmerBar className="h-8 w-24 rounded-md" />
        <ShimmerBar className="h-4 w-20 rounded-sm" />
        <ShimmerBar className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
