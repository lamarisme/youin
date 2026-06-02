"use client";

import { useTranslations } from "next-intl";
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
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  CircleDashed,
  Flame,
  Hash,
  Inbox,
  Moon,
  Plus,
  Search,
  Sun,
  User,
  UserRound,
  View,
  type LucideIcon,
} from "lucide-react";

import { viewLayoutLabel } from "@/app/(workspace)/views/view-ui";
import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { useTheme } from "@/components/theme-provider";
import { Kbd } from "@/components/ui/kbd";
import { QUERY_CACHE } from "@/lib/queries/cache-policy";
import { workspaceKeys } from "@/lib/queries/keys";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";
import { getCommandPaletteIndexReadModelAction } from "@/lib/workspace/actions";
import { markHref } from "@/lib/workspace/routes";

interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  group: "actions" | "navigate" | "marks" | "views" | "projects" | "theme";
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
  const t = useTranslations("commandPalette");
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const { projects, views, workspaceId, userId } = useWorkspaceData((s) => ({
      projects: s.workspace.projects,
      views: s.workspace.views,
      workspaceId: s.workspaceId,
      userId: s.userId,
    }));
  const inbox = useInbox(workspaceId, userId);
  const paletteIndex = useQuery({
    queryKey: workspaceKeys.commandPaletteIndex(),
    queryFn: getCommandPaletteIndexReadModelAction,
    enabled: open,
    staleTime: QUERY_CACHE.commandPaletteStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnWindowFocus: false,
  });
  const marks = useMemo(
    () => paletteIndex.data?.marks ?? [],
    [paletteIndex.data?.marks],
  );

  // G + letter uses the same destinations as sidebar and palette.
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
        i: "/inbox",
        m: "/dashboard?assignee=me",
        v: "/views",
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
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const allCommands = useMemo<PaletteCommand[]>(() => {
    const openNewMark = () => {
      if (pathname.startsWith("/dashboard")) {
        window.dispatchEvent(new CustomEvent("youin:new-mark"));
      } else {
        router.push("/dashboard?new=1");
      }
    };
    const base: PaletteCommand[] = [
      {
        id: "action-new-mark",
        title: t("actions.newMark"),
        subtitle: t("actions.newMarkSub"),
        group: "actions",
        shortcut: "C",
        icon: Plus,
        run: openNewMark,
      },
      {
        id: "action-triage",
        title: t("actions.triage"),
        subtitle: t("actions.triageSub"),
        group: "actions",
        icon: Inbox,
        run: () => router.push("/dashboard?status=open&assignee=unassigned&group=page&density=compact"),
      },
      {
        id: "action-critical",
        title: t("actions.critical"),
        subtitle: t("actions.criticalSub"),
        group: "actions",
        icon: Flame,
        run: () => router.push("/dashboard?status=open&priority=critical&sort=priority"),
      },
      {
        id: "action-unassigned",
        title: t("actions.unassigned"),
        subtitle: t("actions.unassignedSub"),
        group: "actions",
        icon: UserRound,
        run: () => router.push("/dashboard?status=open&assignee=unassigned"),
      },
      {
        id: "nav-dashboard",
        title: t("nav.myMarks"),
        subtitle: t("nav.myMarksSub"),
        group: "navigate",
        shortcut: "G M",
        icon: CircleDashed,
        run: () => router.push("/dashboard?assignee=me"),
      },
      {
        id: "nav-inbox",
        title:
          inbox.unreadCount > 0
            ? t("nav.inboxUnread", { count: inbox.unreadCount })
            : t("nav.inbox"),
        subtitle: t("nav.inboxSub"),
        group: "navigate",
        shortcut: "G I",
        icon: Inbox,
        run: () => router.push("/inbox"),
      },
      {
        id: "nav-views",
        title: t("nav.views"),
        subtitle: t("nav.viewsSub"),
        group: "navigate",
        shortcut: "G V",
        icon: View,
        run: () => router.push("/views"),
      },
      {
        id: "nav-account",
        title: t("nav.account"),
        subtitle: t("nav.accountSub"),
        group: "navigate",
        shortcut: "G C",
        icon: User,
        run: () => router.push("/account"),
      },
      {
        id: "theme-toggle",
        title: theme === "dark" ? t("nav.themeLight") : t("nav.themeDark"),
        group: "theme",
        keywords: ["theme", "dark", "light", "mode", "appearance"],
        icon: theme === "dark" ? Sun : Moon,
        run: () => toggleTheme(),
      },
    ];
    const projectCommands: PaletteCommand[] = projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: t("projectSub"),
      group: "projects" as const,
      keywords: ["project", "jump"],
      icon: Hash,
      run: () => router.push(`/dashboard?project=${project.id}`),
    }));
    const viewCommands: PaletteCommand[] = views.map((view) => ({
      id: `view-${view.id}`,
      title: view.name,
      subtitle: `${viewLayoutLabel(view.layout)} view`,
      group: "views" as const,
      keywords: ["view", view.layout],
      icon: View,
      run: () => router.push(`/views/${view.id}`),
    }));
    const markCommands: PaletteCommand[] = marks.map((mark) => ({
      id: `mark-${mark.id}`,
      title: `${mark.displayKey} ${mark.title}`,
      subtitle: mark.page,
      group: "marks" as const,
      keywords: [mark.displayKey, mark.title, mark.page, mark.status, mark.priority],
      icon: CircleDashed,
      run: () => router.push(markHref(mark.displayKey, new URLSearchParams())),
    }));
    return [...base, ...markCommands, ...viewCommands, ...projectCommands];
  }, [router, pathname, theme, toggleTheme, projects, views, marks, inbox.unreadCount, t]);

  const onSelect = useCallback(
    (id: string) => {
      const cmd = allCommands.find((c) => c.id === id);
      if (cmd) {
        cmd.run();
        onOpenChange(false);
      }
    },
    [allCommands, onOpenChange],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("label")}
      className={cn(
        "fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg bg-paper-2 shadow-[0_20px_48px_-28px_oklch(17%_0.012_50_/_0.42)] ring-1 ring-rule",
        "dark:shadow-[0_24px_60px_-24px_oklch(8%_0.018_62_/_0.6)]",
      )}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
        <Command.Input
          ref={inputRef}
          autoFocus
          placeholder={t("placeholder")}
          className="flex-1 bg-transparent text-ui-md text-ink outline-none placeholder:text-ink-3"
        />
        <Kbd>
          esc
        </Kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto py-1.5">
        <Command.Empty className="px-4 py-6 text-center text-ui-sm text-ink-3">
          {t("empty")}
        </Command.Empty>

        {(["actions", "navigate", "marks", "views", "projects", "theme"] as const).map((groupId) => {
          const items = allCommands.filter((c) => c.group === groupId);
          if (items.length === 0) return null;
          return (
            <Command.Group
              key={groupId}
              heading={t(`groups.${groupId}`)}
              className="py-1 [&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-ui-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3"
            >
              {items.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <Command.Item
                    key={cmd.id}
                    value={`${cmd.title} ${cmd.subtitle ?? ""} ${(cmd.keywords ?? []).join(" ")}`}
                    onSelect={() => onSelect(cmd.id)}
                    className={cn(
                      "mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-ui-md transition-colors",
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
                        <span className="block truncate text-ui-xs text-ink-3">
                          {cmd.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {cmd.shortcut ? (
                      <Kbd className="ml-auto shrink-0">
                        {cmd.shortcut}
                      </Kbd>
                    ) : null}
                  </Command.Item>
                );
              })}
            </Command.Group>
          );
        })}
      </Command.List>

      <div className="flex items-center justify-between px-3.5 py-2 text-ui-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑↓</Kbd>
          {t("footerNavigate")}
          <span className="px-1">·</span>
          <Kbd>↵</Kbd>
          {t("footerRun")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⌘K</Kbd>
          {t("footerToggle")}
        </span>
      </div>
    </Command.Dialog>
  );
}
