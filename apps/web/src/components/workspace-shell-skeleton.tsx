function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-paper-3 dark:bg-muted ${className ?? ""}`}
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
          <ShimmerBar key={`sk-${String(i)}`} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
