import { redirect } from "next/navigation";

import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import { safeLocalRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  discoverPendingWorkspaceInvitesAction,
} from "@/lib/workspace/actions";
import { resolveWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

import { OnboardingClient } from "./onboarding-client";

function workspaceNameFromEmail(email: string): string {
  const domain = email.split("@")[1]?.split(".")[0] ?? "";
  if (
    !domain ||
    ["gmail", "icloud", "outlook", "hotmail", "yahoo", "proton"].includes(
      domain,
    )
  ) {
    return "My workspace";
  }
  return `${domain.charAt(0).toUpperCase()}${domain.slice(1)} workspace`;
}

function onboardingDefaults(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata ?? {};
  const workspaceName =
    typeof meta.workspace_name === "string" && meta.workspace_name.trim()
      ? meta.workspace_name.trim()
      : workspaceNameFromEmail(user.email ?? "");
  const projectName =
    typeof meta.first_project_name === "string" && meta.first_project_name.trim()
      ? meta.first_project_name.trim()
      : "General";

  return { workspaceName, projectName };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = pageSearchParamsToUrlSearchParams(await searchParams);
  const nextPath = safeLocalRedirectPath(params.get("next"), "/dashboard");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const workspaceId = await resolveWorkspaceForUser(supabase, user);
  if (workspaceId) {
    redirect(nextPath);
  }

  const invites = await discoverPendingWorkspaceInvitesAction();
  const defaults = onboardingDefaults(user);

  return (
    <OnboardingClient
      defaultProjectName={defaults.projectName}
      defaultWorkspaceName={defaults.workspaceName}
      invites={invites}
      nextPath={nextPath}
    />
  );
}
