import { prisma } from '@/lib/prisma';
import { runVerification } from '@coderunner/verification-harness/src/cli.ts';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

// NODE-ONLY verification execution. Do NOT import from app routes: this pulls
// the Playwright harness (node:fs, browser binaries) into the bundle, which
// cannot run on Cloudflare Workers. Per CTO architecture (SPE-123), the
// harness runs on an external Node host (GitHub Actions scheduled workflow)
// that drains the queue and posts results.

import { processVerificationResults } from './service';
import { claimNextPendingJob, failOrRetryJob } from './queue';

type HarnessChallengeId = Parameters<typeof runVerification>[0]['challengeId'];

export async function triggerVerification(options: {
  challengeId: string;
  targetUrl: string;
  runId: string;
  seed?: number;
}): Promise<void> {
  const { challengeId, targetUrl, runId, seed } = options;

  // Generate seed if not provided
  const finalSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF);

  // Set up output directory
  const outDir = join(process.cwd(), 'verification-results', runId);

  // Ensure output directory exists
  await mkdir(outDir, { recursive: true });

  // Update run status to verifying
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'verifying',
    },
  });

  try {
    // Run verification harness using the programmatic API
    const report = await runVerification({
      challengeId: challengeId as HarnessChallengeId,
      targetUrl: targetUrl,
      seed: finalSeed,
      outDir: outDir,
      headless: true, // Run headless for background processing
    });

    // Process the verification results
    await processVerificationResults(runId, report);
  } catch (error) {
    console.error(`Verification process failed for run ${runId}:`, error);
    // Update run status to failed if verification failed
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'failed',
        endedAt: new Date(),
      },
    });
  }
}

/**
 * Process verification jobs from the queue (claim -> run harness -> finalize).
 * NODE-ONLY. Returns the processed job, or null when the queue is empty.
 */
export async function processVerificationJobs() {
  const job = await claimNextPendingJob();
  if (!job) return null;

  try {
    await triggerVerification({
      challengeId: job.challengeId,
      targetUrl: job.targetUrl,
      runId: job.runId,
    });

    await prisma.verificationJob.update({
      where: { id: job.id },
      data: { status: 'completed' },
    });

    return job;
  } catch (error) {
    console.error(`Verification job ${job.id} failed:`, error);
    await failOrRetryJob(job.id, job.attempts, job.maxAttempts, error);
    throw error;
  }
}
