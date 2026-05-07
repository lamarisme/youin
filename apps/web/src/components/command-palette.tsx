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
import { Command } from "cmdk";
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

interface PaletteCommand {
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

  const openPalette = useCallback(() => setOpen(true), []);

  // G + key navigation shortcuts
  useEffect(() => {
    if (open) return;
    let pendingG = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function isInputTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function reset() {
      pendingG = false;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function handler(e: KeyboardEvent) {
      if (isInputTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!pendingG) {
        if (e.key === "g" || e.key === "G") {
          pendingG = true;
          timeoutId = setTimeout(reset, 900);
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
        const win = window as unknown as { __next_router_push?: (url: string) => void };
        if (win.__next_router_push) {
          win.__next_router_push(target);
        }
      }
      reset();
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      reset();
    };
  }, [open]);

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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const { spaces, workspace, workspaceId, userId } = useCollabStore(
    useShallow((s) => ({
      spaces: s.workspace.spaces,
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      userId: s.userId,
    })),
  );
  const inbox = useInbox(workspace, workspaceId, userId);

  // Store router for access in the G+key handler
  useEffect(() => {
    (window as unknown as { __next_router_push?: typeof router.push }).__next_router_push = router.push;
    return () => {
      delete (window as unknown as { __next_router_push?: typeof router.push }).__next_router_push;
    };
  }, [router]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function onSelect(id: string) {
    const cmd = allCommands.find((c) => c.id === id);
    if (cmd) {
      cmd.run();
      onOpenChange(false);
    }
  }

  const allCommands = useMemo<PaletteCommand[]>(() => {
    const base: PaletteCommand[] = [
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
        subtitle: "Profile, team, and labels",
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
    const spaceCommands: PaletteCommand[] = spaces.map((s) => ({
      id: `space-${s.id}`,
      title: s.name,
      subtitle: "Filter triage to this space",
      group: "Spaces",
      keywords: ["space", "jump"],
      icon: Hash,
      run: () => router.push(`/dashboard?space=${s.id}`),
    }));
    return [...base, ...spaceCommands];
  }, [router, theme, toggleTheme, spaces, inbox.unreadCount]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className={cn(
        "fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_24px_60px_-24px_oklch(17%_0.012_50_/_0.45)]",
        "dark:shadow-[0_24px_60px_-24px_oklch(0%_0_0_/_0.6)]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-rule px-3.5 py-2.5">
        <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
        <Command.Input
          ref={inputRef}
          autoFocus
          placeholder="Type a command or search…"
          className="flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
        />
        <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
          esc
        </kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto py-1.5">
        <Command.Empty className="px-4 py-6 text-center text-[0.8125rem] text-ink-3">
          No commands match your search.
        </Command.Empty>

        {["Navigate", "Spaces", "Theme"].map((group) => {
          const items = allCommands.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <Command.Group
              key={group}
              heading={group}
              className="py-1 [&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3"
            >
              {items.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <Command.Item
                    key={cmd.id}
                    value={`${cmd.title} ${cmd.subtitle ?? ""} ${(cmd.keywords ?? []).join(" ")}`}
                    onSelect={() => onSelect(cmd.id)}
                    className={cn(
                      "mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[0.875rem] transition-colors",
                      "data-[selected=true]:bg-paper-3 data-[selected=true]:text-ink",
                      "text-ink-2",
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
                  </Command.Item>
                );
              })}
            </Command.Group>
          );
        })}
      </Command.List>

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
    </Command.Dialog>
  );
}
