import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

    // Update the run with verification results
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: status === "pass" ? "verified" : "failed",
        endedAt: new Date(),
        elapsedMs: durationMs || null,
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

    return NextResponse.json({ message: "Verification results processed" }, { status: 200 });
  } catch (error) {
    console.error("Error processing verification webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}