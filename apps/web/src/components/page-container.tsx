import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:pl-2 lg:pr-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
