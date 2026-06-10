export default function OnboardingLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Checking workspace access"
      aria-busy="true"
      className="space-y-5"
    >
      <div className="rounded-lg border border-rule bg-paper-2 p-4">
        <div className="h-3 w-20 rounded-sm bg-paper-3 motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-52 max-w-full rounded-sm bg-paper-3 motion-safe:animate-pulse" />
        <div className="mt-2 h-4 w-full max-w-sm rounded-sm bg-paper-3 motion-safe:animate-pulse" />
        <div className="mt-6 h-36 rounded-lg bg-paper motion-safe:animate-pulse" />
      </div>
      <p className="text-center text-ui-xs text-ink-3">Checking workspace access...</p>
    </div>
  );
}

