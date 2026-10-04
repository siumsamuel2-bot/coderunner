# Coderunner Deployment

## Overview

Coderunner is a Next.js 16 (App Router) app deployed to **Railway.app** with a
Railway PostgreSQL database. Code lives on GitHub at
https://github.com/siumsamuel2-bot/coderunner (public) and every push to
`main` auto-deploys via the Railway GitHub integration.

- Production URL: https://coderunner-production-8e30.up.railway.app
- Repo: https://github.com/siumsamuel2-bot/coderunner

## Architecture

- **App**: Next.js 16, TypeScript (strict), App Router, Turbopack builds.
- **API**: tRPC v11 mounted at `/api/trpc/[trpc]` (fetchRequestHandler) plus
  REST routes under `/api/` (runs, verify, verification-updates SSE,
  verification-webhook, auth).
- **Auth**: Auth.js v5 (next-auth@5.0.0-beta) with a credentials email
  provider; JWT sessions.
- **DB**: PostgreSQL on Railway (injected `DATABASE_URL`), Prisma 7 client
  with `@prisma/adapter-pg`. Seeded with 5 challenges (calculator,
  todo-auth, pdf-analyzer, landing-page, chatbot).
- **Verification**: `@coderunner/verification-harness` vendored at
  `verification/` (Playwright-based). Runs via `scripts/verification-worker.ts`
  or the `/api/verify` + webhook flow.

## Environment variables

Set in the Railway project dashboard:

| Variable       | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string (auto-injected by plugin) |
| `AUTH_SECRET`  | NextAuth session encryption key (`openssl rand -base64 32`) |
| `AUTH_URL`     | Public app base URL                                  |

## Build & deploy

- **Local**: `npm install --legacy-peer-deps`, `npm run build`
  (`prisma generate && next build`), `npm start`.
- **CI**: `.github/workflows/ci.yml` — npm ci, prisma generate, typecheck,
  lint, build on every push/PR to `main`.
- **Deploy**: push to `main` → Railway auto-deploy. Manual fallback:
  `railway up` (requires Railway CLI auth).

## Monitoring

- **Upptime (GitHub Actions, SPE-91)**: `.github/workflows/uptime.yml` pings
  `/`, `/leaderboard`, and `/api/trpc/challenges.list` on a schedule and
  fails the run if any endpoint is not 200 (GitHub notifies on failure).
- **Board-side**: an UptimeRobot monitor also watches the production URL
  (configured by the board on 2026-10-04).
- **Keep-alive**: a 10-minute GitHub Actions ping prevents Railway free-tier
  cold starts; `src/lib/prisma.ts` additionally retries transient Prisma
  connection failures (P1001/P1002/ECONNREFUSED).

## Known limitations

- Railway free tier sleeps idle Postgres; first request after idle can be
  slow (connection retry wrapper in `src/lib/prisma.ts` covers this, and the
  keep-alive ping minimizes it).
