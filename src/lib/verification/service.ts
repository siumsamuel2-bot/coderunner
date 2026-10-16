import { prisma } from '@/lib/prisma';

// DB-only verification result processing. Safe to import from the app bundle
// (Workers/edge) — the Playwright harness lives in runner.ts, which must only
// be imported from Node hosts (scripts/verification-worker.ts).

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
