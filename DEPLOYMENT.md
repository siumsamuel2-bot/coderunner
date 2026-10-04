# Coderunner — Deployment

Production is hosted on **Railway.app** (free tier, project token auth).

## URLs

| Thing | Value |
| --- | --- |
| App | https://coderunner-production-8e30.up.railway.app |
| Railway project | `upbeat-mindfulness` (id `b73b3a31-6980-45c3-b0c2-f503576f8ad0`) — reused existing free-plan project |
| App service | `coderunner` (id `9af323a7-8ec9-4204-a8da-7d869b96c09b`) |
| DB service | `Postgres` (id `9a7869ec-7109-4154-b770-e2eaa47357b6`) |
| Environment | `production` (id `0b0e2a31-1025-4953-9534-8e578f3c738d`) |

## Database

- Railway PostgreSQL plugin (Postgres 18), private host `postgres.railway.internal:5432`, db `railway`.
- `DATABASE_URL` on the app service points at the private host. Public access via TCP proxy (`RAILWAY_TCP_PROXY_DOMAIN`) for local `prisma db push` / seed.
- Prisma 7 with the `@prisma/adapter-pg` driver adapter (`src/lib/prisma.ts`). Schema: `prisma/schema.prisma`. Seed: `npm run db:seed`.

## Environment variables (app service)

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | `postgresql://...@postgres.railway.internal:5432/railway` |
| `AUTH_SECRET` | generated (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://coderunner-production-8e30.up.railway.app` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | **TODO** — OAuth apps not yet created (board); login page renders but sign-in will fail until set |

## Build & deploy

- Build: `npm run build` → `prisma generate && next build` (Railpack).
- Start: `next start` (Railway injects `PORT`).
- Manual deploy from the durable copy (`data\coderunner-rebuild\coderunner`):
  ```
  $env:RAILWAY_TOKEN = '<project token>'
  npx -y @railway/cli@latest up --service coderunner
  ```
- Auth: board's Railway **account** token does not satisfy the CLI login path — use a **project token** minted via GraphQL `projectTokenCreate` against the project id above.

## Known caveats

- **Free plan forces app sleep.** First request after idle cold-starts (~30–60s) and may 500 once while Postgres wakes; retry succeeds. Always-on requires the Hobby plan.
- Custom domain: not yet configured (no domain provided by board).
- Monitoring: not yet configured — Upptime/Better Uptime both need the GitHub repo (SPE-48) or a board account. Recommend Upptime once the repo exists.
- GitHub repo / auto-deploy: pending SPE-48 (no GitHub credentials on this machine).

## Durable copy & milestones

Source of truth until the GitHub repo exists: `data\coderunner-rebuild\coderunner` (git). Milestone tarballs in `data\coderunner-milestones\`.
