import { prisma } from "@/lib/prisma";
import { runVerification } from "@coderunner/verification-harness/src/cli.ts";
import { join } from "node:path";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { uploadVerificationEvidence } from "@/lib/storage";

type HarnessChallengeId = Parameters<typeof runVerification>[0]["challengeId"];

/**
 * Upload verification artifacts to R2
 */
async function uploadArtifactsToR2(runId: string, outDir: string): Promise<void> {
  try {
    const files = await readdir(outDir, { recursive: true });
    for (const file of files) {
      if (typeof file === "string") {
        const filePath = join(outDir, file);
        // Check if it's a file (not directory)
        try {
          const stat = await import("node:fs/promises").then((fs) =>
            fs.stat(filePath)
          );
          if (stat.isFile()) {
            const content = await readFile(filePath);
            const contentType = getContentType(file);
            await uploadVerificationEvidence(runId, file, content, contentType);
          }
        } catch {
          // Skip if not a file or read error
        }
      }
    }
  } catch (error) {
    console.error(`Failed to upload artifacts for run ${runId}:`, error);
    // Don't throw - artifacts are supplementary
  }
}

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "json":
      return "application/json";
    case "log":
    case "txt":
      return "text/plain";
    case "html":
      return "text/html";
    default:
      return "application/octet-stream";
  }
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
  const outDir = join(process.cwd(), "verification-results", runId);

  // Ensure output directory exists
  await mkdir(outDir, { recursive: true });

  // Update run status to verifying
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "verifying",
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

    // Upload artifacts to R2
    await uploadArtifactsToR2(runId, outDir);

    // Process the verification results
    await processVerificationResults(runId, report);
  } catch (error) {
    console.error(`Verification process failed for run ${runId}:`, error);
    // Update run status to failed if verification failed
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "failed",
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
      console.error("Run not found when processing verification results");
      return;
    }

    // Determine if verification passed
    const passed = report.verdict === "pass";

    // Update the run with verification results.
    // Timing (startedAt/endedAt/elapsedMs) is server-owned and set at submit;
    // the verifier only reports pass/fail and evidence.
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: passed ? "verified" : "failed",
      },
    });

    // Create enhanced test output with more details
    let testOutput = "";
    if (report.summary) {
      testOutput = `Verification completed: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`;
      if ((report.summary.requiredFailed ?? 0) > 0) {
        testOutput += ` (${report.summary.requiredFailed} required checks failed)`;
      }
    } else {
      testOutput = "Verification completed";
    }

    // Add R2 evidence links if available
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (publicUrl) {
      testOutput += `\n\nEvidence: ${publicUrl}/verification/${runId}/`;
    }

    // Create or update verification record
    await prisma.verification.upsert({
      where: { runId },
      update: {
        status: passed ? "passed" : "failed",
        testOutput: testOutput,
        verifiedAt: new Date(),
      },
      create: {
        runId,
        status: passed ? "passed" : "failed",
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
          status: "failed",
        },
      });
    } catch (updateError) {
      console.error(
        `Failed to update run status to failed for run ${runId}:`,
        updateError
      );
    }
  }
}