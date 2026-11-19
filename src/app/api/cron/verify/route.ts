import { NextResponse } from "next/server";
import { getVerificationQueueStats } from "@/lib/verification/queue";

/**
 * POST /api/cron/verify
 *
 * Job EXECUTION moved to the external verification worker (Node host via
 * GitHub Actions scheduled workflow) — this app runs on Cloudflare Workers,
 * which cannot host the Playwright harness (SPE-123).
 *
 * This endpoint now reports queue stats for monitoring so stale jobs are
 * visible. The worker drains 'pending' jobs directly.
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

  const stats = await getVerificationQueueStats();

  return NextResponse.json(
    {
      ...stats,
      message:
        "Verification execution moved to external worker (GitHub Actions). Stats are informational only.",
    },
    { status: 200 }
  );
}
