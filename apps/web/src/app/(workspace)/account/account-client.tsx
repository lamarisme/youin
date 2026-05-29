"use client";

import Link from "next/link";

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
    count?: number;
  }> = [
    { value: "overview", label: "Overview", detail: "Workspace and security" },
    { value: "team", label: "Team", detail: "Members and invites", count: memberCount },
    {
      value: "integrations",
      label: "Integrations",
      detail: "Extension and app installs",
      count: reviewLinkCount,
    },
    { value: "labels", label: "Labels", detail: "Mark taxonomy", count: labelCount },
    { value: "statuses", label: "Statuses", detail: "Workflow stages", count: statusCount },
    { value: "profile", label: "Profile", detail: "Your display identity" },
  ];

  return (
    <PageContainer>
      <AppHeader
        title="Account settings"
        eyebrow="Settings"
        subtitle="Team access, integrations, labels, workflow statuses, and profile."
      />

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,52rem)] lg:gap-8">
        <nav
          aria-label="Account sections"
          className="-mx-1 flex gap-1 overflow-x-auto rounded-md bg-paper-2 p-1 lg:mx-0 lg:block lg:space-y-1"
        >
          {sections.map((section) => {
            const active = section.value === activeSection;
            return (
              <Link
                key={section.value}
                href={accountHref(section.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
                  "lg:min-h-8 lg:w-full lg:px-2.5 lg:py-1.5",
                  active
                    ? "bg-paper-3 text-ink"
                    : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-ui-sm font-medium">
                    {section.label}
                  </span>
                  <span className="hidden truncate text-ui-xs text-ink-3 lg:block">
                    {section.detail}
                  </span>
                </span>
                {typeof section.count === "number" ? (
                  <span
                    className={cn(
                      "rounded bg-paper-3 px-1.5 py-px font-mono text-ui-2xs tabular-nums",
                      active ? "text-ink-2" : "text-ink-3",
                    )}
                  >
                    {section.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <section className="min-w-0">
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
