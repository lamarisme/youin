import "server-only";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
  drizzleDb?: PostgresJsDatabase<typeof schema>;
};

const DEFAULT_POOL_MAX = 5;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;
const DEFAULT_MAX_LIFETIME_SECONDS = 60 * 30;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;
const DEFAULT_APPLICATION_NAME = "youin-web";

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Add it to apps/web/.env.local before using Drizzle.",
    );
  }
  return connectionString;
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function getStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function getPostgresClient(): postgres.Sql {
  if (globalForDb.postgresClient) return globalForDb.postgresClient;
  const client = postgres(getConnectionString(), {
    connection: {
      application_name: getStringEnv(
        "DATABASE_APPLICATION_NAME",
        DEFAULT_APPLICATION_NAME,
      ),
    },
    connect_timeout: getPositiveIntegerEnv(
      "DATABASE_CONNECT_TIMEOUT_SECONDS",
      DEFAULT_CONNECT_TIMEOUT_SECONDS,
    ),
    idle_timeout: getPositiveIntegerEnv(
      "DATABASE_IDLE_TIMEOUT_SECONDS",
      DEFAULT_IDLE_TIMEOUT_SECONDS,
    ),
    max: getPositiveIntegerEnv("DATABASE_POOL_MAX", DEFAULT_POOL_MAX),
    max_lifetime: getPositiveIntegerEnv(
      "DATABASE_MAX_LIFETIME_SECONDS",
      DEFAULT_MAX_LIFETIME_SECONDS,
    ),
    prepare: false,
  });
  globalForDb.postgresClient = client;
  return client;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;
  const db = drizzle(getPostgresClient(), { schema });
  globalForDb.drizzleDb = db;
  return db;
}
