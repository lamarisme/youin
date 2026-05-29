import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { WorkspaceDataProvider } from "@/components/providers/workspace-data-provider";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceShellBootstrap } from "@/lib/workspace/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace dashboard",
};

const DEFAULT_AFTER_SIGN_IN = "/dashboard";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  const bootstrap = await getWorkspaceShellBootstrap();
  if (!bootstrap) {
    redirect(`/auth/error?reason=incomplete&next=${encodeURIComponent(DEFAULT_AFTER_SIGN_IN)}`);
  }

  return (
    <WorkspaceDataProvider bootstrap={bootstrap}>
      <AppShell>{children}</AppShell>
    </WorkspaceDataProvider>
  );
}
