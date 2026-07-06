"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronsUpDown,
  CircleDashed,
  Folder,
  Inbox as InboxIcon,
  Loader2,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useInbox } from "@/app/(workspace)/inbox/use-inbox";
import { WorkspaceViewIcon } from "@/app/(workspace)/views/view-ui";
import { BrandLogo } from "@/components/brand-logo";
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
import { Kbd } from "@/components/ui/kbd";
import type { WorkspaceView } from "@/lib/collab-types";
import { useWorkspaceUiStore } from "@/lib/collab-store";
import { isOptimisticId } from "@/lib/optimistic-id";
import { PRODUCT_SHORTCUT_IDS } from "@/lib/product-shortcuts";
import { updatedAtFromIso } from "@/lib/queries/cache-policy";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { useSwitchWorkspaceMutation } from "@/lib/queries/use-workspace-mutations";
import { createClient } from "@/lib/supabase/client";
import { useProductShortcutFormatter } from "@/lib/use-product-shortcuts";
import { cn } from "@/lib/utils";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { projectMarkCountsFromMarks } from "@/lib/workspace/read-model-mappers";
import {
  accountHref,
  dashboardHref,
  dashboardScopeFromPathname,
} from "@/lib/workspace/routes";

const SIDEBAR_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export function AppSidebar() {
  const tNav = useTranslations("nav");
  const tSide = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const formatProductShortcut = useProductShortcutFormatter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const collapsed = useWorkspaceUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useWorkspaceUiStore(
    (state) => state.toggleSidebarCollapsed,
  );
  const navigateFromSidebar = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.origin);
      const nextHref = `${target.pathname}${target.search}${target.hash}`;

      if (pathname === "/dashboard" && target.pathname === "/dashboard") {
        window.history.pushState(null, "", nextHref);
        return;
      }

      router.push(nextHref);
    },
    [pathname, router],
  );

  const {
    profileName,
    profileEmail,
    displayNamePreference,
    workspaceName,
    members,
    workspaceId,
    userId,
    views,
    inboxSnapshot,
    loadedAt,
  } = useWorkspaceData((s) => ({
    profileName: s.profile.name,
    profileEmail: s.profile.email,
    displayNamePreference: s.profile.displayNamePreference,
    workspaceName: s.workspace.name,
    members: s.workspace.members,
    views: s.workspace.views,
    workspaceId: s.workspaceId,
    userId: s.userId,
    inboxSnapshot: s.inboxSnapshot,
    loadedAt: s.loadedAt,
  }));

  const inbox = useInbox(
    workspaceId,
    userId,
    inboxSnapshot,
    updatedAtFromIso(loadedAt),
  );
  const openCommandPalette = useOpenCommandPalette();

  const myUsername = members.find((m) => m.id === userId)?.username?.trim() ?? "";
  const displayName =
    displayNamePreference === "username" && myUsername
      ? `@${myUsername}`
      : profileName.trim() || profileEmail.split("@")[0] || tCommon("member");
  const initials = initialsFromFullName(profileName.trim() || profileEmail);
  const workspaceLabel = workspaceName || tCommon("workspaceFallback");
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");
  const commandPaletteShortcut = formatProductShortcut(
    PRODUCT_SHORTCUT_IDS.openCommandPalette,
  );
  const myMarksHref = useMemo(() => {
    return dashboardHref(searchParams, { kind: "mine" }, { resetPage: true });
  }, [searchParams]);
  const myMarksActive = pathname === "/dashboard/mine" || pathname.startsWith("/dashboard/mine/");

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      queryClient.clear();
      useWorkspaceUiStore.getState().clearOptimisticWorkspace();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <aside
      className={cn(
        "group/sidebar flex flex-col bg-paper-2/95 px-2.5 py-2.5 transition-colors duration-200 ease-[var(--ease-out-quart)]",
        "lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:bg-paper-2",
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
            onNavigate={navigateFromSidebar}
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
              <Kbd className="ml-1.5">{commandPaletteShortcut}</Kbd>
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
            <span className="min-w-0 flex-1 truncate text-ui-sm lg:text-ui-xs">{tSide("searchOrJump")}</span>
            <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
              <Kbd>{commandPaletteShortcut}</Kbd>
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
        aria-label="Primary"
      >
        <SidebarNavLink
          href="/inbox"
          label={tNav("inbox")}
          icon={InboxIcon}
          shortcutLabel={formatProductShortcut(PRODUCT_SHORTCUT_IDS.navigateInbox)}
          active={pathname === "/inbox" || pathname.startsWith("/inbox/")}
          collapsed={collapsed}
          badgeCount={inbox.unreadCount}
          badgeLabel={tSide("unreadBadge", { count: inbox.unreadCount })}
        />
        <SidebarNavLink
          href={myMarksHref}
          label={tNav("myMarks")}
          icon={CircleDashed}
          shortcutLabel={formatProductShortcut(PRODUCT_SHORTCUT_IDS.navigateMyMarks)}
          active={myMarksActive}
          collapsed={collapsed}
          onNavigate={navigateFromSidebar}
        />
      </nav>

      <SidebarViewsSection
        views={views.filter((view) => !isOptimisticId(view.id))}
        pathname={pathname}
        collapsed={collapsed}
      />

      {/* Bottom section, desktop */}
      <div className="mt-auto hidden pt-2 lg:block">
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

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  shortcutLabel,
  active,
  collapsed,
  badgeCount = 0,
  badgeLabel,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcutLabel?: string;
  active: boolean;
  collapsed: boolean;
  badgeCount?: number;
  badgeLabel?: string;
  onNavigate?: (href: string) => void;
}) {
  const showBadge = badgeCount > 0;
  const handleClick = onNavigate
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey
        ) {
          return;
        }
        event.preventDefault();
        onNavigate(href);
      }
    : undefined;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            prefetch={true}
            onClick={handleClick}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "relative hidden size-8 items-center justify-center rounded-md transition-colors lg:flex",
              active ? "bg-paper text-ink" : "text-ink-3 hover:bg-paper-3/80 hover:text-ink",
              SIDEBAR_FOCUS,
            )}
          >
            <Icon className="size-[1.1rem]" />
            {showBadge ? <SidebarBadge count={badgeCount} label={badgeLabel} compact /> : null}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-1.5">
          {label}
          {shortcutLabel ? (
            <Kbd>{shortcutLabel}</Kbd>
          ) : null}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-ui-md transition-colors",
        "lg:flex lg:h-8 lg:w-full lg:min-h-0 lg:gap-2 lg:px-2.5 lg:py-0 lg:text-ui-xs",
        SIDEBAR_FOCUS,
        active ? "bg-paper font-medium text-ink" : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
      )}
    >
      <Icon
        className={cn(
          "size-[1rem] shrink-0 transition-colors",
          active ? "text-ink" : "text-ink-3 group-hover:text-ink-2",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showBadge ? (
        <SidebarBadge count={badgeCount} label={badgeLabel} />
      ) : shortcutLabel ? (
        <Kbd className="hidden bg-paper-3/70 px-1 opacity-0 transition-opacity group-hover:opacity-100 lg:inline-flex">
          {shortcutLabel}
        </Kbd>
      ) : null}
    </Link>
  );
}

