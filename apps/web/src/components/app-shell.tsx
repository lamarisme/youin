"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, LayoutGrid, Moon, Settings, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  fullBleed?: boolean;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/spaces", label: "Spaces", icon: Layers },
  { href: "/account", label: "Settings", icon: Settings },
];

export function AppShell({ children, fullBleed = false }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper">
      <div
        className={cn(
          "mx-auto grid w-full gap-0 lg:grid-cols-[240px_1fr]",
          fullBleed ? "max-w-none" : "max-w-[1520px]",
        )}
      >
        <aside className="flex flex-col border-b border-rule bg-paper-2 px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-4 lg:py-7">
          <div className="mb-3 flex items-center justify-between lg:mb-10">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
              <span className="pin-dot shrink-0">M</span>
              <span className="font-display text-lg font-semibold text-ink">Markly</span>
            </Link>
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                aria-label={theme === "dark" ? "Enable light mode" : "Enable dark mode"}
              >
                {theme === "dark" ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
              </button>
              <Avatar className="size-8">
                <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink">MK</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
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
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
            >
              {theme === "dark" ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>

            <div className="mt-3 flex items-center gap-2.5 rounded-md border border-rule px-2.5 py-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink">MK</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-medium text-ink">Mira Klein</p>
                <p className="truncate text-[0.6875rem] text-ink-3">Acme Studio</p>
              </div>
            </div>
          </div>
        </aside>

        <main
          className={cn(
            "min-h-screen py-6 sm:py-8 lg:py-10",
            fullBleed ? "px-3 sm:px-5 lg:px-6 xl:px-8" : "px-4 sm:px-8 lg:px-12 xl:px-14",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
