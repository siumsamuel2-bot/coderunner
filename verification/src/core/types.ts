export type Verdict = 'pass' | 'fail';
export type CheckSeverity = 'required' | 'bonus';
export type CheckStatus = 'pass' | 'fail' | 'skip';

export const HARNESS_VERSION = '1.0.0';
export const RESULT_SCHEMA_VERSION = 1 as const;

/**
 * Thrown by a check when it fails. Carries optional evidence file paths
 * (relative to the run's evidence directory).
 */
export class CheckFailed extends Error {
  readonly evidence: readonly string[];

  constructor(message: string, evidence: readonly string[] = []) {
    super(message);
    this.name = 'CheckFailed';
    this.evidence = evidence;
  }
}

export interface Check {
  /** Stable check id, e.g. "calc-arithmetic-add". */
  readonly id: string;
  readonly name: string;
  readonly severity: CheckSeverity;
  /** Check ids that must have passed before this check runs; otherwise it is skipped. */
  readonly requires?: readonly string[];
  /** Runs the check. Throw (any Error) to fail. Resolve to pass. */
  readonly run: () => Promise<void>;
}

export interface CheckResult {
  readonly id: string;
  readonly name: string;
  readonly severity: CheckSeverity;
  readonly status: CheckStatus;
  readonly durationMs: number;
  readonly error: string | null;
  readonly evidence: readonly string[];
}

export interface ReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly requiredFailed: number;
}

export interface VerificationReport {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly harnessVersion: string;
  readonly challenge: string;
  readonly targetUrl: string;
  readonly seed: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly verdict: Verdict;
  readonly summary: ReportSummary;
  readonly checks: readonly CheckResult[];
  readonly evidenceDir: string;
  readonly resultHash: string;
}

export interface ChallengeVerifierMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly specPath: string;
}

export type ChallengeId =
  | 'calculator'
  | 'todo-auth'
  | 'pdf-analyzer'
  | 'landing-page'
  | 'chatbot';
