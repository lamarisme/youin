import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { resolveWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export const dynamic = "force-dynamic";

type ExtensionContextAuthResult =
  | { error: NextResponse }
  | { supabase: SupabaseClient; user: User; workspaceId: string };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: CORS_HEADERS },
  );
}

async function createAuthorizedClient(
  request: NextRequest,
): Promise<ExtensionContextAuthResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { error: jsonError("Missing bearer token.", 401) };
  }

  const { url, key } = getSupabaseEnv();
  const supabase = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: jsonError("Unauthorized.", 401) };

  try {
    const workspaceId = await resolveWorkspaceForUser(supabase, user);
    if (!workspaceId) {
      return {
        error: jsonError("Complete onboarding in YouIn before using the extension.", 409),
      };
    }
    return { supabase, user, workspaceId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not resolve workspace.";
    return { error: jsonError(message, 400) };
  }
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, workspaceId } = auth;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError) return jsonError(workspaceError.message, 400);
  if (!workspace) return jsonError("Workspace was not found.", 404);

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id,name,description,created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (projectsError) return jsonError(projectsError.message, 400);

  const { data: views, error: viewsError } = await supabase
    .from("workspace_views")
    .select("id,name,filters")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (viewsError) return jsonError(viewsError.message, 400);

  return NextResponse.json(
    {
      workspace: {
        id: workspaceId,
        name: String(workspace.name ?? "Workspace"),
      },
      projects: (projects ?? []).map((project) => ({
        id: project.id as string,
        name: String(project.name ?? "General"),
        description: String(project.description ?? ""),
        createdAt: (project.created_at as string | null) ?? null,
      })),
      views: (views ?? []).map((view) => ({
        id: view.id as string,
        name: String(view.name ?? "View"),
        filters: view.filters ?? {},
      })),
    },
    { headers: CORS_HEADERS },
  );
}
