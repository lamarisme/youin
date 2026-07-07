import "server-only";

import type { getDb } from "@/db/client";
import { backfillCanonicalInboxActivities } from "@/lib/workspace/inbox-backfill";

type AppDb = ReturnType<typeof getDb>;

export async function syncCanonicalInboxActivitiesForWorkspace({
  db,
  workspaceId,
}: {
  db: AppDb;
  workspaceId: string;
}): Promise<void> {
  await backfillCanonicalInboxActivities({
    db,
    workspaceId,
    dryRun: false,
  });
}
