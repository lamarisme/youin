import "server-only";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export function revalidateWorkspaceViews(): void {
  revalidatePath("/dashboard");
  revalidatePath("/spaces");
  revalidatePath("/account");
}

export async function requireSession(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  const workspaceId = await ensureWorkspaceForUser(supabase, user);
  return { supabase, userId: user.id, workspaceId };
}
