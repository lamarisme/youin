"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useCollabStore } from "@/lib/collab-store";

import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";

import { OverviewTab } from "./tabs/overview-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { LabelsTab } from "./tabs/labels-tab";
import { TeamTab } from "./tabs/team-tab";

const ACCOUNT_SECTIONS = ["overview", "team", "labels", "profile"] as const;
type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

function isAccountSection(value: string | null): value is AccountSection {
  return ACCOUNT_SECTIONS.includes(value as AccountSection);
}

function accountHref(section: AccountSection) {
  return section === "overview" ? "/account" : `/account?tab=${section}`;
}

export function AccountClient() {
  const searchParams = useSearchParams();
  const memberCount = useCollabStore((s) => s.workspace.members.length);
  const labelCount = useCollabStore((s) => s.workspace.labels.length);
  const requestedTab = searchParams.get("tab");
  const activeSection: AccountSection = isAccountSection(requestedTab)
    ? requestedTab
    : "overview";

  const sections: Array<{
    value: AccountSection;
    label: string;
    detail: string;
    count?: number;
  }> = [
    { value: "overview", label: "Overview", detail: "Workspace and security" },
    { value: "team", label: "Team", detail: "Members and invites", count: memberCount },
    { value: "labels", label: "Labels", detail: "Mark taxonomy", count: labelCount },
    { value: "profile", label: "Profile", detail: "Your display identity" },
  ];

  return (
    <PageContainer className="space-y-5">
      <AppHeader title="Account" eyebrow="Settings" />

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav
          aria-label="Account sections"
          className="-mx-1 flex gap-1 overflow-x-auto border-b border-rule pb-2 lg:mx-0 lg:block lg:space-y-1 lg:border-b-0 lg:pb-0"
        >
          {sections.map((section) => {
            const active = section.value === activeSection;
            return (
              <Link
                key={section.value}
                href={accountHref(section.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
                  "lg:min-h-8 lg:w-full lg:px-2.5 lg:py-1.5",
                  active
                    ? "bg-paper-3 text-ink"
                    : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-medium">
                    {section.label}
                  </span>
                  <span className="hidden truncate text-[0.6875rem] text-ink-3 lg:block">
                    {section.detail}
                  </span>
                </span>
                {typeof section.count === "number" ? (
                  <span
                    className={cn(
                      "rounded bg-paper px-1.5 py-px font-mono text-[0.625rem] tabular-nums",
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
          {activeSection === "labels" ? <LabelsTab /> : null}
          {activeSection === "profile" ? <ProfileTab /> : null}
        </section>
      </div>
    </PageContainer>
  );
}
