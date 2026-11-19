import { prisma } from '@/lib/prisma';
import { runVerification } from '@coderunner/verification-harness/src/cli.ts';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

type HarnessChallengeId = Parameters<typeof runVerification>[0]['challengeId'];

const BASE_SCORE_MAX = 600;

function computeBaseScore(passed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(BASE_SCORE_MAX * (passed / total));
}

function computeTimeFactor(elapsedMs: number, timeLimitMs: number): number {
  const twoXLimit = timeLimitMs * 2;
  return Math.max(0, 1 - elapsedMs / twoXLimit);
}

function computeScore(
  baseScore: number,
  completionFactor: number,
  timeFactor: number,
  antiCheatMultiplier: number
): number {
  return Math.round(baseScore * completionFactor * timeFactor * antiCheatMultiplier);
}

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

// Function to process verification results from the report
export async function processVerificationResults(
  runId: string,
  report: {
    verdict: string;
    finishedAt: string | Date;
    durationMs?: number | null;
    summary?: {
      passed: number;
      failed: number;
      skipped: number;
      requiredFailed?: number;
    };
  }
): Promise<void> {
  try {
    // Find the run
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        challenge: true,
      },
    });
    
    if (!run) {
      console.error('Run not found when processing verification results');
      return;
    }
    
    // Determine if verification passed
    const passed = report.verdict === 'pass';
    
    // Server-side timing enforcement: elapsed time must not exceed challenge limit
    const timeLimitMs = run.challenge.estimatedMinutes * 60 * 1000;
    const withinTimeLimit = (report.durationMs || 0) <= timeLimitMs;
    
    // Compute scoring components
    const passedCount = report.summary?.passed ?? 0;
    const totalCount = (report.summary?.passed ?? 0) + (report.summary?.failed ?? 0) + (report.summary?.skipped ?? 0);
    const baseScore = computeBaseScore(passedCount, totalCount);
    const completionFactor = passed ? 1.0 : passedCount / Math.max(totalCount, 1);
    const timeFactor = computeTimeFactor(report.durationMs || 0, timeLimitMs);
    const antiCheatMultiplier = 1.0; // Clean run, no anomalies detected
    
    const score = computeScore(baseScore, completionFactor, timeFactor, antiCheatMultiplier);
    
    // Update the run with verification results and score breakdown
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: passed && withinTimeLimit ? 'verified' : 'failed',
        endedAt: new Date(report.finishedAt),
        elapsedMs: report.durationMs || 0,
        score: passed && withinTimeLimit ? score : null,
        baseScore: passed && withinTimeLimit ? baseScore : null,
        completionFactor: passed && withinTimeLimit ? completionFactor : null,
        timeFactor: passed && withinTimeLimit ? timeFactor : null,
        antiCheatMultiplier: passed && withinTimeLimit ? antiCheatMultiplier : null,
        verifiedAt: passed && withinTimeLimit ? new Date() : null,
      },
    });
    
    // Create enhanced test output with more details
    let testOutput = '';
    if (report.summary) {
      testOutput = `Verification completed: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`;
      if ((report.summary.requiredFailed ?? 0) > 0) {
        testOutput += ` (${report.summary.requiredFailed} required checks failed)`;
      }
    } else {
      testOutput = 'Verification completed';
    }
    
    // Create or update verification record
    await prisma.verification.upsert({
      where: { runId },
      update: {
        status: passed ? 'passed' : 'failed',
        testOutput: testOutput,
        verifiedAt: new Date(),
      },
      create: {
        runId,
        status: passed ? 'passed' : 'failed',
        testOutput: testOutput,
      },
    });
    
    // If verified, create/update speedrun, world record, and personal record
    if (passed && withinTimeLimit && score !== null && run.elapsedMs !== null) {
      await createOrUpdateSpeedrun(run, score);
      await createOrUpdateWorldRecord(run, score);
      await createOrUpdatePersonalRecord(run, score);
    }
  } catch (error) {
    console.error(`Error processing verification results for run ${runId}:`, error);
    // Update run status to failed if there was an error processing results
    try {
      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'failed',
          endedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error(`Failed to update run status to failed for run ${runId}:`, updateError);
    }
  }
}