function SidebarBadge({
  count,
  label,
  compact = false,
}: {
  count: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-mark-soft text-ui-2xs font-semibold leading-none tabular-nums text-mark-ink ring-1 ring-mark/15",
        compact
          ? "absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1"
          : "min-w-[1.25rem] px-1.5 py-0.5",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarViewsSection({
  views,
  pathname,
  collapsed,
}: {
  views: WorkspaceView[];
  pathname: string;
  collapsed: boolean;
}) {
  const hasViews = views.length > 0;
  const actionLabel = hasViews ? "Manage views" : "Create view";

  return (
    <section
      className={cn(
        "mt-3 hidden min-h-0 flex-1 overflow-y-auto lg:block",
        collapsed && "lg:flex-none lg:overflow-visible",
      )}
      aria-label="Views"
    >
      {collapsed ? (
        <div className="space-y-0.5">
          <p className="sr-only">Views</p>
          {views.map((view) => (
            <SidebarViewIconLink
              key={view.id}
              view={view}
              active={pathname === `/views/${view.id}`}
            />
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/views"
                prefetch={true}
                aria-label={actionLabel}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3/80 hover:text-ink",
                  pathname === "/views" && "bg-paper text-ink",
                  SIDEBAR_FOCUS,
                )}
              >
                <Plus className="size-[1rem]" aria-hidden />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{actionLabel}</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <div className="flex h-8 items-center justify-between px-2">
            <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
              Views
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/views"
                  prefetch={true}
                  aria-label={actionLabel}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3/80 hover:text-ink",
                    SIDEBAR_FOCUS,
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent>{actionLabel}</TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-0.5">
            {hasViews ? (
              views.map((view) => (
                <SidebarViewLink
                  key={view.id}
                  view={view}
                  active={pathname === `/views/${view.id}`}
                />
              ))
            ) : (
              <Link
                href="/views"
                prefetch={true}
                className={cn(
                  "group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-ui-sm text-ink-3 transition-colors hover:bg-paper-3/80 hover:text-ink",
                  SIDEBAR_FOCUS,
                )}
              >
                <Plus className="size-[1.05rem] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">Create view</span>
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SidebarViewIconLink({
  view,
  active,
}: {
  view: WorkspaceView;
  active: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/views/${view.id}`}
          prefetch={true}
          aria-current={active ? "page" : undefined}
          aria-label={view.name}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            active ? "bg-paper text-ink" : "text-ink-3 hover:bg-paper-3/80 hover:text-ink",
            SIDEBAR_FOCUS,
          )}
        >
          <WorkspaceViewIcon view={view} className="size-[1rem]" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{view.name}</TooltipContent>
    </Tooltip>
  );
}

function SidebarViewLink({
  view,
  active,
}: {
  view: WorkspaceView;
  active: boolean;
}) {
  return (
    <Link
      href={`/views/${view.id}`}
      prefetch={true}
      aria-current={active ? "page" : undefined}
      title={view.name}
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-ui-sm transition-colors",
        active ? "bg-paper font-medium text-ink" : "text-ink-2 hover:bg-paper-3/80 hover:text-ink",
        SIDEBAR_FOCUS,
      )}
    >
      <WorkspaceViewIcon
        view={view}
        className={cn(
          "size-[1.05rem] shrink-0 transition-colors",
          active ? "text-ink" : "text-ink-3 group-hover:text-ink-2",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{view.name}</span>
    </Link>
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
  const { projects, marks, workspaceName, workspaceId, workspaceMemberships } =
    useWorkspaceData((s) => ({
      workspaceName: s.workspace.name,
      workspaceId: s.workspaceId,
      workspaceMemberships: s.workspaceMemberships,
      projects: s.workspace.projects,
      marks: s.workspace.marks,
    }));
  const { mutate: switchWorkspace, isPending: isSwitchingWorkspace } =
    useSwitchWorkspaceMutation();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);

  const projectStats = useMemo(() => {
    const counts = projectMarkCountsFromMarks(projects, marks);
    return new Map(
      Array.from(counts, ([projectId, markCount]) => [
        projectId,
        { marks: markCount },
      ]),
    );
  }, [marks, projects]);
  const workspaceNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workspace of workspaceMemberships) {
      counts.set(workspace.name, (counts.get(workspace.name) ?? 0) + 1);
    }
    return counts;
  }, [workspaceMemberships]);

  const navigableProjects = projects.filter((project) => !isOptimisticId(project.id));
  const routeScope = dashboardScopeFromPathname(pathname);
  const urlProjectId = routeScope.kind === "project" ? routeScope.projectId : null;
  const selectedProject =
    navigableProjects.find((project) => project.id === urlProjectId) ?? null;
  const selectedProjectId = selectedProject?.id ?? null;
  const totalMarks = navigableProjects.reduce(
    (sum, project) => sum + (projectStats.get(project.id)?.marks ?? 0),
    0,
  );
  const switcherLabel = workspaceName || "Workspace";
  const switcherMeta = selectedProject
    ? selectedProject.name
    : navigableProjects.length
      ? "All projects"
      : "Set up projects";

  function hrefForProject(projectId: string): string {
    return dashboardHref(searchParams, { kind: "project", projectId }, { resetPage: true });
  }

  function hrefForAllProjects(): string {
    return dashboardHref(searchParams, { kind: "all" }, { resetPage: true });
  }

  function selectProject(projectId: string) {
    onNavigate(hrefForProject(projectId));
  }

  function selectAllProjects() {
    onNavigate(hrefForAllProjects());
  }

  function selectWorkspace(nextWorkspaceId: string) {
    if (nextWorkspaceId === workspaceId || isSwitchingWorkspace) return;
    setSwitchingWorkspaceId(nextWorkspaceId);
    switchWorkspace(nextWorkspaceId, {
      onSettled: () => setSwitchingWorkspaceId(null),
    });
  }

  function workspaceMeta(
    workspace: (typeof workspaceMemberships)[number],
    active: boolean,
  ) {
    const hasDuplicateName = (workspaceNameCounts.get(workspace.name) ?? 0) > 1;
    const memberLabel = `${workspace.memberCount} member${
      workspace.memberCount === 1 ? "" : "s"
    }`;
    const parts = [workspace.role === "owner" ? "Owner" : "Member"];

    if (!hasDuplicateName) parts.push(memberLabel);

    if (active) parts.push("Current");
    if (hasDuplicateName) {
      parts.push(`ID ${workspace.id.slice(0, 8)}`);
    }

    return parts.join(" · ");
  }

  return (
    <div className={cn("min-w-0 flex-1", collapsed && "lg:flex-none")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Switch workspace or project"
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
              <span className="block truncate text-ui-sm font-medium leading-tight text-ink lg:text-ui-xs">
                {switcherLabel}
              </span>
              <span className="block truncate text-ui-xs leading-tight text-ink-3 lg:text-ui-2xs">
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
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaceMemberships.map((workspace) => {
            const active = workspace.id === workspaceId;
            const switching =
              isSwitchingWorkspace && switchingWorkspaceId === workspace.id;
            const meta = workspaceMeta(workspace, active);
            return (
              <DropdownMenuItem
                key={workspace.id}
                aria-current={active ? "true" : undefined}
                disabled={!active && isSwitchingWorkspace}
                onSelect={(event) => {
                  if (active) {
                    event.preventDefault();
                    return;
                  }
                  selectWorkspace(workspace.id);
                }}
                className={cn(
                  "items-start gap-2 py-1.5",
                  active && "bg-paper-2 text-ink",
                )}
              >
                {switching ? (
                  <Loader2 className="mt-0.5 size-4 animate-spin" />
                ) : (
                  <Check
                    className={cn(
                      "mt-0.5 size-4",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{workspace.name}</p>
                  <p className="text-ui-xs text-muted-foreground">
                    {meta}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="truncate">
            Projects in {workspaceName || "workspace"}
          </DropdownMenuLabel>
          {navigableProjects.length ? (
            <DropdownMenuItem onClick={selectAllProjects}>
              <Check
                className={cn(
                  "size-4",
                  selectedProjectId === null ? "opacity-100" : "opacity-0",
                )}
              />
              <div className="min-w-0">
                <p className="truncate">All projects</p>
                <p className="text-ui-xs text-muted-foreground">
                  {totalMarks} mark{totalMarks === 1 ? "" : "s"}
                </p>
              </div>
            </DropdownMenuItem>
          ) : null}
          {navigableProjects.map((project) => {
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
                    {stats?.marks ?? 0} mark{(stats?.marks ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={accountHref("projects")} prefetch={true}>
              <Folder className="size-4" />
              Manage projects
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
            "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md ring-2 ring-transparent transition-shadow",
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
              <p className="truncate text-ui-xs font-medium leading-tight text-ink">{displayName}</p>
              <p className="truncate text-ui-2xs leading-tight text-ink-3">{workspaceLabel}</p>
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
        <Link href="/account" prefetch={true}>
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
