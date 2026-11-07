
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { addVerificationJob } from '@/lib/verification/queue';
import { auth } from '@/auth';

/**
 * POST /api/verify
 *
 * Queues verification for a run. Requires authentication and run ownership.
 * (SPE-123 auth gap #4: previously unauthenticated — anyone could queue
 * verification for any run.)
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Verify run ownership
  if (run.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Extract solution URL from toolLog
  const solutionUrl = (run.toolLog as { solutionUrl?: string } | null)?.solutionUrl;
  if (!solutionUrl) {
    return NextResponse.json(
      { error: 'Solution URL not found for this run' },
      { status: 400 }
    );
  }

  // Only allow verification for runs in submitted state
  if (run.status !== 'submitted') {
    return NextResponse.json(
      { error: `Run is not in submitted state (current: ${run.status})` },
      { status: 409 }
    );
  }

  // Update run status to verifying
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
}
