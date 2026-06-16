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

function BreadcrumbHeaderSkeleton({
  actionWidths = ["w-[5.5rem]"],
}: {
  actionWidths?: string[];
}) {
  return (
    <div
      aria-hidden="true"
      className="-mx-3 -mt-3 flex min-h-9 items-center justify-between gap-2 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <ShimmerBar className="h-4 w-20 rounded-sm" />
        <ShimmerBar className="h-3 w-3 rounded-sm" />
        <ShimmerBar className="h-4 w-28 rounded-sm" />
      </div>
      <div className="flex h-8 shrink-0 items-center gap-1">
        {actionWidths.map((width, index) => (
          <ShimmerBar
            key={`breadcrumb-action-${String(index)}`}
            className={cn("h-7 rounded-md", width)}
          />
        ))}
      </div>
    </div>
  );
}

function DashboardViewChipsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 items-center gap-1.5 overflow-hidden border-b border-rule/70 pb-2"
    >
      {["w-16", "w-20", "w-14"].map((width, index) => (
        <ShimmerBar
          key={`dashboard-view-${String(index)}`}
          className={cn("h-10 shrink-0 rounded-md sm:h-7", width)}
        />
      ))}
      <ShimmerBar className="ml-auto h-10 w-9 shrink-0 rounded-md sm:h-7" />
    </div>
  );
}

function ProductRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-md bg-paper-elevated"
    >
      <div className="divide-y divide-rule/70">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`product-row-${String(index)}`}
            className="flex min-h-16 items-center gap-3 px-3 py-3"
          >
            <ShimmerBar className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <ShimmerBar
                className={cn(
                  "h-4 rounded-sm",
                  index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-1/2" : "w-3/5",
                )}
              />
              <ShimmerBar className="h-3 w-5/6 max-w-[24rem] rounded-sm" />
            </div>
            <ShimmerBar className="hidden h-7 w-16 shrink-0 rounded-md sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardFiltersSkeleton() {
  return (
    <div aria-hidden="true" className="w-full">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-b border-rule/70 pb-2">
        <ShimmerBar className="h-11 min-w-[min(100%,13rem)] flex-1 rounded-md sm:h-8 sm:flex-none sm:basis-[280px]" />
        <ShimmerBar className="h-11 w-24 rounded-md sm:h-8" />
      </div>
    </div>
  );
}

function DashboardMarkListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule/60"
    >
      <div className="flex min-h-11 items-center gap-2 bg-paper-2/65 px-3 sm:min-h-10">
        <ShimmerBar className="h-4 w-24 rounded-sm" />
        <ShimmerBar className="h-3 w-6 rounded-sm" />
      </div>
      <div className="divide-y divide-rule/40">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`dashboard-mark-row-${String(index)}`}
            className="flex min-h-12 items-center gap-3 px-3 py-2 sm:min-h-11 sm:py-1.5"
          >
            <ShimmerBar className="size-4 shrink-0 rounded-sm max-sm:size-5" />
            <div className="min-w-0 flex-1">
              <ShimmerBar
                className={cn(
                  "h-4 rounded-sm",
                  index % 3 === 0 ? "w-4/5" : index % 3 === 1 ? "w-2/3" : "w-3/5",
                )}
              />
            </div>
            <ShimmerBar className="hidden h-3 w-16 shrink-0 rounded-sm sm:block" />
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
        <ShimmerBar className="h-9 w-20 rounded-md sm:h-7" />
      </div>

      <DashboardViewChipsSkeleton />
      <DashboardFiltersSkeleton />
      <DashboardMarkListSkeleton />
    </div>
  );
}

export function MarkDetailMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading mark"}
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="-mx-3 -mt-3 flex min-h-9 items-center justify-between gap-2 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <ShimmerBar className="h-4 w-14 rounded-sm" />
          <ShimmerBar className="h-4 min-w-0 max-w-56 flex-1 rounded-sm" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ShimmerBar className="size-9 rounded-md sm:size-7" />
          <ShimmerBar className="h-9 w-14 rounded-full sm:h-7" />
        </div>
      </div>

      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <ShimmerBar className="h-5 w-28 rounded-sm" />
          <ShimmerBar className="h-8 max-w-xl rounded-md" />
          <ShimmerBar className="h-28 rounded-md" />
          <ShimmerBar className="h-36 rounded-md" />
        </section>

        <aside className="hidden min-w-0 space-y-3 lg:block">
          <ShimmerBar className="aspect-[4/3] rounded-md" />
          <ShimmerBar className="h-24 rounded-md" />
        </aside>
      </div>
    </div>
  );
}

