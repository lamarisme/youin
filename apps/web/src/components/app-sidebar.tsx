"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  Inbox as InboxIcon,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { useOpenCommandPalette } from "@/components/command-palette";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCollabStore } from "@/lib/collab-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Triage", icon: LayoutGrid, shortcut: "D", exactOnly: false },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, shortcut: "I", exactOnly: false },
  { href: "/spaces", label: "Spaces", icon: Layers, shortcut: "S", exactOnly: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "A", exactOnly: false },
] as const;

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("youin-sidebar-collapsed") === "true";
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("youin-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle } as const;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  const { profileName, profileEmail, displayNamePreference, workspaceName, workspace, workspaceId, userId } = useCollabStore(
    useShallow((s) => ({
      profileName: s.profile.name,
      profileEmail: s.profile.email,
      displayNamePreference: s.profile.displayNamePreference,
      workspaceName: s.workspace.name,
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      userId: s.userId,
    })),
  );

  const inbox = useInbox(workspace, workspaceId, userId);
  const openCommandPalette = useOpenCommandPalette();

  const myUsername = workspace.members.find((m) => m.id === userId)?.username?.trim() ?? "";
  const displayName =
    displayNamePreference === "username" && myUsername
      ? `@${myUsername}`
      : profileName.trim() || profileEmail.split("@")[0] || "Member";
  const initials = initialsFromFullName(profileName.trim() || profileEmail);
  const workspaceLabel = workspaceName || "Workspace";
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-b border-rule bg-paper-2 px-3 py-3 transition-[width,padding] duration-200 ease-out",
        "lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:z-10",
        collapsed ? "lg:w-[56px] lg:px-2 lg:py-4" : "lg:w-60 lg:px-4 lg:py-5",
      )}
    >
      {/* --- Header --- */}
      <div className={cn("mb-3 space-y-3 lg:mb-5", collapsed && "lg:mb-4 lg:space-y-2")}>
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2.5 px-1 shrink-0",
              collapsed && "lg:hidden",
            )}
            aria-label="youin home"
          >
            <span className="pin-dot shrink-0">Y</span>
            {!collapsed && (
              <span className="font-display text-lg font-semibold text-ink hidden lg:inline">
                youin
              </span>
            )}
          </Link>

          {/* Desktop: collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden lg:flex items-center justify-center size-8 rounded-md text-ink-3 transition-colors",
              "hover:bg-paper-3 hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
              collapsed && "lg:mx-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[1.05rem]" />
            ) : (
              <PanelLeftClose className="size-[1.05rem]" />
            )}
          </button>

          {/* Mobile: theme toggle + avatar dropdown */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <ThemeToggleButton theme={theme} onToggle={toggleTheme} compact />
            <MobileAccountMenu
              initials={initials}
              displayName={displayName}
              workspaceLabel={workspaceLabel}
              isSigningOut={isSigningOut}
              onSignOut={handleSignOut}
            />
          </div>
        </div>

        {/* Search bar */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label="Open command palette"
                className={cn(
                  "hidden lg:flex items-center justify-center size-9 w-full rounded-md border border-rule bg-paper text-ink-3 transition-colors",
                  "hover:border-ink/12 hover:bg-paper-3 hover:text-ink",
                  "focus-visible:border-mark/35 focus-visible:ring-2 focus-visible:ring-mark/40",
                )}
              >
                <Search className="size-[1rem]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Search
              <kbd className="ml-1.5 rounded border border-rule/50 bg-paper-2 px-1 py-0.5 font-mono text-[0.625rem]">
                ⌘K
              </kbd>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open command palette"
            className={cn(
              "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-rule bg-paper px-2.5 text-left shadow-[inset_0_1px_0_0_oklch(100%_0_0/_0.04)] outline-none transition-colors",
              "hover:border-ink/12 hover:bg-paper-3",
              "focus-visible:border-mark/35 focus-visible:ring-2 focus-visible:ring-mark/40 dark:shadow-none",
            )}
          >
            <Search className="size-[1rem] shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-3">Search or jump…</span>
            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3 dark:bg-paper">
                ⌘
              </kbd>
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3 dark:bg-paper">
                K
              </kbd>
            </span>
          </button>
        )}
      </div>

      {/* --- Navigation --- */}
      <nav
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1",
          "lg:block lg:overflow-visible lg:pb-0",
          collapsed ? "lg:space-y-0.5" : "lg:space-y-0.5",
        )}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exactOnly
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const showInboxBadge = item.href === "/inbox" && inbox.unreadCount > 0;

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.label}
                    className={cn(
                      "relative hidden lg:flex items-center justify-center size-9 rounded-md transition-colors",
                      isActive
                        ? "bg-mark-soft text-ink"
                        : "text-ink-2 hover:bg-paper-3 hover:text-ink",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                    )}
                  >
                    <Icon className="size-[1.1rem]" />
                    {showInboxBadge && (
                      <span
                        aria-label={`${inbox.unreadCount} unread`}
                        className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-mark px-1 text-[0.5625rem] font-semibold tabular-nums text-paper leading-none"
                      >
                        {inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-1.5">
                  {item.label}
                  <kbd className="rounded border border-rule/50 bg-paper-2 px-1 py-0.5 font-mono text-[0.625rem] text-ink-3">
                    G {item.shortcut}
                  </kbd>
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] transition-colors",
                "lg:flex lg:w-full lg:min-h-9 lg:gap-2.5 lg:px-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                isActive
                  ? "bg-mark-soft font-medium text-ink"
                  : "text-ink-2 hover:bg-paper-3 hover:text-ink",
              )}
            >
              <Icon className="size-[1.1rem] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {showInboxBadge ? (
                <span
                  aria-label={`${inbox.unreadCount} unread`}
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-mark px-1.5 text-[0.625rem] font-semibold tabular-nums text-paper"
                >
                  {inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}
                </span>
              ) : (
                <kbd className="hidden lg:inline text-[0.625rem] text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  G {item.shortcut}
                </kbd>
              )}
            </Link>
          );
        })}
      </nav>

      {/* --- Bottom Section (Desktop) --- */}
      <div className="mt-auto hidden pt-6 lg:block">
        {collapsed ? (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ThemeToggleButton theme={theme} onToggle={toggleTheme} compact />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/account"
                    aria-label={`Account — ${displayName}`}
                    aria-current={accountActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center size-9 rounded-md transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                      accountActive
                        ? "bg-mark-soft text-ink"
                        : "text-ink-2 hover:bg-paper-3 hover:text-ink",
                    )}
                  >
                    <Avatar className="size-7">
                      <AvatarFallback
                        className={cn(
                          "text-[10px] font-medium text-ink",
                          accountActive ? "bg-mark/15" : "bg-paper-3",
                        )}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex flex-col">
                    <span className="font-medium">{displayName}</span>
                    <span className="text-ink-3">{workspaceLabel}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-label="Sign out"
                  className={cn(
                    "mx-auto mt-3 flex items-center justify-center size-9 rounded-md text-ink-3 transition-colors",
                    "hover:bg-paper-3 hover:text-ink disabled:opacity-60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                  )}
                >
                  {isSigningOut ? (
                    <Loader2 className="size-[1.05rem] animate-spin" />
                  ) : (
                    <LogOut className="size-[1.05rem]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
              <Link
                href="/account"
                aria-current={accountActive ? "page" : undefined}
                className={cn(
                  "group flex min-h-10 items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                  accountActive ? "bg-mark-soft" : "hover:bg-paper-3",
                )}
              >
                <Avatar className="size-7">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-medium text-ink",
                      accountActive ? "bg-mark/15" : "bg-paper-3",
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-ink">{displayName}</p>
                  <p className="truncate text-[0.6875rem] text-ink-3">{workspaceLabel}</p>
                </div>
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 text-ink-3 transition-opacity",
                    accountActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-hidden="true"
                />
              </Link>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={cn(
                "mt-3 flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[0.8125rem] text-ink-3 transition-colors",
                "hover:bg-paper-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
              )}
            >
              {isSigningOut ? (
                <Loader2 className="size-[1.05rem] animate-spin" />
              ) : (
                <LogOut className="size-[1.05rem]" />
              )}
              <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function MobileAccountMenu({
  initials,
  displayName,
  workspaceLabel,
  isSigningOut,
  onSignOut,
}: {
  initials: string;
  displayName: string;
  workspaceLabel: string;
  isSigningOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open account menu"
          className={cn(
            "rounded-full ring-2 ring-transparent transition-shadow",
            "hover:ring-mark/30",
            "focus-visible:outline-none focus-visible:ring-mark/60",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{displayName}</span>
            <span className="font-normal text-muted-foreground">{workspaceLabel}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggleButton({
  theme,
  onToggle,
  compact,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
  compact?: boolean;
}) {
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Light mode" : "Dark mode";
  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-2 transition-colors",
          "hover:bg-paper-3 hover:text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
        )}
        aria-label={label}
      >
        <Icon className="size-[1.05rem]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[0.8125rem] text-ink-2 transition-colors",
        "hover:bg-paper-3 hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
      )}
    >
      <Icon className="size-[1.05rem]" />
      <span>{label}</span>
    </button>
  );
}
