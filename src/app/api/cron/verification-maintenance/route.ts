import { NextResponse } from "next/server";
import { recoverStaleJobs } from "@/lib/verification/queue";
import { recoverStaleRuns } from "@/lib/verification/service";

/**
 * POST /api/cron/verification-maintenance
 *
 * Recovery sweeps for stuck verification state. Runs both:
 *  - recoverStaleJobs: resets 'processing' VerificationJobs older than the
 *    threshold back to 'pending' so the external worker can retry them.
 *  - recoverStaleRuns: resets runs stuck in 'verifying' older than the
 *    threshold back to 'submitted' so they can be re-queued.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 *
 * This is the safety net for the external Node verification worker
 * (GitHub Actions scheduled workflow, SPE-123). If the worker dies mid-job,
 * jobs and runs can be left in non-terminal states; this endpoint recovers
 * them so the pipeline self-heals on the next cron tick.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[verification-maintenance] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobsRecovered = await recoverStaleJobs();
    const runsRecovered = await recoverStaleRuns();

    console.log(
      `[verification-maintenance] recovered ${jobsRecovered} stale jobs, ${runsRecovered} stale runs`
    );

    return NextResponse.json(
      {
        message: "Verification maintenance sweep complete",
        jobsRecovered,
        runsRecovered,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[verification-maintenance] sweep failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
