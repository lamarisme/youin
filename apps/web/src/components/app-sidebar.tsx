"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Layers, LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCollabStore } from "@/lib/collab-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/spaces", label: "Spaces", icon: Layers },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { profileName, profileEmail, workspaceName } = useCollabStore(
    useShallow((s) => ({
      profileName: s.profile.name,
      profileEmail: s.profile.email,
      workspaceName: s.workspace.name,
    })),
  );

  const displayName = profileName.trim() || profileEmail.split("@")[0] || "Member";
  const initials = initialsFromFullName(profileName.trim() || profileEmail);
  const workspaceLabel = workspaceName || "Workspace";
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/auth/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <aside className="flex flex-col border-b border-rule bg-paper-2 px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-4 lg:py-7">
      <div className="mb-3 flex items-center justify-between lg:mb-10">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
          <span className="pin-dot shrink-0">Y</span>
          <span className="font-display text-lg font-semibold text-ink">youin</span>
        </Link>
        <div className="flex items-center gap-1.5 lg:hidden">
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} compact />
          <Link
            href="/account"
            aria-label="Open account settings"
            aria-current={accountActive ? "page" : undefined}
            className="rounded-full ring-2 ring-transparent transition-shadow hover:ring-mark/30 focus-visible:outline-none focus-visible:ring-mark/60 aria-[current=page]:ring-mark/40"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[0.8125rem] transition-colors lg:flex lg:w-full lg:gap-2.5 lg:px-3",
                isActive
                  ? "bg-mark-soft font-medium text-ink"
                  : "text-ink-2 hover:bg-paper-3 hover:text-ink",
              )}
            >
              <Icon className="size-[1.1rem]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden pt-10 lg:block">
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
        <Link
          href="/account"
          aria-current={accountActive ? "page" : undefined}
          className={cn(
            "group mt-3 flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50",
            accountActive
              ? "border-mark/30 bg-mark-soft"
              : "border-rule hover:bg-paper-3",
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

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="size-[1.1rem]" />
          <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
    </aside>
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
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
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
      className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
    >
      <Icon className="size-[1.1rem]" />
      <span>{label}</span>
    </button>
  );
}
