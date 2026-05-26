"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Check,
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

import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { BrandLogo } from "@/components/brand-logo";
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
import { useWorkspaceData } from "@/lib/queries/use-workspace";
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

const SIDEBAR_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

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

  const { profileName, profileEmail, displayNamePreference, workspaceName, members, workspaceId, userId } =
    useWorkspaceData((s) => ({
      profileName: s.profile.name,
      profileEmail: s.profile.email,
      displayNamePreference: s.profile.displayNamePreference,
      workspaceName: s.workspace.name,
      members: s.workspace.members,
      workspaceId: s.workspaceId,
      userId: s.userId,
    }));

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
        "group/sidebar flex flex-col border-b border-rule bg-paper-2/95 px-2.5 py-2.5 transition-[background-color,width,padding] duration-200 ease-[var(--ease-out-quart)]",
        "lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:border-b-0 lg:border-r lg:border-rule/80 lg:bg-paper-2",
        collapsed ? "lg:w-[3.25rem] lg:px-2 lg:py-3" : "lg:w-60 lg:px-2.5 lg:py-3",
      )}
    >
      {/* Header */}
      <div className={cn("mb-2.5 space-y-2.5 lg:mb-3", collapsed && "lg:space-y-2")}>
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
              "hidden size-7 items-center justify-center rounded-md text-ink-3 transition-colors lg:flex",
              "hover:bg-paper-3/80 hover:text-ink",
              SIDEBAR_FOCUS,
              collapsed && "lg:mx-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[1.05rem]" />
            ) : (
              <PanelLeftClose className="size-[1.05rem]" />
            )}
          </button>

          {/* Mobile: avatar dropdown */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <MobileAccountMenu
              initials={initials}
              displayName={displayName}
              workspaceLabel={workspaceLabel}
              theme={theme}
              onToggleTheme={toggleTheme}
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
                  "hidden size-8 w-full items-center justify-center rounded-md bg-paper text-ink-3 ring-1 ring-rule/60 transition-colors lg:flex",
                  "hover:bg-paper-elevated hover:text-ink hover:ring-rule-strong/70",
                  SIDEBAR_FOCUS,
                )}
              >
                <Search className="size-[1rem]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {tSide("searchShortcut")}
              <kbd className="ml-1.5 rounded bg-paper-3 px-1 py-0.5 font-mono text-ui-2xs">
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
              "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md bg-paper px-3 text-left text-ink-3 ring-1 ring-rule/60 transition-colors lg:min-h-8 lg:px-2.5",
              "hover:bg-paper-elevated hover:text-ink-2 hover:ring-rule-strong/70",
              SIDEBAR_FOCUS,
            )}
          >
            <Search className="size-[1rem] shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ui-sm">{tSide("searchOrJump")}</span>
            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
              <kbd className="rounded-[4px] bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs text-ink-3">
                ⌘
              </kbd>
              <kbd className="rounded-[4px] bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs text-ink-3">
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
        <div
          className={cn(
            "hidden px-2 pb-1 pt-1 text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3 lg:block",
            collapsed && "lg:sr-only",
          )}
        >
          {tCommon("workspaceFallback")}
        </div>
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
                        ? "bg-paper text-ink"
                        : "text-ink-3 hover:bg-paper-3/80 hover:text-ink",
                      SIDEBAR_FOCUS,
                    )}
                  >
                    <Icon className="size-[1.1rem]" />
                    {showInboxBadge && (
                      <span
                        aria-label={tSide("unreadBadge", { count: inbox.unreadCount })}
                        className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-mark-soft px-1 text-ui-2xs font-semibold leading-none tabular-nums text-mark-ink ring-1 ring-mark/15"
                      >
                        {inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-1.5">
                  {tNav(item.labelKey)}
                  <kbd className="rounded bg-paper-3 px-1 py-0.5 font-mono text-ui-2xs text-ink-3">
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
                "group relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-ui-md transition-colors",
                "lg:flex lg:h-8 lg:w-full lg:min-h-0 lg:gap-2 lg:px-2.5 lg:py-0 lg:text-ui-sm",
                SIDEBAR_FOCUS,
                isActive
                  ? "bg-paper font-medium text-ink"
                  : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "size-[1rem] shrink-0 transition-colors",
                  isActive ? "text-ink" : "text-ink-3 group-hover:text-ink-2",
                )}
              />
              <span className="flex-1">{tNav(item.labelKey)}</span>
              {showInboxBadge ? (
                <span
                  aria-label={tSide("unreadBadge", { count: inbox.unreadCount })}
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-mark-soft px-1.5 text-ui-2xs font-semibold tabular-nums text-mark-ink ring-1 ring-mark/15"
                >
                  {inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}
                </span>
              ) : (
                <kbd className="hidden rounded-[4px] bg-paper-3/70 px-1 py-0.5 font-mono text-ui-2xs text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 lg:inline">
                  G {item.shortcut}
                </kbd>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section, desktop */}
      <div className="mt-auto hidden border-t border-rule/70 pt-2 lg:block">
        {collapsed ? (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <DesktopAccountMenu
                collapsed
                initials={initials}
                displayName={displayName}
                workspaceLabel={workspaceLabel}
                accountActive={accountActive}
                theme={theme}
                onToggleTheme={toggleTheme}
                isSigningOut={isSigningOut}
                onSignOut={handleSignOut}
              />
            </div>
          </>
        ) : (
          <DesktopAccountMenu
            initials={initials}
            displayName={displayName}
            workspaceLabel={workspaceLabel}
            accountActive={accountActive}
            theme={theme}
            onToggleTheme={toggleTheme}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
          />
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
  const { projects, spaces, marks, workspaceName } = useWorkspaceData((s) => ({
      workspaceName: s.workspace.name,
      projects: s.workspace.projects,
      spaces: s.workspace.spaces,
      marks: s.workspace.marks,
    }));
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
    for (const mark of marks) {
      const projectId = spaceById.get(mark.spaceId)?.projectId;
      const stats = projectId ? map.get(projectId) : null;
      if (stats) stats.marks += 1;
    }
    return map;
  }, [marks, projects, spaceById, spaces]);

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
              "group flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
              "hover:bg-paper-3/80",
              SIDEBAR_FOCUS,
              "lg:min-h-9",
              collapsed && "lg:size-8 lg:min-h-0 lg:justify-center lg:px-0 lg:py-0",
            )}
          >
            <BrandLogo
              className={cn(
                "size-8 transition-transform group-hover:scale-[1.03] lg:size-7",
                collapsed && "lg:size-8",
              )}
            />
            <span className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <span className="block truncate text-ui-sm font-medium leading-tight text-ink">
                {switcherLabel}
              </span>
              <span className="block truncate text-ui-xs leading-tight text-ink-3">
                {switcherMeta}
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
          <DropdownMenuLabel className="truncate">
            {workspaceName || "Workspace"}
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
                  <p className="text-ui-xs text-muted-foreground">
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
                className="h-11 bg-paper text-ui-lg sm:h-9 sm:text-ui-sm"
                autoFocus
              />
            </Field>
            <Field id="sidebar-project-description" label="Description">
              <Input
                id="sidebar-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this project is collecting"
                className="h-11 bg-paper text-ui-lg sm:h-9 sm:text-ui-sm"
              />
            </Field>
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-mark/30 bg-mark-soft px-3 py-2 text-ui-xs text-mark"
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
  theme,
  onToggleTheme,
  isSigningOut,
  onSignOut,
}: {
  initials: string;
  displayName: string;
  workspaceLabel: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
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
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md ring-2 ring-transparent transition-shadow",
            "hover:bg-paper-3/80 hover:ring-mark/20",
            "focus-visible:outline-none focus-visible:ring-focus-ring",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <AccountMenuContent
          displayName={displayName}
          workspaceLabel={workspaceLabel}
          theme={theme}
          onToggleTheme={onToggleTheme}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopAccountMenu({
  initials,
  displayName,
  workspaceLabel,
  accountActive,
  theme,
  onToggleTheme,
  isSigningOut,
  onSignOut,
  collapsed = false,
}: {
  initials: string;
  displayName: string;
  workspaceLabel: string;
  accountActive: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isSigningOut: boolean;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  const t = useTranslations("sidebar");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button
            type="button"
            aria-label={t("openAccountMenu")}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors",
              SIDEBAR_FOCUS,
              accountActive
                ? "bg-paper text-ink"
                : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
            )}
          >
            <Avatar className="size-6">
              <AvatarFallback
                className={cn(
                  "text-ui-2xs font-medium text-ink",
                  accountActive ? "bg-paper-elevated" : "bg-paper",
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("openAccountMenu")}
            className={cn(
              "group flex h-9 w-full items-center gap-2 rounded-md px-2 text-left transition-colors",
              SIDEBAR_FOCUS,
              accountActive ? "bg-paper" : "hover:bg-paper-3/80",
            )}
          >
            <Avatar className="size-6">
              <AvatarFallback
                className={cn(
                  "text-ui-2xs font-medium text-ink",
                  accountActive ? "bg-paper-elevated" : "bg-paper",
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui-sm font-medium leading-tight text-ink">{displayName}</p>
              <p className="truncate text-ui-xs leading-tight text-ink-3">{workspaceLabel}</p>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "center" : "start"} side={collapsed ? "right" : "top"} className="w-56">
        <AccountMenuContent
          displayName={displayName}
          workspaceLabel={workspaceLabel}
          theme={theme}
          onToggleTheme={onToggleTheme}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenuContent({
  displayName,
  workspaceLabel,
  theme,
  onToggleTheme,
  isSigningOut,
  onSignOut,
}: {
  displayName: string;
  workspaceLabel: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isSigningOut: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("sidebar");
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? t("lightMode") : t("darkMode");
  return (
    <>
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
      <DropdownMenuItem onClick={onToggleTheme}>
        <ThemeIcon className="size-4" />
        {themeLabel}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onSignOut} disabled={isSigningOut}>
        {isSigningOut ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        {isSigningOut ? t("accountSettingsSigningOut") : t("signOut")}
      </DropdownMenuItem>
    </>
  );
}
