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
        "-mx-3 -mt-3 flex min-h-9 items-center justify-between gap-2 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5",
        className,
      )}
    >
      <Breadcrumbs items={items} className="min-w-0 flex-1" />
      {actions ? (
        <div className="flex h-8 shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-0.5 text-ui-sm text-ink-3">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-0.5">
            {index > 0 ? (
              <ChevronRight className="size-3 shrink-0 text-ink-3/70" aria-hidden />
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
    "max-w-[16rem] truncate rounded-md px-1.5 py-0.5 transition-colors",
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
