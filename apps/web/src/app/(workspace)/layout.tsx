import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { WorkspaceDataProvider } from "@/components/providers/workspace-data-provider";
import {
  getCurrentWorkspaceSession,
  getWorkspaceShellBootstrapForSession,
  type AuthenticatedWorkspaceSession,
} from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Workspace dashboard",
};

const DEFAULT_AFTER_SIGN_IN = "/dashboard";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const sessionResult = await getCurrentWorkspaceSession();

  if (sessionResult.status === "anonymous") {
    redirect(`/login?next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  if (sessionResult.status === "unresolved") {
    redirect(`/onboarding?next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  if (sessionResult.status === "incomplete") {
    redirect(`/auth/error?reason=incomplete&next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  return (
    <WorkspaceShellData session={sessionResult.session}>
      {children}
    </WorkspaceShellData>
  );
}

async function WorkspaceShellData({
  session,
  children,
}: {
  session: AuthenticatedWorkspaceSession;
  children: React.ReactNode;
}) {
  const bootstrapResult = await getWorkspaceShellBootstrapForSession(session);

  if (bootstrapResult.status === "incomplete") {
    redirect(`/auth/error?reason=incomplete&next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  return (
    <WorkspaceDataProvider bootstrap={bootstrapResult.bootstrap}>
      <AppShell>{children}</AppShell>
    </WorkspaceDataProvider>
  );
}
