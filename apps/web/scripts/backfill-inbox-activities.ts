import { createRequire } from "node:module";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import { backfillCanonicalInboxActivities } from "../src/lib/workspace/inbox-backfill.ts";

const require = createRequire(import.meta.url);
require("./load-env-files.cjs").loadEnvFiles();

type CliOptions = {
  workspaceId?: string;
  dryRun: boolean;
  batchSize?: number;
};

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

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  try {
    const summary = await backfillCanonicalInboxActivities({
      db,
      workspaceId: options.workspaceId,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
