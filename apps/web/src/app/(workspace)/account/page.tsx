import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountClient } from "./account-client";
import { accountHref, isAccountSection } from "@/lib/workspace/routes";

export const metadata: Metadata = {
  title: "Account settings",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  if (isAccountSection(tab)) {
    redirect(accountHref(tab));
  }

  return <AccountClient />;
}
