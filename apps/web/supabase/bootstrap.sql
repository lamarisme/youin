/*
  Database bootstrap — youin

  SCHEMA (PUBLIC DDL: tables, enums, indexes, FKs between public tables)
  ────────────────────────────────────────────────────────────────────────────
  Single source of truth: ../src/db/schema.ts

  Apply migrations (DATABASE_URL loaded from `.env.local` / `.env` via drizzle.config.ts):

    cd apps/web
    pnpm db:migrate

  Existing Supabase DB with tables already applied outside Drizzle?

    pnpm db:baseline && pnpm db:migrate

  Generate new migrations after editing schema.ts:

    pnpm db:generate

  SUPABASE-ONLY SURFACE (triggers on auth/mark rows, profiles↔Auth FK,
  RLS, storage bucket, SECURITY DEFINER RPCs)
  ────────────────────────────────────────────────────────────────────────────
    1. supabase/setup.sql     — run entire file after Drizzle migrations
    2. supabase/onboarding-rpcs.sql — run after setup.sql

  The previous monolithic DDL in this file has been retired; Drizzle migrations
  plus setup.sql/onboarding-rpcs.sql replace it without duplicating table defs.
*/
