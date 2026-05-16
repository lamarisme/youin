import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

interface BreadcrumbHeaderProps extends BreadcrumbsProps {
  actions?: React.ReactNode;
}

export function BreadcrumbHeader({ items, actions, className }: BreadcrumbHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[3rem] flex-wrap items-start justify-between gap-2 pb-1",
        className,
      )}
    >
      <Breadcrumbs items={items} />
      {actions ? (
        <div className="flex min-h-8 shrink-0 items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-ink-3">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3.5 shrink-0 text-ink-3/70" aria-hidden />
            ) : null}
            <BreadcrumbContent item={item} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function BreadcrumbContent({ item }: { item: BreadcrumbItem }) {
  const className = cn(
    "max-w-[14rem] truncate rounded-md px-1.5 py-1 transition-colors",
    item.current
      ? "font-medium text-ink"
      : "text-ink-3 hover:bg-paper-2 hover:text-ink",
  );

  if (item.current) {
    return (
      <span className={className} aria-current="page" title={item.label}>
        {item.label}
      </span>
    );
  }

  if (item.href) {
    return (
      <Link href={item.href} className={className} title={item.label}>
        {item.label}
      </Link>
    );
  }

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={className} title={item.label}>
        {item.label}
      </button>
    );
  }

  return (
    <span className={className} title={item.label}>
      {item.label}
    </span>
  );
}
