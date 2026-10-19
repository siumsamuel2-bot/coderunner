
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { canAbandon } from '@/lib/runs/lifecycle';

/**
 * POST /api/runs/[runId]/abandon (SPE-128)
 *
 * Server-side abandon for the authenticated run owner. Transitions an
 * `in_progress` run to the terminal `abandoned` status, releasing the
 * challenge for a new attempt (start no longer 409s). Abandoned runs stay
 * in the run history and consume their attempt slot (see lifecycle.ts).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await params;

  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (run.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!canAbandon(run.status)) {
    return NextResponse.json(
      { error: `Run cannot be abandoned (current: ${run.status})` },
      { status: 409 }
    );
  }

  const updated = await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'abandoned',
      endedAt: new Date(),
    },
  });

  return NextResponse.json(updated, { status: 200 });
}
