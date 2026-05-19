import "server-only";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
  drizzleDb?: PostgresJsDatabase<typeof schema>;
};

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Add it to apps/web/.env.local before using Drizzle.",
    );
  }
  return connectionString;
}

export function getPostgresClient(): postgres.Sql {
  if (globalForDb.postgresClient) return globalForDb.postgresClient;
  const client = postgres(getConnectionString(), {
    prepare: false,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.postgresClient = client;
  }
  return client;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;
  const db = drizzle(getPostgresClient(), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.drizzleDb = db;
  }
  return db;
}
