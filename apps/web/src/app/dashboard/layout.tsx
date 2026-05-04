import { redirect } from "next/navigation";

import { WorkspaceDataProvider } from "@/components/providers/workspace-data-provider";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBootstrap } from "@/lib/workspace/workspace-actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent("/dashboard?space=all")}`);
  }

  const bootstrap = await getWorkspaceBootstrap();
  if (!bootstrap) {
    redirect(`/auth/error?reason=incomplete&next=${encodeURIComponent("/dashboard?space=all")}`);
  }

  return <WorkspaceDataProvider bootstrap={bootstrap}>{children}</WorkspaceDataProvider>;
}
