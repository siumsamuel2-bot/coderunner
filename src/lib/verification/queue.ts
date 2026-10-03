
import { prisma } from '@/lib/prisma';
import { triggerVerification } from './service';

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
  const { challengeId, targetUrl, runId, seed } = data;

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
 * Process verification jobs from the queue
 * This function should be called by a background worker
 */
export async function processVerificationJobs() {
  // Get the next pending job
  const job = await prisma.verificationJob.findFirst({
    where: {
      status: 'pending',
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      challenge: true,
      run: true,
    },
  });

  if (!job) {
    // No pending jobs
    return null;
  }

  // Mark job as processing
  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
    },
  });

  try {
    // Run the verification
    await triggerVerification({
      challengeId: job.challengeId,
      targetUrl: job.targetUrl,
      runId: job.runId,
    });

    // Mark job as completed
    await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
      },
    });

    return job;
  } catch (error) {
    console.error(`Verification job ${job.id} failed:`, error);

    // Check if we should retry
    const maxAttempts = job.maxAttempts ?? 3;
    if (job.attempts < maxAttempts) {
      // Mark as pending for retry
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } else {
      // Mark as failed after max attempts
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    throw error;
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

