
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { addVerificationJob } from '@/lib/verification/queue';
import { auth } from '@/auth';

/**
 * POST /api/runs
 *
 * Server-side run submit (SPE-119). The client must first call
 * POST /api/runs/start to create an in_progress run. This endpoint
 * computes elapsedMs server-side (now - startedAt), transitions the
 * run to `submitted`, and queues verification. The client never
 * sends timing — elapsedMs is provably from DB timestamps.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId, solutionUrl } = await request.json();
  if (!runId || !solutionUrl) {
    return NextResponse.json(
      { error: 'Missing runId or solutionUrl' },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (run.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (run.status !== 'in_progress') {
    return NextResponse.json(
      { error: `Run is not in_progress (current: ${run.status})` },
      { status: 409 }
    );
  }

  // Server-side timing: submit - start. Client never sends elapsedMs.
  const elapsedMs = Math.max(0, Date.now() - run.startedAt.getTime());

  const updated = await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'submitted',
      elapsedMs,
      toolLog: { solutionUrl },
    },
  });

  // Add verification job to the queue
  await addVerificationJob({
    challengeId: run.challengeId,
    targetUrl: solutionUrl,
    runId: run.id,
  });

  return NextResponse.json(updated, { status: 200 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challengeId');
    const limit = parseInt(searchParams.get('limit') || '10');

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
          elapsedMs: 'asc', // Fastest times first
        },
        take: limit,
      });
    } else {
      runs = await prisma.run.findMany({
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
          createdAt: 'desc',
        },
        take: limit,
      });
    }

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching runs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

