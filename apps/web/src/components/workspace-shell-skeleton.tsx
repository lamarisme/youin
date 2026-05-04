function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-paper-3 dark:bg-muted ${className ?? ""}`}
    />
  );
}

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
              <ShimmerBar className="size-9 rounded-full" />
              <ShimmerBar className="h-7 w-[4.75rem]" />
            </div>
            <div className="flex items-center gap-1.5 lg:hidden">
              <ShimmerBar className="size-10 rounded-md" />
              <ShimmerBar className="size-8 rounded-full" />
            </div>
          </div>

          <div className="flex gap-1.5 pb-1 lg:flex-col lg:space-y-1 lg:pb-0">
            <ShimmerBar className="h-10 w-[7.75rem] shrink-0 lg:w-full" />
            <ShimmerBar className="h-10 w-[6.75rem] shrink-0 lg:w-full" />
          </div>

          <div className="mt-auto hidden pt-10 lg:flex lg:flex-col">
            <ShimmerBar className="h-10 w-full" />
            <ShimmerBar className="mt-3 h-[3.375rem] w-full rounded-lg" />
            <ShimmerBar className="mt-3 h-10 w-full" />
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
