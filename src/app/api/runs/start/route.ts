
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const ACTIVE_STATUSES = ['in_progress', 'submitted', 'verifying'];

/**
 * POST /api/runs/start
 *
 * Server-side run start (SPE-119). Creates a run in `in_progress` status,
 * records startedAt, and enforces one active run per user per challenge.
 * The client must call this before submitting; timing is computed
 * server-side on submit (submit - start), never sent by the client.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { challengeId } = await request.json();
  if (!challengeId || typeof challengeId !== 'string') {
    return NextResponse.json(
      { error: 'Missing challengeId' },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Enforce one active run per user per challenge (SPE-119 state machine).
  const activeRun = await prisma.run.findFirst({
    where: {
      userId,
      challengeId,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeRun) {
    return NextResponse.json(
      {
        error: 'Active run already exists for this challenge',
        runId: activeRun.id,
        status: activeRun.status,
      },
      { status: 409 }
    );
  }

  // Attempt number = count of prior runs for this user/challenge + 1.
  const priorCount = await prisma.run.count({
    where: { userId, challengeId },
  });

  const run = await prisma.run.create({
    data: {
      userId,
      challengeId,
      status: 'in_progress',
      startedAt: new Date(),
      attempt: priorCount + 1,
    },
  });

  return NextResponse.json(run, { status: 201 });
}
