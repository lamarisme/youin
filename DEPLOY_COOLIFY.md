# Deploying the web app on Coolify with Nixpacks

This repository is a pnpm monorepo. Deploy the repository root, not `apps/web`, so Nixpacks can install the workspace packages used by the Next.js app.

## Coolify settings

Create a new application from the Git repository and use these settings:

- Build Pack: `Nixpacks`
- Base Directory: `/`
- Install Command: leave empty, or use `pnpm install --frozen-lockfile`
- Build Command: leave empty, or use `pnpm build:tokens && pnpm build:web`
- Start Command: leave empty, or use `pnpm start:web`
- Port: `3000`

The committed `nixpacks.toml` already defines the install, build, and start commands, so the Coolify command fields can stay empty unless you want to override them in the UI.

## Environment variables

Add these variables in Coolify before the first deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_ANON_KEY
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
DATABASE_APPLICATION_NAME=youin-web
DATABASE_POOL_MAX=1
DATABASE_IDLE_TIMEOUT_SECONDS=60
DATABASE_MAX_LIFETIME_SECONDS=1800
DATABASE_CONNECT_TIMEOUT_SECONDS=10
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also supported by the app and can be used instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Use Supabase's session pooler URL for app runtime traffic in Coolify's persistent
Node server. The Drizzle client disables prepared statements for pooler
compatibility and keeps one postgres.js connection per app process by default;
increase `DATABASE_POOL_MAX` only after checking Supabase pooler client usage.

## Database migrations

Run migrations once before routing production traffic, and again whenever new migration files are added:

```bash
pnpm --filter @youin/web db:migrate
```

In Coolify, this can be run from the application terminal after deployment, or from your machine with the production `DATABASE_URL` exported locally.

## Notes

- Keep `pnpm-lock.yaml` committed. Do not commit npm `package-lock.json` files for this project.
- The web app uses Next.js standalone output so container builds trace the monorepo workspace correctly.
- If Coolify asks for a domain, add your production domain and enable HTTPS after the first healthy deployment.
