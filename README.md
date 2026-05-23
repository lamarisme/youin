# Youin

Youin is a visual feedback layer for the live web. The product pairs a Next.js web app with a Chrome extension so teams can capture page context, leave element-level comments, and turn review feedback into workspace items.

## Repository

This is a pnpm monorepo.

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js app for auth, workspaces, dashboards, inbox, spaces, account settings, and the extension OAuth bridge. |
| `apps/extension` | Plasmo Chrome extension for review mode, capture, badges, sync, and local-to-Supabase migration. |
| `packages/design-tokens` | Shared design tokens consumed by the web app and extension. |
| `packages/domain` | Shared domain models, validation, and tests. |
| `packages/i18n` | Shared messages and lightweight translation helpers. |

## Requirements

- Node.js `>=22 <23`
- pnpm `10.28.2` through Corepack
- Access to the Supabase project values for local development
- Chrome or Chromium for extension work

## First-Time Setup

```bash
git clone https://github.com/lamarisme/youin.git
cd youin
corepack enable
pnpm install
```

Create local environment files from the examples:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env
```

Fill those files with development Supabase values. Do not commit `apps/web/.env.local`, `apps/extension/.env`, database passwords, service-role keys, or personal access tokens.

## Running Locally

Run the web app:

```bash
pnpm dev:web
```

Open `http://localhost:3000`.

Run the Chrome extension:

```bash
pnpm dev:extension
```

Load `apps/extension/build/chrome-mv3-dev` from `chrome://extensions` with Developer Mode enabled. Keep the web app running when testing extension sign-in because the extension uses `PLASMO_PUBLIC_WEB_APP_URL` for the OAuth bridge.

## Common Commands

```bash
pnpm build:tokens
pnpm --filter @youin/domain typecheck
pnpm --filter @youin/domain test
pnpm --filter @youin/web lint
pnpm --filter @youin/web test
pnpm build:web
pnpm build:extension
pnpm package:extension
```

Use the narrowest command that covers your change while iterating, then run the relevant lint, test, and build commands before opening a pull request.

## Database

The web app uses Supabase Postgres with Drizzle.

```bash
pnpm --filter @youin/web db:generate
pnpm --filter @youin/web db:migrate
pnpm --filter @youin/web db:studio
```

Schema lives in `apps/web/src/db/schema.ts`. Supabase setup and row-level security policy SQL lives in `apps/web/supabase/setup.sql`. Treat migrations and policy changes as production-impacting changes: describe them clearly in the pull request and test them against a development database first.

## Contribution Flow

Do not commit directly to the default branch. In this checkout the default branch is `main`; if the GitHub repository is configured with `master`, apply the same rule there.

```bash
git checkout main
git pull --ff-only
git checkout -b contributor/name-of-change
```

Keep pull requests small enough to review. Every PR should include:

- What changed and why
- Screenshots or recordings for UI changes
- Any database or environment variable changes
- The commands run locally

Preferred branch names:

- `feature/short-description`
- `fix/short-description`
- `docs/short-description`
- `chore/short-description`

## Review Rules

- Work lands through pull requests only.
- At least one project owner reviews before merge.
- The contributor should not merge their own PR.
- The protected default branch should reject direct pushes.
- Squash merge is preferred unless a PR needs to preserve a carefully structured commit history.

## GitHub Access Checklist

For a new contributor, choose the smallest access level that lets them work:

- Use a fork-based workflow if they only need to submit occasional PRs.
- Use repository `Write` access if they should push feature branches directly to this repo.
- Do not grant `Admin` or `Maintain` access unless they need repository settings access.

Before giving `Write` access, protect the default branch:

1. In GitHub, open the repository settings.
2. Go to Rules > Rulesets or Branches > Branch protection rules.
3. Target the default branch, currently `main` in this checkout. If the remote default branch is `master`, target `master`.
4. Require a pull request before merging.
5. Require at least one approving review.
6. Require conversation resolution before merging.
7. Require status checks once CI is available.
8. Restrict direct pushes to the branch, and do not add the contributor to the bypass or push-allow list.
9. Disable force pushes and branch deletion.
10. Save the rule, then test it by confirming the contributor can push a feature branch but cannot push directly to the protected branch.

## App Notes

See the app-specific READMEs for deeper setup:

- `apps/web/README.md`
- `apps/extension/README.md`
