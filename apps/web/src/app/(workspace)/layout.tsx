import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { WorkspaceDataProvider } from "@/components/providers/workspace-data-provider";
import { getCurrentWorkspaceShellBootstrap } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Workspace dashboard",
};

const DEFAULT_AFTER_SIGN_IN = "/dashboard";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const bootstrapResult = await getCurrentWorkspaceShellBootstrap();

  if (bootstrapResult.status === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  if (bootstrapResult.status === "unresolved") {
    redirect(`/onboarding?next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  if (bootstrapResult.status === "incomplete") {
    redirect(`/auth/error?reason=incomplete&next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  return (
    <WorkspaceDataProvider bootstrap={bootstrapResult.bootstrap}>
      <AppShell>{children}</AppShell>
    </WorkspaceDataProvider>
  );
}
