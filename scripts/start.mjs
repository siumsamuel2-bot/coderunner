import { spawnSync } from "node:child_process";

// Boot sequence for production (Railway):
//   1. `prisma db push` - sync schema to Postgres
//   2. `prisma db seed` - idempotent challenge seed
//   3. `next start`    - the web server, must ALWAYS run
//
// The DB steps must never kill the web boot: free-tier Postgres can be
// sleeping/unreachable at deploy time and Prisma CLI has no connect retry
// (the runtime pool in src/lib/prisma.ts does retry). If schema/seed fails,
// we log and continue - the app can still serve pages and /api/health stays
// informative (503 with dbError) instead of Railway serving a bare 404/502.

function runStep(label, cmd, args) {
  console.log(`[start] ${label}...`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(
      `[start] WARNING: ${label} exited with code ${res.status}; continuing to next start anyway`,
    );
  }
}

const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";

runStep("prisma db push", npx, ["prisma", "db", "push", "--skip-generate"]);
runStep("prisma db seed", npx, ["prisma", "db", "seed"]);

// next start binds 0.0.0.0 and reads $PORT automatically.
const server = spawnSync(npx, ["next", "start"], { stdio: "inherit", shell: true });
process.exit(server.status ?? 1);
