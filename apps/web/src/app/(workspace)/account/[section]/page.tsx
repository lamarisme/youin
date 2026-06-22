import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAccountSection } from "@/lib/workspace/routes";

import { IntegrationsTab } from "../tabs/integrations-tab";
import { DangerTab } from "../tabs/danger-tab";
import { LabelsTab } from "../tabs/labels-tab";
import { OverviewTab } from "../tabs/overview-tab";
import { ProfileTab } from "../tabs/profile-tab";
import { ProjectsTab } from "../tabs/projects-tab";
import { StatusesTab } from "../tabs/statuses-tab";
import { TeamTab } from "../tabs/team-tab";

const SECTION_TITLES: Record<string, string> = {
  overview: "Account settings",
  team: "Team settings",
  projects: "Project settings",
  integrations: "Integration settings",
  labels: "Label settings",
  statuses: "Workflow status settings",
  profile: "Profile settings",
  danger: "Danger Zone",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  if (!isAccountSection(section)) {
    return {
      title: "Page not found",
    };
  }

  return {
    title: SECTION_TITLES[section],
  };
}

export default async function AccountSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isAccountSection(section)) {
    notFound();
  }

  if (section === "overview") return <OverviewTab />;
  if (section === "team") return <TeamTab />;
  if (section === "projects") return <ProjectsTab />;
  if (section === "integrations") return <IntegrationsTab />;
  if (section === "labels") return <LabelsTab />;
  if (section === "statuses") return <StatusesTab />;
  if (section === "profile") return <ProfileTab />;
  if (section === "danger") return <DangerTab />;

  notFound();
}
