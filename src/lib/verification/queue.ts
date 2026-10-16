import { prisma } from '@/lib/prisma';

// App-safe queue operations (DB only). Job EXECUTION (Playwright harness) is
// Node-only and lives in runner.ts, imported exclusively by the external
// verification worker (GitHub Actions) so the app bundle stays edge-safe.

export interface VerificationJobData {
  challengeId: string;
  targetUrl: string;
  runId: string;
  seed?: number;
}

/**
 * Add a verification job to the queue
 */
export async function addVerificationJob(data: VerificationJobData) {
  const { challengeId, targetUrl, runId, seed: _seed } = data;
  void _seed;

  // Create a new verification job record
  const job = await prisma.verificationJob.create({
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
export async function claimNextPendingJob() {
  const job = await prisma.verificationJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { challenge: true, run: true },
  });

  if (!job) return null;

  return prisma.verificationJob.update({
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
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  const cap = maxAttempts ?? 3;
  if (attempts < cap) {
    await prisma.verificationJob.update({
      where: { id: jobId },
      data: { status: 'pending', error: message },
    });
  } else {
    await prisma.verificationJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: message },
    });
  }
}

/**
 * Get statistics about the verification queue
 */
export async function getVerificationQueueStats() {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.verificationJob.count({ where: { status: 'pending' } }),
    prisma.verificationJob.count({ where: { status: 'processing' } }),
    prisma.verificationJob.count({ where: { status: 'completed' } }),
    prisma.verificationJob.count({ where: { status: 'failed' } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}
