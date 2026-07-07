import { createRequire } from "node:module";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import {
  backfillCanonicalInboxActivities,
  type InboxActivityBackfillSummary,
} from "../src/lib/workspace/inbox-backfill.ts";

const require = createRequire(import.meta.url);
require("./load-env-files.cjs").loadEnvFiles();

type BackfillDb = Parameters<typeof backfillCanonicalInboxActivities>[0]["db"];

type CliOptions = {
  workspaceId?: string;
  dryRun: boolean;
  batchSize?: number;
};

const REQUIRED_TABLES = [
  "marks",
  "mark_comments",
  "mark_events",
  "mentions",
  "workspace_invites",
  "inbox_activities",
] as const;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: true };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--apply") {
      options.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--workspace-id") {
      options.workspaceId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--batch-size") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) options.batchSize = parsed;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage(): void {
  console.log(`
Backfill canonical Inbox activities in shadow mode.

Usage:
  pnpm inbox:backfill -- --dry-run
  pnpm inbox:backfill -- --apply
  pnpm inbox:backfill -- --workspace-id <uuid> --apply

Options:
  --dry-run              Project activities without inserting rows. Default.
  --apply                Insert projected rows with onConflictDoNothing().
  --workspace-id <uuid>  Limit the backfill to one workspace.
  --batch-size <number>  Insert batch size. Default: 500.
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in .env.local or the environment.");
  }

  const startedAt = Date.now();
  const warnings = buildWarnings(options, databaseUrl);
  const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
  const db = drizzle(sql, { schema });

  try {
    printStart("Inbox activity backfill", options, databaseUrl, warnings);
    await assertRequiredTables(sql, REQUIRED_TABLES);
    console.log("Schema preflight: passed.");

    const summary = await runBackfill({
      db,
      sqlClient: sql,
      options,
    });

    printSummary({
      title: "Inbox activity backfill",
      elapsedMs: Date.now() - startedAt,
      warnings,
      summary,
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function runBackfill({
  db,
  sqlClient,
  options,
}: {
  db: BackfillDb;
  sqlClient: ReturnType<typeof postgres>;
  options: CliOptions;
}): Promise<InboxActivityBackfillSummary> {
  if (options.workspaceId) {
    return backfillCanonicalInboxActivities({
      db,
      workspaceId: options.workspaceId,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
    });
  }

  console.log("Loading source workspaces for all-workspace backfill.");
  const workspaceIds = await loadBackfillWorkspaceIds(sqlClient);
  console.log(`Source workspaces discovered: ${workspaceIds.length}`);
  if (workspaceIds.length === 0) {
    return emptySummary(options);
  }

  const summaries: InboxActivityBackfillSummary[] = [];
  for (const [index, workspaceId] of workspaceIds.entries()) {
    console.log(`Processing workspace ${index + 1}/${workspaceIds.length}: ${workspaceId}`);
    summaries.push(
      await backfillCanonicalInboxActivities({
        db,
        workspaceId,
        dryRun: options.dryRun,
        batchSize: options.batchSize,
      }),
    );
  }

  return combineSummaries(options, summaries);
}

async function loadBackfillWorkspaceIds(sqlClient: ReturnType<typeof postgres>): Promise<string[]> {
  const rows = await sqlClient`
    SELECT DISTINCT workspace_id
    FROM (
      SELECT workspace_id FROM public.mark_events
      UNION
      SELECT workspace_id FROM public.mentions
      UNION
      SELECT workspace_id FROM public.workspace_invites WHERE status = 'accepted'
    ) source_workspaces
    ORDER BY workspace_id
  `;

  return rows.map((row) => String(row.workspace_id)).filter(Boolean);
}

function emptySummary(options: CliOptions): InboxActivityBackfillSummary {
  return {
    dryRun: options.dryRun,
    workspaceId: null,
    markEventsScanned: 0,
    mentionsScanned: 0,
    acceptedInvitesScanned: 0,
    activitiesProjected: 0,
    activitiesInserted: 0,
    duplicatesSkipped: 0,
    skipped: {
      unmapped_event_type: 0,
      missing_required_context: 0,
      self_authored: 0,
      no_recipients: 0,
    },
  };
}

function combineSummaries(
  options: CliOptions,
  summaries: InboxActivityBackfillSummary[],
): InboxActivityBackfillSummary {
  return summaries.reduce<InboxActivityBackfillSummary>(
    (combined, summary) => ({
      dryRun: options.dryRun,
      workspaceId: null,
      markEventsScanned: combined.markEventsScanned + summary.markEventsScanned,
      mentionsScanned: combined.mentionsScanned + summary.mentionsScanned,
      acceptedInvitesScanned: combined.acceptedInvitesScanned + summary.acceptedInvitesScanned,
      activitiesProjected: combined.activitiesProjected + summary.activitiesProjected,
      activitiesInserted: combined.activitiesInserted + summary.activitiesInserted,
      duplicatesSkipped: combined.duplicatesSkipped + summary.duplicatesSkipped,
      skipped: {
        unmapped_event_type:
          combined.skipped.unmapped_event_type + summary.skipped.unmapped_event_type,
        missing_required_context:
          combined.skipped.missing_required_context + summary.skipped.missing_required_context,
        self_authored: combined.skipped.self_authored + summary.skipped.self_authored,
        no_recipients: combined.skipped.no_recipients + summary.skipped.no_recipients,
      },
    }),
    emptySummary(options),
  );
}

main().catch((error: unknown) => {
  console.error("Final status: FAILED");
  console.error(formatError(error));
  process.exitCode = 1;
});

async function assertRequiredTables(
  sqlClient: ReturnType<typeof postgres>,
  tableNames: readonly string[],
): Promise<void> {
  const missing: string[] = [];
  for (const tableName of tableNames) {
    const rows = await sqlClient`
      SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS exists
    `;
    if (!rows[0]?.exists) missing.push(tableName);
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing required Inbox backfill table(s): ${missing.join(", ")}.`,
        "Run database migrations before executing this backfill.",
      ].join(" "),
    );
  }
}

