// Ambient declarations for the verification-harness sibling package.
// The real package is linked via file:../verification and resolves locally.
// These declarations let `tsc --noEmit` pass in CI where the sibling
// package is not checked out.
declare module '@coderunner/verification-harness/src/cli.ts' {
  export interface VerificationReportSummary {
    passed: number;
    failed: number;
    skipped: number;
    requiredFailed?: number;
  }

  export interface VerificationReport {
    verdict: string;
    finishedAt: string;
    durationMs?: number | null;
    summary?: VerificationReportSummary;
  }

  export interface RunVerificationOptions {
    challengeId: string;
    targetUrl: string;
    seed?: number;
    outDir?: string;
    headless?: boolean;
  }

  export function runVerification(
    options: RunVerificationOptions
  ): Promise<VerificationReport>;
}

declare module '@coderunner/verification-harness/src/cli' {
  export * from '@coderunner/verification-harness/src/cli.ts';
}
