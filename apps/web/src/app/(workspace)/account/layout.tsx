import { AccountReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getAccountReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

import { AccountShell } from "./account-client";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const readModel = await getAccountReadModelForCurrentWorkspace();

  return (
    <AccountReadModelProvider initialData={readModel}>
      <AccountShell>{children}</AccountShell>
    </AccountReadModelProvider>
  );
}
