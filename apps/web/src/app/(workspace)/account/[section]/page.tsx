import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAccountSection } from "@/lib/workspace/routes";

import { IntegrationsTab } from "../tabs/integrations-tab";
import { LabelsTab } from "../tabs/labels-tab";
import { ProfileTab } from "../tabs/profile-tab";
import { StatusesTab } from "../tabs/statuses-tab";
import { TeamTab } from "../tabs/team-tab";

const SECTION_TITLES: Record<string, string> = {
  team: "Team settings",
  integrations: "Integration settings",
  labels: "Label settings",
  statuses: "Workflow status settings",
  profile: "Profile settings",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return {
    title: SECTION_TITLES[section] ?? "Account settings",
  };
}

export default async function AccountSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isAccountSection(section) || section === "overview") {
    notFound();
  }

  if (section === "team") return <TeamTab />;
  if (section === "integrations") return <IntegrationsTab />;
  if (section === "labels") return <LabelsTab />;
  if (section === "statuses") return <StatusesTab />;
  if (section === "profile") return <ProfileTab />;

  notFound();
}