function buildWarnings(options: CliOptions, databaseUrl: string): string[] {
  const warnings: string[] = [];
  if (!options.workspaceId) {
    warnings.push("No --workspace-id provided; this run scans every workspace.");
  }
  if (!options.dryRun && !isLocalDatabaseUrl(databaseUrl)) {
    warnings.push("Applying against a non-local DATABASE_URL. Confirm this is the intended QA target.");
  }
  return warnings;
}

function printStart(
  title: string,
  options: CliOptions,
  databaseUrl: string,
  warnings: string[],
): void {
  console.log(`${title} starting.`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "apply"}`);
  console.log(`Workspace: ${options.workspaceId ?? "all workspaces"}`);
  console.log(`Batch size: ${options.batchSize ?? 500}`);
  console.log(`Database: ${describeDatabaseUrl(databaseUrl)}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function printSummary({
  title,
  elapsedMs,
  warnings,
  summary,
}: {
  title: string;
  elapsedMs: number;
  warnings: string[];
  summary: Awaited<ReturnType<typeof backfillCanonicalInboxActivities>>;
}): void {
  console.log(`${title} completed.`);
  console.log(`Activities scanned: ${summary.markEventsScanned + summary.mentionsScanned + summary.acceptedInvitesScanned}`);
  console.log(`Mark events scanned: ${summary.markEventsScanned}`);
  console.log(`Mentions scanned: ${summary.mentionsScanned}`);
  console.log(`Accepted invites scanned: ${summary.acceptedInvitesScanned}`);
  console.log(`Activities projected: ${summary.activitiesProjected}`);
  console.log(`Inserted rows: ${summary.activitiesInserted}`);
  console.log(`Duplicate rows skipped: ${summary.duplicatesSkipped}`);
  console.log(`Skipped rows: ${Object.values(summary.skipped).reduce((total, value) => total + value, 0)}`);
  console.log(`Elapsed time: ${formatDuration(elapsedMs)}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Final status: ${summary.dryRun ? "DRY_RUN_COMPLETE" : "APPLY_COMPLETE"}`);
  console.log(
    JSON.stringify(
      {
        ...summary,
        elapsedMs,
        warnings,
        finalStatus: summary.dryRun ? "DRY_RUN_COMPLETE" : "APPLY_COMPLETE",
      },
      null,
      2,
    ),
  );
}

function describeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    const databaseName = url.pathname.replace(/^\//, "") || "postgres";
    return `${url.hostname}:${url.port || "default"}/${databaseName}`;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.stack || error.name;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
