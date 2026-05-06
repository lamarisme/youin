"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  BarChart3,
  Hash,
  Inbox,
  Layers,
  LayoutGrid,
  Moon,
  Search,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { useTheme } from "@/components/theme-provider";
import { useCollabStore } from "@/lib/collab-store";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  keywords?: string[];
  shortcut?: string;
  icon?: LucideIcon;
  run: () => void;
}

const OpenCommandPaletteContext = createContext<(() => void) | null>(null);

/** Opens the workspace command palette (must be rendered inside CommandPaletteProvider). */
export function useOpenCommandPalette() {
  const open = useContext(OpenCommandPaletteContext);
  if (!open) {
    throw new Error("useOpenCommandPalette must be used within CommandPaletteProvider");
  }
  return open;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <OpenCommandPaletteContext.Provider value={openPalette}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </OpenCommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);

  const { spaces, workspace, workspaceId, userId } = useCollabStore(
    useShallow((s) => ({
      spaces: s.workspace.spaces,
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      userId: s.userId,
    })),
  );
  const inbox = useInbox(workspace, workspaceId, userId);

  useEffect(() => {
    if (open) return;
    let pendingG = false;
    let timeoutId: number | null = null;
    function isInputTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
    function reset() {
      pendingG = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
    function handler(e: KeyboardEvent) {
      if (isInputTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!pendingG) {
        if (e.key === "g" || e.key === "G") {
          pendingG = true;
          timeoutId = window.setTimeout(reset, 900);
        }
        return;
      }
      const navMap: Record<string, string> = {
        d: "/dashboard",
        i: "/inbox",
        s: "/spaces",
        a: "/analytics",
        c: "/account",
      };
      const key = e.key.toLowerCase();
      const target = navMap[key];
      if (target) {
        e.preventDefault();
        router.push(target);
      }
      reset();
    }
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      reset();
    };
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const baseCommands: Command[] = [
      {
        id: "nav-dashboard",
        title: "Triage",
        subtitle: "Review marks across your spaces",
        group: "Navigate",
        shortcut: "G D",
        icon: LayoutGrid,
        run: () => router.push("/dashboard"),
      },
      {
        id: "nav-inbox",
        title: inbox.unreadCount > 0 ? `Inbox · ${inbox.unreadCount} unread` : "Inbox",
        subtitle: "Activity on marks you follow",
        group: "Navigate",
        shortcut: "G I",
        icon: Inbox,
        run: () => router.push("/inbox"),
      },
      {
        id: "nav-analytics",
        title: "Analytics",
        subtitle: "Throughput and workspace activity",
        group: "Navigate",
        shortcut: "G A",
        icon: BarChart3,
        run: () => router.push("/analytics"),
      },
      {
        id: "nav-spaces",
        title: "Manage spaces",
        subtitle: "All spaces in this workspace",
        group: "Navigate",
        shortcut: "G S",
        icon: Layers,
        run: () => router.push("/spaces"),
      },
      {
        id: "nav-account",
        title: "Account settings",
        subtitle: "Profile, team, and tags",
        group: "Navigate",
        shortcut: "G C",
        icon: User,
        run: () => router.push("/account"),
      },
      {
        id: "theme-toggle",
        title: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        group: "Theme",
        keywords: ["theme", "dark", "light", "mode", "appearance"],
        icon: theme === "dark" ? Sun : Moon,
        run: () => toggleTheme(),
      },
    ];
    const spaceCommands: Command[] = spaces.map((s) => ({
      id: `space-${s.id}`,
      title: s.name,
      subtitle: "Filter triage to this space",
      group: "Spaces",
      keywords: ["space", "jump"],
      icon: Hash,
      run: () => router.push(`/dashboard?space=${s.id}`),
    }));
    return [...baseCommands, ...spaceCommands];
  }, [router, theme, toggleTheme, spaces, inbox.unreadCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const words = q.split(/\s+/);
    return commands.filter((c) => {
      const haystack = [c.title, c.subtitle ?? "", c.group, ...(c.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = groups.get(c.group) ?? [];
      arr.push(c);
      groups.set(c.group, arr);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const clampedActiveIndex =
    filtered.length === 0 ? 0 : Math.min(Math.max(0, activeIndex), filtered.length - 1);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[aria-selected="true"]');
    if (active && "scrollIntoView" in active) {
      (active as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [clampedActiveIndex, open]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function runActive() {
    const cmd = filtered[clampedActiveIndex];
    if (!cmd) return;
    cmd.run();
    onOpenChange(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i + 1;
        return next >= filtered.length ? filtered.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/15 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-label="Command palette"
          onKeyDown={handleKey}
          className="fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule bg-paper text-ink shadow-[0_24px_60px_-24px_oklch(17%_0.012_50_/_0.45)] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:shadow-[0_24px_60px_-24px_oklch(0%_0_0_/_0.6)]"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search commands and navigate the workspace.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={
                filtered[clampedActiveIndex]
                  ? `cmdk-item-${filtered[clampedActiveIndex].id}`
                  : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search…"
              className="flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
            />
            <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
              esc
            </kbd>
          </div>

          <div
            id="cmdk-list"
            role="listbox"
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto py-1.5"
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-[0.8125rem] text-ink-3">
                No commands match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              grouped.map(([group, items]) => (
                <div key={group} className="py-1">
                  <p className="px-3.5 pb-1 pt-1.5 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-3">
                    {group}
                  </p>
                  <ul>
                    {items.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      const active = idx === clampedActiveIndex;
                      const Icon = cmd.icon;
                      return (
                        <li
                          key={cmd.id}
                          id={`cmdk-item-${cmd.id}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => {
                            cmd.run();
                            onOpenChange(false);
                          }}
                          className={cn(
                            "mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[0.875rem] transition-colors",
                            active ? "bg-paper-3 text-ink" : "text-ink-2",
                          )}
                        >
                          {Icon ? (
                            <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{cmd.title}</span>
                            {cmd.subtitle ? (
                              <span className="block truncate text-[0.75rem] text-ink-3">
                                {cmd.subtitle}
                              </span>
                            ) : null}
                          </span>
                          {cmd.shortcut ? (
                            <kbd className="ml-auto shrink-0 rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                              {cmd.shortcut}
                            </kbd>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-rule px-3.5 py-2 text-[0.6875rem] text-ink-3">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono">↑↓</kbd>
              navigate
              <span className="px-1">·</span>
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono">↵</kbd>
              run
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono">⌘K</kbd>
              toggle
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
