"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Marks all migrations in drizzle/meta/_journal.json as applied without running SQL.
 *
 * Use when public schema already exists (Supabase bootstrap/setup) but Drizzle's ledger
 * is empty, so `pnpm db:migrate` fails with "type ... already exists".
 */

const fs = require("node:fs");
const path = require("node:path");
const postgres = require("postgres");

require("./load-env-files.cjs").loadEnvFiles();

const journalPath = path.join(__dirname, "..", "drizzle", "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const createdAt = Math.max(...journal.entries.map((e) => e.when));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Set it in .env.local or the environment.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

(async () => {
  try {
    const inserted = await sql`
      INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
      SELECT ${`baseline_${createdAt}`}, ${createdAt}
      WHERE NOT EXISTS (
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at >= ${createdAt}
      )
      RETURNING id`;

    if (inserted.length) {
      console.log(`Baselined migrations through journal max when=${createdAt}.`);
      console.log("Next: run `pnpm db:migrate`; pending migrations after this ledger entry will apply.");
    } else {
      console.log(`Ledger already has created_at ≥ ${createdAt}. Run \`pnpm db:migrate\` — it should skip or apply only newer files.`);
    }
  } catch (err) {
    console.error(err);
    console.error(`
If drizzle.__drizzle_migrations is missing: run \`pnpm db:migrate\` once (creates drizzle.*),
let it fail on duplicate objects, then run this script again.`);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
})();
