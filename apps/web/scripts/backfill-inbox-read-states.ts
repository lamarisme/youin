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

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  try {
    const summary = await backfillInboxActivityReadStatesFromLegacyTimestamps({
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
