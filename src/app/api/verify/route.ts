
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { addVerificationJob } from '@/lib/verification/queue';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    if (run.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (run.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Run is not awaiting verification' },
        { status: 409 }
      );
    }

    // Extract solution URL from toolLog
    const solutionUrl = (run.toolLog as { solutionUrl?: string } | null)?.solutionUrl;
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

