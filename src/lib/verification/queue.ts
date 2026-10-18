import { prisma } from '@/lib/prisma';
import type { PrismaClient as NodePrismaClient } from '@/generated/prisma-node/client';

// App-safe queue operations (DB only). Job EXECUTION (Playwright harness) is
// Node-only and lives in runner.ts, imported exclusively by the external
// verification worker (GitHub Actions) so the app bundle stays edge-safe.
//
// Every function accepts an optional `db` client: the app passes nothing and
// uses the workerd-runtime client; the Node verification worker passes the
// nodejs-runtime client from @/lib/prisma-node (the workerd client cannot
// load under plain Node — see SPE-123).

// The two generated clients share the same schema, so the nodejs client type
// is structurally satisfied by the app client.
type Db = NodePrismaClient;
const appDb = prisma as unknown as Db;

export interface VerificationJobData {
  challengeId: string;
  targetUrl: string;
  runId: string;
  seed?: number;
}

/**
 * Add a verification job to the queue
 */
export async function addVerificationJob(data: VerificationJobData, db: Db = appDb) {
  const { challengeId, targetUrl, runId, seed: _seed } = data;
  void _seed;

  // Create a new verification job record
  const job = await db.verificationJob.create({
    data: {
      runId,
      challengeId,
      targetUrl,
      status: 'pending',
    },
  });

  return job;
}

/**
 * Atomically claim the next pending verification job.
 * Marks it 'processing' and increments attempts. Returns null when the
 * queue is empty. The caller is responsible for completing or re-queueing.
 */
export async function claimNextPendingJob(db: Db = appDb) {
  const job = await db.verificationJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { challenge: true, run: true },
  });

  if (!job) return null;

  return db.verificationJob.update({
    where: { id: job.id },
    data: { status: 'processing', attempts: { increment: 1 } },
    include: { challenge: true, run: true },
  });
}

/**
 * Re-queue a failed job if attempts remain, otherwise mark it failed.
 */
export async function failOrRetryJob(
  jobId: string,
  attempts: number,
  maxAttempts: number | null,
  error: unknown,
  db: Db = appDb
) {
  const message = error instanceof Error ? error.message : String(error);
  const cap = maxAttempts ?? 3;
  if (attempts < cap) {
    await db.verificationJob.update({
      where: { id: jobId },
      data: { status: 'pending', error: message },
    });
  } else {
    await db.verificationJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: message },
    });
  }
}

/**
 * Get statistics about the verification queue
 */
export async function getVerificationQueueStats(db: Db = appDb) {
  const [pending, processing, completed, failed] = await Promise.all([
    db.verificationJob.count({ where: { status: 'pending' } }),
    db.verificationJob.count({ where: { status: 'processing' } }),
    db.verificationJob.count({ where: { status: 'completed' } }),
    db.verificationJob.count({ where: { status: 'failed' } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}
