import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountClient } from "../account-client";
import { isAccountSection } from "@/lib/workspace/routes";

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

  return <AccountClient section={section} />;
}
