
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { addVerificationJob } from '@/lib/verification/queue';

export async function POST(request: Request) {
  try {
    const { runId } = await request.json();

    if (!runId) {
      return NextResponse.json(
        { error: 'Missing runId' },
        { status: 400 }
      );
    }

    // Get the run with user and challenge info
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        user: true,
        challenge: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Extract solution URL from toolLog
    const solutionUrl = run.toolLog?.solutionUrl;
    if (!solutionUrl) {
      return NextResponse.json(
        { error: 'Solution URL not found for this run' },
        { status: 400 }
      );
    }

    // Update run status to verifying (or queued)
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'verifying',
      },
    });

    // Add verification job to the queue
    await addVerificationJob({
      challengeId: run.challenge.id,
      targetUrl: solutionUrl,
      runId: run.id,
    });

    return NextResponse.json({ message: 'Verification queued' }, { status: 202 });
  } catch (error) {
    console.error('Error queuing verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

