
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ACTIVE_RUN_STATUSES, nextAttemptNumber } from '@/lib/runs/lifecycle';

/**
 * POST /api/runs/start
 *
 * Server-side run start (SPE-119). Creates a run in `in_progress` status,
 * records startedAt, and enforces one active run per user per challenge.
 * The client must call this before submitting; timing is computed
 * server-side on submit (submit - start), never sent by the client.
 *
 * A 409 here means an active run exists (in_progress/submitted/verifying);
 * the body carries `runId` + `status` so the UI can offer resume (state D)
 * or, for `in_progress`, the abandon path (SPE-128, POST
 * /api/runs/[runId]/abandon).
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
      status: { in: [...ACTIVE_RUN_STATUSES] },
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

  // Attempt number = count of ALL prior runs (incl. abandoned/failed) + 1.
  // Abandoned runs consume an attempt slot (SPE-128, anti-farming).
  const priorCount = await prisma.run.count({
    where: { userId, challengeId },
  });

  const run = await prisma.run.create({
    data: {
      userId,
      challengeId,
      status: 'in_progress',
      startedAt: new Date(),
      attempt: nextAttemptNumber(priorCount),
    },
  });

  return NextResponse.json(run, { status: 201 });
}
