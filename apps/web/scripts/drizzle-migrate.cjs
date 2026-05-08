"use strict";

/**
 * Runs Drizzle migrations against the configured DATABASE_URL using the
 * postgres-js driver with `prepare: false`.
 *
 * Why not `drizzle-kit migrate`?
 *   The default drizzle-kit migrator uses prepared statements, which the
 *   Supabase pooler (port 6543, transaction mode) refuses with ECONNREFUSED.
 *   Disabling prepared statements lets us reuse the same pooler URL we use
 *   from the app at runtime.
 */

const path = require("node:path");

require("./load-env-files.cjs").loadEnvFiles();

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing. Set it in .env.local or the environment.");
    process.exit(1);
  }

  const postgres = require("postgres");
  const { drizzle } = require("drizzle-orm/postgres-js");
  const { migrate } = require("drizzle-orm/postgres-js/migrator");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "..", "drizzle"),
    });
    console.log("Migrations applied.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    if (err.detail) console.error("detail:", err.detail);
    if (err.hint) console.error("hint:", err.hint);
    if (err.where) console.error("where:", err.where);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
})();
