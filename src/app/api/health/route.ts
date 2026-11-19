import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Jobs stuck in pending/processing beyond this threshold indicate a wedged
// verification queue (see SPE-89 stale executionRunId locks).
const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000;

export async function GET() {
  const startedAt = Date.now();
  let dbMs: number | null = null;
  let dbError: string | null = null;
  let staleJobs: unknown = null;

  try {
    const threshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - startedAt;
    staleJobs = await prisma.verificationJob.count({
      where: { status: { in: ["pending", "processing"] }, updatedAt: { lt: threshold } },
    });
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    dbMs = Date.now() - startedAt;
    Sentry.captureException(err, { tags: { source: "health" } });
  }

  const healthy = dbError === null;
  return NextResponse.json(
    {
      ok: healthy,
      db: { ok: healthy, latencyMs: dbMs, error: dbError },
      verification: { staleJobs },
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
