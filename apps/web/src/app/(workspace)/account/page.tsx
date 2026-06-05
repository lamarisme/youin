import type { Metadata } from "next";

import { AccountClient } from "./account-client";
import { AccountReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getAccountReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Account settings",
};

export default async function AccountPage() {
  const readModel = await getAccountReadModelForCurrentWorkspace();

  return (
    <AccountReadModelProvider initialData={readModel}>
      <AccountClient />
    </AccountReadModelProvider>
  );
}

