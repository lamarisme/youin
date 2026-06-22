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
