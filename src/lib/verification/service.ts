import { prisma } from '@/lib/prisma';
import { runVerification } from '@coderunner/verification-harness/src/cli.ts';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

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
    checks?: Array<{
      id: string;
      name: string;
      severity: string;
      status: string;
      durationMs: number;
      error: string | null;
      evidence: string[];
    }>;
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
    
    // Build per-check breakdown for the results page
    const checksBreakdown = report.checks?.map((c) => ({
      id: c.id,
      name: c.name,
      severity: c.severity,
      status: c.status,
      error: c.error,
      evidence: c.evidence,
    }));
    
    // Update the run with verification results
    // elapsedMs is computed server-side at submit (now - startedAt) and must
    // not be overwritten by the harness Playwright runtime (SPE-119).
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: passed ? 'verified' : 'failed',
        endedAt: new Date(report.finishedAt),
        ...(run.elapsedMs == null ? { elapsedMs: report.durationMs ?? null } : {}),
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
    
    // Create or update verification record with full check data
    const verificationData = {
      status: passed ? 'passed' : 'failed',
      testOutput: testOutput,
      ...(checksBreakdown ? { reportData: checksBreakdown } : {}),
      verifiedAt: new Date(),
    };

    await prisma.verification.upsert({
      where: { runId },
      update: verificationData,
      create: { runId, ...verificationData },
    });
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