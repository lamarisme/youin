"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Blocks,
  Tags,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";
import { accountHref, type AccountSection } from "@/lib/workspace/routes";

import { OverviewTab } from "./tabs/overview-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { LabelsTab } from "./tabs/labels-tab";
import { IntegrationsTab } from "./tabs/integrations-tab";
import { StatusesTab } from "./tabs/statuses-tab";
import { TeamTab } from "./tabs/team-tab";

export function AccountClient({ section = null }: { section?: string | null }) {
  const { memberCount, labelCount, reviewLinkCount, statusCount } = useWorkspaceData((s) => ({
    memberCount: s.workspace.members.length,
    labelCount: s.workspace.labels.length,
    reviewLinkCount: s.workspace.reviewLinks.length,
    statusCount: s.workspace.workflowStatuses.length,
  }));
  const activeSection = (section ?? "overview") as AccountSection;

  const sections: Array<{
    value: AccountSection;
    label: string;
    detail: string;
    icon: LucideIcon;
    count?: number;
  }> = [
    {
      value: "overview",
      label: "Overview",
      detail: "Workspace and security",
      icon: BadgeCheck,
    },
    {
      value: "team",
      label: "Team",
      detail: "Members and invites",
      icon: UsersRound,
      count: memberCount,
    },
    {
      value: "integrations",
      label: "Integrations",
      detail: "Extension and app installs",
      icon: Blocks,
      count: reviewLinkCount,
    },
    {
      value: "labels",
      label: "Labels",
      detail: "Mark taxonomy",
      icon: Tags,
      count: labelCount,
    },
    {
      value: "statuses",
      label: "Statuses",
      detail: "Workflow stages",
      icon: Workflow,
      count: statusCount,
    },
    {
      value: "profile",
      label: "Profile",
      detail: "Your display identity",
      icon: UserRound,
    },
  ];
  const activeSectionMeta =
    sections.find((section) => section.value === activeSection) ?? sections[0];

  return (
    <PageContainer>
      <AppHeader
        title="Account settings"
        eyebrow="Settings"
        subtitle="Team access, integrations, labels, workflow statuses, and profile."
      />

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,56rem)] lg:items-start lg:gap-7">
        <nav
          aria-label="Account sections"
          className="-mx-3 overflow-x-auto border-y border-rule/70 bg-paper-2/70 px-3 py-2 sm:-mx-4 sm:px-4 lg:sticky lg:top-4 lg:mx-0 lg:overflow-visible lg:rounded-lg lg:border lg:bg-paper-elevated lg:p-1.5"
        >
          <div className="hidden px-2 pb-2 pt-1 lg:block">
            <p className="text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
              Settings
            </p>
          </div>
          <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
            {sections.map((section) => {
              const active = section.value === activeSection;
              const Icon = section.icon;
              return (
                <Link
                  key={section.value}
                  href={accountHref(section.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 w-full shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                    "lg:min-h-12 lg:px-2.5",
                    active
                      ? "bg-paper text-ink shadow-hairline ring-1 ring-rule/70"
                      : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-3 text-ink-3 transition-colors",
                      active
                        ? "bg-mark-soft text-mark"
                        : "group-hover:text-ink-2",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui-sm font-medium">
                      {section.label}
                    </span>
                    <span className="hidden truncate text-ui-xs leading-snug text-ink-3 lg:block">
                      {section.detail}
                    </span>
                  </span>
                  {typeof section.count === "number" ? (
                    <span
                      className={cn(
                        "rounded bg-paper-3 px-1.5 py-px font-mono text-ui-2xs tabular-nums",
                        active ? "text-mark" : "text-ink-3",
                      )}
                    >
                      {section.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <section
          aria-label={`${activeSectionMeta.label} settings`}
          className="min-w-0 lg:border-l lg:border-rule/70 lg:pl-7"
        >
          {activeSection === "overview" ? <OverviewTab /> : null}
          {activeSection === "team" ? <TeamTab /> : null}
          {activeSection === "integrations" ? <IntegrationsTab /> : null}
          {activeSection === "labels" ? <LabelsTab /> : null}
          {activeSection === "statuses" ? <StatusesTab /> : null}
          {activeSection === "profile" ? <ProfileTab /> : null}
        </section>
      </div>
    </PageContainer>
  );
}
