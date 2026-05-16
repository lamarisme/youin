import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountClient } from "../account-client";
import { isAccountSection } from "@/lib/workspace/routes";

export const metadata: Metadata = {
  title: "Account",
};

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
