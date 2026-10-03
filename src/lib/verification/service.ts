import { prisma } from '@/lib/prisma';
import { runVerification } from '@coderunner/verification-harness/src/cli';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

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
      challengeId: challengeId,
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
export async function processVerificationResults(runId: string, report: any): Promise<void> {
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
    
    // Update the run with verification results
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: passed ? 'verified' : 'failed',
        endedAt: new Date(report.finishedAt),
        elapsedMs: report.durationMs || 0,
      },
    });
    
    // Create enhanced test output with more details
    let testOutput = '';
    if (report.summary) {
      testOutput = `Verification completed: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`;
      if (report.summary.requiredFailed > 0) {
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