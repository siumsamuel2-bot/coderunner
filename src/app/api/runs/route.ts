
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { addVerificationJob } from "@/lib/verification/queue";
import { auth } from "@clerk/nextjs/server";

async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { clerkId: userId } });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, challengeId, runId, solutionUrl } = body;

    if (action === "start") {
      if (!challengeId) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
      });

      if (!challenge) {
        return NextResponse.json(
          { error: "Challenge not found" },
          { status: 404 }
        );
      }

      const existingRun = await prisma.run.findFirst({
        where: {
          userId: user.id,
          challengeId,
          status: { in: ["in_progress", "submitted", "verifying"] },
        },
      });

      if (existingRun) {
        return NextResponse.json(
          { error: "Active run already exists for this challenge" },
          { status: 409 }
        );
      }

      const run = await prisma.run.create({
        data: {
          userId: user.id,
          challengeId,
          status: "in_progress",
          startedAt: new Date(),
          attempts: 0,
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          challengeId: true,
          attempts: true,
        },
      });

      return NextResponse.json(run, { status: 201 });
    }

    if (action === "submit") {
      if (!runId || !solutionUrl) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      const run = await prisma.run.findUnique({
        where: { id: runId },
      });

      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }

      if (run.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (run.status !== "in_progress") {
        return NextResponse.json(
          { error: "Run is not in progress" },
          { status: 409 }
        );
      }

      // Server-owned timing: the race ends when the user submits.
      // elapsedMs is never trusted from the client or the verifier.
      const endedAt = new Date();
      const elapsedMs = Math.max(
        0,
        endedAt.getTime() - run.startedAt.getTime()
      );

      const updated = await prisma.run.update({
        where: { id: runId },
        data: {
          status: "submitted",
          endedAt,
          elapsedMs,
          attempts: { increment: 1 },
          toolLog: {
            solutionUrl,
            submittedAt: endedAt.toISOString(),
          },
        },
      });

      const challenge = await prisma.challenge.findUnique({
        where: { id: run.challengeId },
      });

      if (!challenge) {
        return NextResponse.json(
          { error: "Challenge not found" },
          { status: 404 }
        );
      }

      await addVerificationJob({
        challengeId: challenge.id,
        targetUrl: solutionUrl,
        runId: run.id,
      });

      return NextResponse.json(updated, { status: 200 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing run:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get("challengeId");
    const limit = parseInt(searchParams.get("limit") || "10");

    let runs;

    if (challengeId) {
      runs = await prisma.run.findMany({
        where: { challengeId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          challenge: true,
          verification: true,
        },
        orderBy: {
          elapsedMs: "asc",
        },
        take: limit,
      });
    } else {
      runs = await prisma.run.findMany({
        where: { userId: user.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          challenge: true,
          verification: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });
    }

    return NextResponse.json(runs);
  } catch (error) {
    console.error("Error fetching runs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
