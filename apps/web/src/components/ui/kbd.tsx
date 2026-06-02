import { cn } from "@/lib/utils";

function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "rounded bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs text-ink-3",
        "inline-flex items-center justify-center",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
