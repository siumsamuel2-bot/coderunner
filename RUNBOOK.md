# Coderunner Incident Runbook (SPE-99)

Production: https://coderunner-production-8e30.up.railway.app
Escalation: Engineer-1 → CTO (Paperclip).

## Monitoring stack

| Layer | Tool | Where to look |
| --- | --- | --- |
| Errors (web + server) | Sentry (free tier) | Sentry project dashboard; release tagged with `RAILWAY_GIT_COMMIT_SHA` |
| APM / traces | Sentry Performance (10% sampling) + Railway built-in metrics | Sentry "Performance", Railway project → Metrics |
| Uptime | Upptime (`.github/workflows/uptime.yml`) + board UptimeRobot | GitHub Actions failures open issues; status history in `history/` |
| DB health | `/api/health` (200 = OK, 503 = DB down) + Railway Postgres metrics | Upptime "API Health" check, Railway dashboard |
| Deploys | Railway GitHub integration | Railway deploy logs |

Alert thresholds are configured in Sentry alert rules and Upptime:

- **Error rate > 1%** of events over 5 min → Sentry alert (web + server).
- **P95 latency > 2s** over 15 min → Sentry Performance alert.
- **Any critical endpoint down** (`/`, `/leaderboard`, `/login`, `/api/health`) → Upptime issue + GitHub notification.
- **DB connection failures / pool exhaustion** → `/api/health` returns 503 → Upptime alert; also visible as repeated `P1001/P1002` retry logs in Railway logs.
- **Stale verification jobs** (`pending`/`processing` > 15 min, SPE-89 lock wedge) → visible in `/api/health` `verification.staleJobs`; Sentry tag `source=trpc` on queue errors.
- **Failed deploy** → Railway notification + Upptime starts failing.

## Common incidents

### 1. Endpoint down (Upptime alert fires)

1. Open Railway dashboard → deploy logs. Look for crash loop or OOM.
2. Free-tier cold start: first hit after idle can 502. Verify keep-alive
   workflow (`.github/workflows/uptime.yml` 10-min ping) is enabled.
3. If deploy is broken, revert the offending commit (`git revert` + push) —
   Railway auto-redeploys.

### 2. `/api/health` returns 503 (DB unreachable)

1. Railway free-tier Postgres sleeps on idle; the Prisma retry wrapper
   (`src/lib/prisma.ts`, P1001/P1002/ECONN*) should ride it out (up to ~7s +
   120s connect timeout).
2. Check Railway Postgres service status/metrics. Restart the service if wedged.
3. Check `max: 3` pool size isn't exhausted by a hot loop in Railway logs.

### 3. Stale verification jobs (`staleJobs > 0`)

Symptom of an abandoned run holding the `executionRunId` lock (SPE-89).

1. Query stuck jobs:
   ```sql
   SELECT id, "runId", status, "updatedAt" FROM "VerificationJob"
   WHERE status IN ('pending','processing') AND "updatedAt" < now() - interval '15 minutes';
   ```
2. Confirm the owning run is not actively being verified.
3. Reset: `UPDATE "VerificationJob" SET status='failed', error='stale-cleared', "updatedAt"=now() WHERE id='…';`
   so users can retry (destructive ops require CTO review per AGENTS.md —
   file a task if unsure).

### 4. Error spike in Sentry

1. Open the alert → group by release to find the offending deploy.
2. Check `source=trpc` tagged events for failing procedure paths.
3. Fix forward or revert.

### 5. Verify Sentry is working (test alert)

After setting `NEXT_PUBLIC_SENTRY_DSN` in Railway, hit the temporary check
locally or in prod preview:

```bash
curl https://<app>/api/health   # 200 JSON, confirms runtime up
```

To confirm error capture end-to-end, temporarily throw in a route handler,
observe the event in Sentry, then revert.
