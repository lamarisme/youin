"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, LayoutGrid, Moon, Settings, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/spaces", label: "Spaces", icon: Layers },
  { href: "/account", label: "Settings", icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto grid w-full max-w-[1440px] gap-0 lg:grid-cols-[220px_1fr]">
        <aside className="border-r border-rule bg-paper-2 px-3 py-5 lg:sticky lg:top-0 lg:h-screen lg:px-4 lg:py-6">
          <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-1">
            <span className="pin-dot shrink-0">P</span>
            <span className="font-display text-lg font-semibold text-ink">Pin</span>
          </Link>

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] transition-colors",
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

          <div className="mt-auto pt-8">
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

        <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
