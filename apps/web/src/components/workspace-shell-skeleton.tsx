import { cn } from "@/lib/utils";

export function ShimmerBar({ className }: { className?: string }) {
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
