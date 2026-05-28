import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Visible only when total > 1; pass true to render even on a single page. */
  alwaysShow?: boolean;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  alwaysShow = false,
  className,
}: PaginationProps) {
  if (!alwaysShow && totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-rule pt-3 text-ui-xs text-ink-3",
        className,
      )}
    >
      <span className="tabular-nums">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 gap-1 px-3 text-ui-md sm:h-8 sm:px-2.5 sm:text-ui-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 gap-1 px-3 text-ui-md sm:h-8 sm:px-2.5 sm:text-ui-sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          Next
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
