
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/verification-webhook
 *
 * Receives verification results from the verification harness.
 *
 * Auth: Authorization: Bearer ${VERIFICATION_WEBHOOK_SECRET}
 *
 * Previously unauthenticated — any caller could mark any run verified
 * (SPE-115 audit risk #5). Now requires a shared secret so only the
 * verification harness can submit results.
 *
 * NOTE: elapsedMs is computed server-side at submit (now - startedAt)
 * and is intentionally NOT overwritten by the harness Playwright runtime
 * (SPE-119).
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.VERIFICATION_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[verification-webhook] VERIFICATION_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const verificationReport = await request.json();

    // Extract relevant information from the verification report
    const { runId, status, testOutput, durationMs } = verificationReport;

    if (!runId) {
      return NextResponse.json(
        { error: "Missing runId in verification report" },
        { status: 400 }
      );
    }

    // Find the run
    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    // Only accept webhook updates for runs in verifying/submitted state.
    // Prevents stale/forged reports from clobbering a terminal state.
    if (!["submitted", "verifying"].includes(run.status)) {
      return NextResponse.json(
        { error: `Run is not in a verifiable state (current: ${run.status})` },
        { status: 409 }
      );
    }

    const passed = status === "pass";

    // Update the run with verification results.
    // elapsedMs is computed server-side at submit and not overwritten here.
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: passed ? "verified" : "failed",
        endedAt: new Date(),
        ...(run.elapsedMs == null ? { elapsedMs: durationMs ?? null } : {}),
      },
    });

    // Create or update verification record
    await prisma.verification.upsert({
      where: { runId },
      update: {
        status: passed ? "passed" : "failed",
        testOutput: testOutput ?? null,
        verifiedAt: new Date(),
      },
      create: {
        runId,
        status: passed ? "passed" : "failed",
        testOutput: testOutput ?? null,
      },
    });

    return NextResponse.json({ message: "Verification results processed" }, { status: 200 });
  } catch (error) {
    console.error("Error processing verification webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
