import {
  CircleDashed,
  Inbox,
  Plus,
  Search,
  User,
  View,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ShimmerBar } from "@/components/workspace-shell-skeleton";

export function AppSidebarSkeleton() {
  return (
    <aside
      className="group/sidebar flex flex-col bg-paper-2/95 px-2.5 py-2.5 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-60 lg:bg-paper-2 lg:px-2.5 lg:py-3"
      aria-label="Loading workspace navigation"
      aria-busy="true"
    >
      <div className="mb-2.5 space-y-2.5 lg:mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 lg:min-h-9">
            <BrandLogo className="size-8 lg:size-7" />
            <span className="min-w-0 flex-1 space-y-1">
              <ShimmerBar className="h-3.5 w-28 rounded-sm" />
              <ShimmerBar className="h-2.5 w-20 rounded-sm" />
            </span>
          </div>
          <ShimmerBar className="hidden size-7 rounded-md lg:block" />
        </div>

        <div className="flex min-h-10 w-full items-center gap-2 rounded-md bg-paper px-3 text-left text-ink-3 ring-1 ring-rule/60 lg:min-h-8 lg:px-2.5">
          <Search className="size-[1rem] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-ui-sm lg:text-ui-xs">
            Search or jump
          </span>
          <span className="hidden shrink-0 items-center gap-0.5 sm:flex" aria-hidden>
            <kbd className="rounded-[4px] bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs text-ink-3">
              ⌘
            </kbd>
            <kbd className="rounded-[4px] bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs text-ink-3">
              K
            </kbd>
          </span>
        </div>
      </div>

      <nav
        className="flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0"
        aria-label="Primary"
      >
        <StaticSidebarLink href="/inbox" label="Inbox" icon={Inbox} />
        <StaticSidebarLink href="/dashboard?assignee=me" label="My marks" icon={CircleDashed} />
      </nav>

      <section className="mt-3 hidden min-h-0 flex-1 overflow-y-auto lg:block" aria-label="Views">
        <div className="flex h-8 items-center justify-between px-2">
          <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
            Views
          </p>
          <Link
            href="/views"
            aria-label="Create view"
            className="flex size-7 items-center justify-center rounded-md text-ink-3"
          >
            <Plus className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="space-y-0.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-ui-sm text-ink-2"
            >
              <View className="size-[1.05rem] shrink-0 text-ink-3" aria-hidden />
              <ShimmerBar className="h-3 w-24 rounded-sm" />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-auto hidden pt-2 lg:block">
        <div className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-3 text-ink-3">
            <User className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <ShimmerBar className="h-3 w-24 rounded-sm" />
            <ShimmerBar className="h-2.5 w-32 rounded-sm" />
          </span>
        </div>
      </div>
    </aside>
  );
}

function StaticSidebarLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-ui-md text-ink-2 lg:flex lg:h-8 lg:w-full lg:min-h-0 lg:gap-2 lg:px-2.5 lg:py-0 lg:text-ui-xs"
    >
      <Icon className="size-[1rem] shrink-0 text-ink-3" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
