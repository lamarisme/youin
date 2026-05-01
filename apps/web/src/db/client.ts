import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL. Add it to apps/web/.env.local before using Drizzle.",
  );
}

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
};

const client =
  globalForDb.postgresClient ??
  postgres(connectionString, {
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });

export { client as postgresClient };
