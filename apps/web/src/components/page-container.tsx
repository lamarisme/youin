import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("w-full min-w-0 space-y-3 px-4 py-4 sm:px-5", className)}>{children}</div>;
}
