
import { NextResponse } from "next/server";
import { processVerificationJobs } from "@/lib/verification/queue";

/**
 * POST /api/cron/verify
 *
 * In-app cron caller for processVerificationJobs() (SPE-120 Task 1).
 * Processes pending verification jobs until the queue is drained (capped
 * to avoid long-running requests), so jobs don't orphan in 'pending'
 * state ('Verifying... forever' symptom from SPE-105 blocker #1).
 *
 * This replaces the missing production worker story — Railway cron can
 * ping this endpoint on a schedule, or the verification-worker script
 * can call processVerificationJobs() directly.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/verify] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MAX_BATCH = 20;
  let processed = 0;

  while (await processVerificationJobs() !== null && processed < MAX_BATCH) {
    processed += 1;
  }

  const drained = processed < MAX_BATCH;

  console.log(`[cron/verify] processed ${processed} job(s), drained=${drained}`);

  return NextResponse.json(
    {
      processed,
      drained,
      message: drained
        ? "Verification queue drained"
        : `Batch cap (${MAX_BATCH}) reached; run again to continue`,
    },
    { status: 200 }
  );
}
