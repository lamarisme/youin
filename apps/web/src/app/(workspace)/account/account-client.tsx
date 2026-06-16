"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  BadgeCheck,
  Blocks,
  Tags,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";
import { accountHref, type AccountSection } from "@/lib/workspace/routes";

export function AccountShell({ children }: { children: ReactNode }) {
  const { memberCount, labelCount, reviewLinkCount, statusCount } = useWorkspaceData((s) => ({
    memberCount: s.workspace.members.length,
    labelCount: s.workspace.labels.length,
    reviewLinkCount: s.workspace.reviewLinks.length,
    statusCount: s.workspace.workflowStatuses.length,
  }));
  const selectedSegment = useSelectedLayoutSegment();
  const activeSection = (selectedSegment ?? "overview") as AccountSection;

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
      detail: "Identity and defaults",
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
      detail: "Capture entry points",
      icon: Blocks,
      count: reviewLinkCount,
    },
    {
      value: "labels",
      label: "Labels",
      detail: "Tag vocabulary",
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
      detail: "Display identity",
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
        subtitle="Manage workspace access, capture paths, taxonomy, workflow, and your profile."
      />

      <div className="grid gap-5 lg:grid-cols-[13.5rem_minmax(0,58rem)] lg:items-start lg:gap-8 xl:grid-cols-[14rem_minmax(0,62rem)]">
        <nav
          aria-label="Account sections"
          className="-mx-3 border-y border-rule/70 bg-paper-2/70 px-3 py-2 sm:-mx-4 sm:px-4 lg:sticky lg:top-4 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
        >
          <div className="hidden px-1 pb-2 lg:block">
            <p className="text-ui-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
              Sections
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:min-w-0 lg:flex-col lg:gap-1.5">
            {sections.map((section) => {
              const active = section.value === activeSection;
              const Icon = section.icon;
              return (
                <Link
                  key={section.value}
                  href={accountHref(section.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 w-full shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left transition-[background-color,color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                    "lg:min-h-12 lg:px-2.5",
                    active
                      ? "bg-paper-elevated text-ink ring-1 ring-rule/60"
                      : "text-ink-2 hover:bg-paper-2/80 hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-3 text-ink-3 transition-colors",
                      active
                        ? "bg-mark-soft/80 text-mark"
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
                        active ? "text-mark-ink" : "text-ink-3",
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
          className="min-w-0 lg:border-l lg:border-rule/70 lg:pl-8"
        >
          {children}
        </section>
      </div>
    </PageContainer>
  );
}
