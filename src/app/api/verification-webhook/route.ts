import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const VERIFICATION_WEBHOOK_SECRET = process.env.VERIFICATION_WEBHOOK_SECRET;

if (!VERIFICATION_WEBHOOK_SECRET) {
  console.warn(
    "VERIFICATION_WEBHOOK_SECRET not configured - webhook endpoint disabled"
  );
}

export async function POST(request: Request) {
  // Require secret for webhook authentication (SPE-115 audit: unauthenticated webhook trust path)
  if (VERIFICATION_WEBHOOK_SECRET) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${VERIFICATION_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // If no secret configured, reject all requests (secure by default)
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  try {
    const verificationReport = await request.json();

    const { runId, status, testOutput } = verificationReport;

    if (!runId) {
      return NextResponse.json(
        { error: "Missing runId in verification report" },
        { status: 400 }
      );
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    // Update the run with verification results.
    // Timing is server-owned (set at submit); the webhook only reports verdict.
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: status === "pass" ? "verified" : "failed",
      },
    });

    // Create or update verification record
    await prisma.verification.upsert({
      where: { runId },
      update: {
        status: status === "pass" ? "passed" : "failed",
        testOutput: testOutput || null,
        verifiedAt: new Date(),
      },
      create: {
        runId,
        status: status === "pass" ? "passed" : "failed",
        testOutput: testOutput || null,
      },
    });

    return NextResponse.json(
      { message: "Verification results processed" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing verification webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}