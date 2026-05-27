# Youin Web App

The web app is a Next.js App Router application for the Youin dashboard, auth flows, workspace management, and the Chrome extension OAuth bridge.

## Local Setup

From the repository root:

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Set these variables in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
```

Use development credentials only. Do not commit local environment files or database passwords.

## Run

```bash
pnpm dev:web
```

Open `http://localhost:3000`.

You can also run commands from this folder:

```bash
pnpm dev
pnpm build
pnpm start
```

## Scripts

```bash
pnpm --filter @youin/web lint
pnpm --filter @youin/web test
pnpm --filter @youin/web build
pnpm --filter @youin/web db:generate
pnpm --filter @youin/web db:migrate
pnpm --filter @youin/web db:studio
```

Run `lint`, `test`, and `build` before asking for review on web app changes. For database changes, include the generated migration and explain the rollout impact in the PR.

## Structure

| Path | Purpose |
| --- | --- |
| `src/app` | App Router routes, layouts, loading states, error states, and route handlers. |
| `src/app/(workspace)` | Authenticated product surfaces: dashboard, inbox, spaces, views, and account. |
| `src/app/auth/extension-bridge` | Bridge page used by the Chrome extension to complete Supabase auth. |
| `src/components` | Shared UI and product components. |
| `src/db` | Drizzle client and schema. |
| `src/lib/supabase` | Supabase browser and server helpers. |
| `src/lib/workspace` | Workspace queries and server actions. |
| `supabase/setup.sql` | Supabase schema setup, policies, and RLS rules. |
| `drizzle` | Generated Drizzle migrations. |

## Development Notes

- This app uses Next.js 16. Check `apps/web/AGENTS.md` before changing framework-specific behavior.
- Server actions that read or write workspace data should use the existing session and workspace authorization helpers.
- Keep shared domain logic in `packages/domain` when it is used by both the web app and extension.
- Keep visible UI copy in sync with `packages/i18n` when a string is shared.
- Prefer targeted tests for domain and data behavior, then browser-check the full flow for UI changes.

## Extension Integration

The extension expects the web app to be reachable at the URL configured by `PLASMO_PUBLIC_WEB_APP_URL`, usually `http://localhost:3000`. When testing extension auth locally, run the web app and extension together.
