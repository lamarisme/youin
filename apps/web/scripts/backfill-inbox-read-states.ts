import { createRequire } from "node:module";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import { backfillInboxActivityReadStatesFromLegacyTimestamps } from "../src/lib/workspace/inbox-read-state.ts";

const require = createRequire(import.meta.url);
require("./load-env-files.cjs").loadEnvFiles();

type CliOptions = {
  dryRun: boolean;
  workspaceId?: string;
  batchSize?: number;
};

const REQUIRED_TABLES = [
  "inbox_read_states",
  "inbox_activities",
  "inbox_activity_read_states",
] as const;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
      const parsed = Number(argv[index + 1]);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--batch-size must be a positive number.");
      }
      options.batchSize = Math.floor(parsed);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--") continue;
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp(): void {
  console.log(`Backfill canonical Inbox read states from legacy inbox_read_states.

Usage:
  pnpm --filter @youin/web run inbox:backfill-read-states -- [options]

Options:
  --dry-run             Count matching rows without inserting read states. Default.
  --apply               Insert missing inbox_activity_read_states rows.
  --workspace-id <id>   Limit backfill to one workspace.
  --batch-size <n>      Insert rows in batches. Default: 500.
  -h, --help            Show this help message.
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
    printStart("Inbox read-state backfill", options, databaseUrl, warnings);
    await assertRequiredTables(sql, REQUIRED_TABLES);

    const summary = await backfillInboxActivityReadStatesFromLegacyTimestamps({
      db,
      workspaceId: options.workspaceId,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
    });

    printSummary({
      title: "Inbox read-state backfill",
      elapsedMs: Date.now() - startedAt,
      warnings,
      summary,
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
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
        `Missing required Inbox read-state backfill table(s): ${missing.join(", ")}.`,
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
  summary: Awaited<ReturnType<typeof backfillInboxActivityReadStatesFromLegacyTimestamps>>;
}): void {
  console.log(`${title} completed.`);
  console.log(`Activities scanned: ${summary.activitiesMatched}`);
  console.log(`Activities projected: ${summary.activitiesMatched}`);
  console.log(`Legacy read states scanned: ${summary.legacyStatesScanned}`);
  console.log(`Inserted rows: ${summary.readStatesInserted}`);
  console.log(`Duplicate rows skipped: ${summary.duplicatesSkipped}`);
  console.log(`Skipped rows: 0`);
  console.log(`Elapsed time: ${formatDuration(elapsedMs)}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Final status: ${summary.dryRun ? "DRY_RUN_COMPLETE" : "APPLY_COMPLETE"}`);
  console.log(
    JSON.stringify(
      {
        ...summary,
        elapsedMs,
        skippedRows: 0,
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
