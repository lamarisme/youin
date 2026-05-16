"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Inbox as InboxIcon,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { useOpenCommandPalette } from "@/components/command-palette";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { useCollabStore } from "@/lib/collab-store";
import { useCreateProjectMutation } from "@/lib/queries/use-workspace-mutations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

const NAV_ITEMS = [
  { href: "/inbox", labelKey: "inbox" as const, icon: InboxIcon, shortcut: "I", exactOnly: false },
  { href: "/dashboard", labelKey: "triage" as const, icon: LayoutGrid, shortcut: "D", exactOnly: false },
  { href: "/spaces", labelKey: "spaces" as const, icon: Layers, shortcut: "S", exactOnly: false },
  { href: "/analytics", labelKey: "analytics" as const, icon: BarChart3, shortcut: "A", exactOnly: false },
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
  const tNav = useTranslations("nav");
  const tSide = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  const { profileName, profileEmail, displayNamePreference, workspaceName, members, workspaceId, userId } = useCollabStore(
    useShallow((s) => ({
      profileName: s.profile.name,
      profileEmail: s.profile.email,
      displayNamePreference: s.profile.displayNamePreference,
      workspaceName: s.workspace.name,
      members: s.workspace.members,
      workspaceId: s.workspaceId,
      userId: s.userId,
    })),
  );

  const inbox = useInbox(workspaceId, userId);
  const openCommandPalette = useOpenCommandPalette();

  const myUsername = members.find((m) => m.id === userId)?.username?.trim() ?? "";
  const displayName =
    displayNamePreference === "username" && myUsername
      ? `@${myUsername}`
      : profileName.trim() || profileEmail.split("@")[0] || tCommon("member");
  const initials = initialsFromFullName(profileName.trim() || profileEmail);
  const workspaceLabel = workspaceName || tCommon("workspaceFallback");
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
        "flex flex-col bg-paper px-3 py-3 transition-colors duration-150 ease-out",
        "lg:sticky lg:top-0 lg:z-10 lg:h-screen",
        collapsed ? "lg:w-[52px] lg:px-2 lg:py-3" : "lg:w-56 lg:px-3 lg:py-4",
      )}
    >
      {/* Header */}
      <div className={cn("mb-3 space-y-3 lg:mb-4", collapsed && "lg:space-y-2")}>
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            collapsed && "lg:flex-col lg:justify-start",
          )}
        >
          <ProjectSwitcher
            collapsed={collapsed}
            pathname={pathname}
            searchParams={searchParams}
            onNavigate={(href) => router.push(href)}
          />

          {/* Desktop: collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? tSide("expandSidebar") : tSide("collapseSidebar")}
            className={cn(
              "hidden size-8 items-center justify-center rounded-md text-ink-3 transition-colors lg:flex",
              "hover:bg-paper-3/80 hover:text-ink",
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
                aria-label={tSide("openCommandPalette")}
                className={cn(
                  "hidden size-8 w-full items-center justify-center rounded-md bg-paper-2 text-ink-3 transition-colors lg:flex",
                  "hover:bg-paper-3 hover:text-ink",
                  "focus-visible:ring-2 focus-visible:ring-mark/40",
                )}
              >
                <Search className="size-[1rem]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {tSide("searchShortcut")}
              <kbd className="ml-1.5 rounded bg-paper-3 px-1 py-0.5 font-mono text-[0.625rem]">
                ⌘K
              </kbd>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label={tSide("openCommandPalette")}
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md bg-paper-2 px-3 text-left outline-none transition-colors lg:min-h-8 lg:px-2.5",
              "hover:bg-paper-3",
              "focus-visible:ring-2 focus-visible:ring-mark/40",
            )}
          >
            <Search className="size-[1rem] shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-3">{tSide("searchOrJump")}</span>
            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
              <kbd className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                ⌘
              </kbd>
              <kbd className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                K
              </kbd>
            </span>
          </button>
        )}
      </div>

      {/* Navigation */}
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
                    aria-label={tNav(item.labelKey)}
                    className={cn(
                      "relative hidden size-8 items-center justify-center rounded-md transition-colors lg:flex",
                      isActive
                        ? "bg-paper-3 text-ink"
                        : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                    )}
                  >
                    <Icon className="size-[1.1rem]" />
                    {showInboxBadge && (
                      <span
                        aria-label={tSide("unreadBadge", { count: inbox.unreadCount })}
                        className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-mark px-1 text-[0.5625rem] font-semibold tabular-nums text-paper leading-none"
                      >
                        {inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-1.5">
                  {tNav(item.labelKey)}
                  <kbd className="rounded bg-paper-3 px-1 py-0.5 font-mono text-[0.625rem] text-ink-3">
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
                "group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[0.9375rem] transition-colors",
                "lg:flex lg:w-full lg:min-h-8 lg:gap-2 lg:px-2",
                "lg:text-[0.8125rem]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                isActive
                  ? "bg-paper-3 font-medium text-ink"
                  : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
              )}
            >
              <Icon className="size-[1.1rem] shrink-0" />
              <span className="flex-1">{tNav(item.labelKey)}</span>
              {showInboxBadge ? (
                <span
                  aria-label={tSide("unreadBadge", { count: inbox.unreadCount })}
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

      {/* Bottom section, desktop */}
      <div className="mt-auto hidden pt-6 lg:block">
        {collapsed ? (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ThemeToggleButton theme={theme} onToggle={toggleTheme} compact />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? tSide("lightMode") : tSide("darkMode")}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/account"
                    aria-label={tSide("accountAria", { name: displayName })}
                    aria-current={accountActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center size-9 rounded-md transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
                      accountActive
                        ? "bg-paper-3 text-ink"
                        : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
                    )}
                  >
                    <Avatar className="size-7">
                      <AvatarFallback
                        className={cn(
                          "text-[10px] font-medium text-ink",
                          accountActive ? "bg-paper-3" : "bg-paper-2",
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
                  aria-label={tSide("signOutAria")}
                  className={cn(
                    "mx-auto mt-3 flex items-center justify-center size-9 rounded-md text-ink-3 transition-colors",
                    "hover:bg-paper-3/80 hover:text-ink disabled:opacity-60",
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
              <TooltipContent side="right">{tSide("signOut")}</TooltipContent>
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
                  accountActive ? "bg-paper-3" : "hover:bg-paper-3/80",
                )}
              >
                <Avatar className="size-7">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-medium text-ink",
                      accountActive ? "bg-paper-3" : "bg-paper-2",
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
                "mt-2 flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-ink-3 transition-colors",
                "hover:bg-paper-3/80 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
              )}
            >
              {isSigningOut ? (
                <Loader2 className="size-[1.05rem] animate-spin" />
              ) : (
                <LogOut className="size-[1.05rem]" />
              )}
              <span>{isSigningOut ? tSide("signingOut") : tSide("signOut")}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function ProjectSwitcher({
  collapsed,
  pathname,
  searchParams,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  searchParams: { get: (name: string) => string | null; toString: () => string };
  onNavigate: (href: string) => void;
}) {
  const { projects, spaces, pins, workspaceName } = useCollabStore(
    useShallow((s) => ({
      workspaceName: s.workspace.name,
      projects: s.workspace.projects,
      spaces: s.workspace.spaces,
      pins: s.workspace.pins,
    })),
  );
  const { mutateAsync: createProject, isPending: isCreating } =
    useCreateProjectMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const spaceById = useMemo(
    () => new Map(spaces.map((space) => [space.id, space])),
    [spaces],
  );
  const projectStats = useMemo(() => {
    const map = new Map<string, { spaces: number; marks: number }>();
    for (const project of projects) map.set(project.id, { spaces: 0, marks: 0 });
    for (const space of spaces) {
      const stats = map.get(space.projectId);
      if (stats) stats.spaces += 1;
    }
    for (const pin of pins) {
      const projectId = spaceById.get(pin.spaceId)?.projectId;
      const stats = projectId ? map.get(projectId) : null;
      if (stats) stats.marks += 1;
    }
    return map;
  }, [pins, projects, spaceById, spaces]);

  const urlProjectId = searchParams.get("project");
  const urlSpaceId = searchParams.get("space");
  const selectedFromProject = projects.find((project) => project.id === urlProjectId);
  const selectedFromSpace = urlSpaceId
    ? projects.find((project) => project.id === spaceById.get(urlSpaceId)?.projectId)
    : null;
  const selectedProject = selectedFromProject ?? selectedFromSpace ?? projects[0] ?? null;
  const selectedProjectId = selectedProject?.id ?? null;
  const selectedStats = selectedProject ? projectStats.get(selectedProject.id) : null;
  const switcherLabel = selectedProject?.name ?? "No project";
  const switcherMeta = selectedProject
    ? `${selectedStats?.spaces ?? 0} spaces · ${selectedStats?.marks ?? 0} marks`
    : "Create a project to start";

  function hrefForProject(projectId: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    params.delete("space");
    params.delete("mark");
    params.delete("page");

    const base = pathname.startsWith("/spaces") || pathname.startsWith("/dashboard")
      ? pathname
      : "/dashboard";
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  function selectProject(projectId: string) {
    onNavigate(hrefForProject(projectId));
  }

  async function handleCreateProject() {
    if (!name.trim() || isCreating) return;
    setError(null);
    try {
      const project = await createProject({
        name,
        description,
      });
      setName("");
      setDescription("");
      setCreateOpen(false);
      onNavigate(`/spaces?project=${encodeURIComponent(project.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create this project.");
    }
  }

  return (
    <div className={cn("min-w-0 flex-1", collapsed && "lg:flex-none")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Switch project"
            className={cn(
              "group flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors",
              "hover:bg-paper-3/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40",
              "lg:min-h-10",
              collapsed && "lg:size-8 lg:min-h-0 lg:justify-center lg:px-0 lg:py-0",
            )}
          >
            <span
              className={cn(
                "pin-dot !size-7 shrink-0 !text-[0.5625rem] transition-transform group-hover:scale-[1.03]",
                collapsed && "lg:size-8",
              )}
              aria-hidden
            >
              Y
            </span>
            <span className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <span className="block truncate text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-3">
                Project
              </span>
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-ink">
                {switcherLabel}
              </span>
            </span>
            <ChevronsUpDown
              className={cn(
                "size-3.5 shrink-0 text-ink-3 transition-colors group-hover:text-ink-2",
                collapsed && "lg:hidden",
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={collapsed ? "right" : "bottom"}
          className="w-64"
        >
          <DropdownMenuLabel>
            <div className="flex min-w-0 flex-col">
              <span className="truncate">{workspaceName || "Workspace"}</span>
              <span className="truncate font-normal text-muted-foreground">
                {switcherMeta}
              </span>
            </div>
          </DropdownMenuLabel>
          {projects.map((project) => {
            const stats = projectStats.get(project.id);
            return (
              <DropdownMenuItem
                key={project.id}
                onClick={() => selectProject(project.id)}
              >
                <Check
                  className={cn(
                    "size-4",
                    selectedProjectId === project.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate">{project.name}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {stats?.spaces ?? 0} spaces · {stats?.marks ?? 0} marks
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setName("");
            setDescription("");
            setError(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,30rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Group spaces for one client, release, product area, or review stream.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid gap-4"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleCreateProject();
              }
            }}
          >
            <Field id="sidebar-project-name" label="Name">
              <Input
                id="sidebar-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Website QA"
                className="h-11 bg-paper text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
                autoFocus
              />
            </Field>
            <Field id="sidebar-project-description" label="Description">
              <Input
                id="sidebar-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this project is collecting"
                className="h-11 bg-paper text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
              />
            </Field>
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-mark/30 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
                className="h-11 sm:h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateProject}
                disabled={!name.trim() || isCreating}
                className="h-11 sm:h-9"
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
  const t = useTranslations("sidebar");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("openAccountMenu")}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full ring-2 ring-transparent transition-shadow",
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
            {t("accountSettings")}
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
          {isSigningOut ? t("accountSettingsSigningOut") : t("signOut")}
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
  const t = useTranslations("sidebar");
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? t("lightMode") : t("darkMode");
  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-2 transition-colors",
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