export function InboxMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading inbox"}
      aria-live="polite"
    >
      <BreadcrumbHeaderSkeleton actionWidths={["w-16", "w-24"]} />
      <div aria-hidden="true" className="overflow-hidden rounded-md bg-paper-elevated">
        <div className="divide-y divide-rule/70">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`inbox-row-${String(index)}`}
              className="flex items-start gap-3 px-4 py-3"
            >
              <ShimmerBar className="mt-2 size-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid min-w-0 gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <ShimmerBar className="h-3 w-10 shrink-0 rounded-sm" />
                    <ShimmerBar
                      className={cn(
                        "h-4 rounded-sm",
                        index % 2 === 0 ? "w-3/5" : "w-4/5",
                      )}
                    />
                  </div>
                  <ShimmerBar className="h-3 w-14 rounded-sm sm:col-start-2" />
                  <ShimmerBar className="h-3 w-1/2 rounded-sm sm:col-start-1" />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <ShimmerBar className="size-5 shrink-0 rounded-full" />
                  <ShimmerBar className="h-3 w-3/4 max-w-[26rem] rounded-sm" />
                </div>
              </div>
              <ShimmerBar className="mt-1.5 size-4 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ViewsMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading saved views"}
      aria-live="polite"
    >
      <BreadcrumbHeaderSkeleton />
      <ProductRowsSkeleton rows={4} />
      <section aria-hidden="true" className="overflow-hidden rounded-md bg-paper-elevated">
        <div className="border-b border-rule/70 px-3 py-2">
          <ShimmerBar className="h-3 w-24 rounded-sm" />
        </div>
        <div className="divide-y divide-rule/70">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`view-template-${String(index)}`}
              className="flex min-h-16 items-center gap-3 px-3 py-3"
            >
              <ShimmerBar className="size-9 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <ShimmerBar className="h-4 w-32 rounded-sm" />
                <ShimmerBar className="h-3 w-3/4 rounded-sm" />
              </div>
              <ShimmerBar className="size-4 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ViewDetailMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading view"}
      aria-live="polite"
    >
      <BreadcrumbHeaderSkeleton actionWidths={["w-24", "w-7"]} />
      <section aria-hidden="true" className="space-y-3 rounded-md bg-paper-2 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ShimmerBar className="size-8 shrink-0 rounded-md" />
            <ShimmerBar className="h-10 min-w-0 flex-1 rounded-md sm:h-8" />
          </div>
          <ShimmerBar className="h-7 w-16 rounded-md" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <ShimmerBar className="h-8 rounded-md" />
          <ShimmerBar className="h-8 rounded-md" />
          <ShimmerBar className="h-8 rounded-md" />
        </div>
      </section>
      <DashboardFiltersSkeleton />
      <DashboardMarkListSkeleton rows={6} />
      <div aria-hidden="true" className="hidden items-center justify-center gap-1.5 md:flex">
        <ShimmerBar className="h-8 w-24 rounded-md" />
        <ShimmerBar className="h-4 w-20 rounded-sm" />
        <ShimmerBar className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function AccountMainSkeleton({ id }: { id?: string }) {
  return (
    <div
      className="w-full min-w-0 space-y-5 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading account settings"}
      aria-live="polite"
    >
      <div aria-hidden="true" className="space-y-2">
        <ShimmerBar className="h-3 w-20 rounded-sm" />
        <ShimmerBar className="h-8 w-64 max-w-full rounded-sm" />
        <ShimmerBar className="h-4 w-[32rem] max-w-full rounded-sm" />
      </div>

      <div aria-hidden="true" className="grid gap-5 lg:grid-cols-[15rem_minmax(0,56rem)] lg:items-start lg:gap-7">
        <nav className="-mx-3 overflow-x-hidden border-y border-rule/70 bg-paper-2/70 px-3 py-2 sm:-mx-4 sm:px-4 lg:sticky lg:top-4 lg:mx-0 lg:rounded-lg lg:border lg:bg-paper-elevated lg:p-1.5">
          <div className="hidden px-2 pb-2 pt-1 lg:block">
            <ShimmerBar className="h-3 w-16 rounded-sm" />
          </div>
          <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`account-nav-${String(index)}`}
                className="flex min-h-11 w-36 shrink-0 items-center gap-2 rounded-md px-2.5 py-2 lg:min-h-12 lg:w-full"
              >
                <ShimmerBar className="size-7 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <ShimmerBar className="h-3.5 w-20 rounded-sm" />
                  <ShimmerBar className="hidden h-3 w-28 rounded-sm lg:block" />
                </div>
                {index > 0 && index < 5 ? (
                  <ShimmerBar className="h-4 w-5 rounded-sm" />
                ) : null}
              </div>
            ))}
          </div>
        </nav>

        <section className="min-w-0 space-y-5 lg:border-l lg:border-rule/70 lg:pl-7">
          <div className="space-y-2">
            <ShimmerBar className="h-5 w-36 rounded-sm" />
            <ShimmerBar className="h-4 w-72 max-w-full rounded-sm" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`account-panel-${String(index)}`}
                className="rounded-md border border-rule/70 bg-paper-elevated p-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <ShimmerBar className="h-4 w-40 rounded-sm" />
                    <ShimmerBar className="h-3 w-5/6 max-w-[28rem] rounded-sm" />
                  </div>
                  <ShimmerBar className="h-8 w-20 shrink-0 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