async function createOrUpdateSpeedrun(run: {
  id: string;
  userId: string;
  challengeId: string;
  score: number | null;
  elapsedMs: number | null;
}, score: number): Promise<void> {
  const elapsedMs = run.elapsedMs ?? 0;
  
  // Get total verified runs for this challenge to compute percentile
  const totalRuns = await prisma.run.count({
    where: {
      challengeId: run.challengeId,
      status: 'verified',
      score: { not: null },
    },
  });
  
  // Count runs with higher score (for rank)
  const higherScoreCount = await prisma.run.count({
    where: {
      challengeId: run.challengeId,
      status: 'verified',
      score: { gt: score },
    },
  });
  
  // Count runs with same score but lower elapsedMs (tiebreaker)
  const sameScoreFasterCount = await prisma.run.count({
    where: {
      challengeId: run.challengeId,
      status: 'verified',
      score,
      elapsedMs: { lt: elapsedMs },
    },
  });
  
  const rank = higherScoreCount + sameScoreFasterCount + 1;
  const percentile = totalRuns > 0
    ? 100 * ((totalRuns - rank) + 0.5) / totalRuns
    : 100;
  
  // Check if this is a world record (best score ever for this challenge)
  const bestScoreRun = await prisma.run.findFirst({
    where: {
      challengeId: run.challengeId,
      status: 'verified',
      score: { not: null },
    },
    orderBy: [{ score: 'desc' }, { elapsedMs: 'asc' }],
    take: 1,
    select: { id: true, score: true, elapsedMs: true },
  });
  
  const isWorldRecord = bestScoreRun?.id === run.id;
  
  await prisma.speedrun.upsert({
    where: {
      challengeId_userId: {
        challengeId: run.challengeId,
        userId: run.userId,
      },
    },
    update: {
      score,
      elapsedMs,
      rank,
      percentile,
      isWorldRecord,
      achievedAt: new Date(),
    },
    create: {
      score,
      elapsedMs,
      rank,
      percentile,
      isWorldRecord,
      achievedAt: new Date(),
      challengeId: run.challengeId,
      userId: run.userId,
      runId: run.id,
    },
  });
}

async function createOrUpdateWorldRecord(run: {
  id: string;
  userId: string;
  challengeId: string;
  score: number | null;
  elapsedMs: number | null;
}, score: number): Promise<void> {
  const elapsedMs = run.elapsedMs ?? 0;
  
  // Check if this beats the current world record for this challenge (overall category)
  const currentWR = await prisma.worldRecord.findFirst({
    where: {
      challengeId: run.challengeId,
      category: 'overall',
    },
    orderBy: [{ score: 'desc' }, { elapsedMs: 'asc' }],
    take: 1,
  });
  
  const beatsWR = !currentWR || score > currentWR.score || (score === currentWR.score && elapsedMs < currentWR.elapsedMs);
  
  if (beatsWR) {
    // Remove old overall WR flag from speedruns if needed
    await prisma.speedrun.updateMany({
      where: {
        challengeId: run.challengeId,
        isWorldRecord: true,
      },
      data: {
        isWorldRecord: false,
      },
    });
    
    // Create or update world record
    await prisma.worldRecord.upsert({
      where: {
        challengeId_category: {
          challengeId: run.challengeId,
          category: 'overall',
        },
      },
      update: {
        score,
        elapsedMs,
        userId: run.userId,
        runId: run.id,
        achievedAt: new Date(),
      },
      create: {
        score,
        elapsedMs,
        userId: run.userId,
        runId: run.id,
        achievedAt: new Date(),
        category: 'overall',
        challengeId: run.challengeId,
      },
    });
    
    // Mark the speedrun as world record
    await prisma.speedrun.update({
      where: {
        challengeId_userId: {
          challengeId: run.challengeId,
          userId: run.userId,
        },
      },
      data: {
        isWorldRecord: true,
      },
    });
  }
}

async function createOrUpdatePersonalRecord(run: {
  id: string;
  userId: string;
  challengeId: string;
  score: number | null;
  elapsedMs: number | null;
}, score: number): Promise<void> {
  const elapsedMs = run.elapsedMs ?? 0;
  
    await prisma.personalRecord.upsert({
    where: {
      userId_challengeId: {
        userId: run.userId,
        challengeId: run.challengeId,
      },
    },
    update: {
      bestScore: score,
      bestElapsedMs: elapsedMs,
      updatedAt: new Date(),
    },
    create: {
      bestScore: score,
      bestElapsedMs: elapsedMs,
      updatedAt: new Date(),
      userId: run.userId,
      challengeId: run.challengeId,
    },
  });
}