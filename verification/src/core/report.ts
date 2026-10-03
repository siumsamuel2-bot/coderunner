import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  CheckResult,
  ReportSummary,
  Verdict,
  VerificationReport
} from './types.ts';
import { HARNESS_VERSION, RESULT_SCHEMA_VERSION } from './types.ts';

/** Computes the aggregate summary from check results. */
export function summarize(results: readonly CheckResult[]): ReportSummary {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const requiredFailed = results.filter((r) => r.status === 'fail' && r.severity === 'required').length;
  return {
    total: results.length,
    passed,
    failed,
    skipped,
    requiredFailed
  };
}

/** Deterministic verdict: pass iff every required check passed. */
export function computeVerdict(results: readonly CheckResult[]): Verdict {
  return results.some((r) => r.severity === 'required' && r.status !== 'pass')
    ? 'fail'
    : 'pass';
}

/** Stable JSON.stringify: object keys sorted recursively, no extra whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/** SHA-256 over the canonical JSON of the report body (verdict content only). */
export function hashReportBody(
  body: Omit<VerificationReport, 'resultHash'>
): string {
  return `sha256:${createHash('sha256')
    .update(canonicalJson(body), 'utf8')
    .digest('hex')}`;
}

export interface BuildReportInput {
  readonly challenge: string;
  readonly targetUrl: string;
  readonly seed: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly checks: readonly CheckResult[];
  readonly evidenceDir: string;
}

/** Assembles the final report (summary, verdict, tamper-evidence hash). */
export function buildReport(input: BuildReportInput): VerificationReport {
  const summary = summarize(input.checks);
  const verdict = computeVerdict(input.checks);
  const body = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    harnessVersion: HARNESS_VERSION,
    challenge: input.challenge,
    targetUrl: input.targetUrl,
    seed: input.seed,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: Date.parse(input.finishedAt) - Date.parse(input.startedAt),
    verdict,
    summary,
    checks: input.checks,
    evidenceDir: input.evidenceDir
  };
  const resultHash = hashReportBody(body);
  return { ...body, resultHash };
}

/** Writes report.json inside the evidence dir; returns the absolute path. */
export async function writeReport(
  report: VerificationReport,
  evidenceDir: string
): Promise<string> {
  const target = path.join(evidenceDir, 'report.json');
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return target;
}

/** Human-readable console summary of a report. */
export function formatSummary(report: VerificationReport): string {
  const lines: string[] = [
    `challenge      : ${report.challenge}`,
    `target         : ${report.targetUrl}`,
    `verdict        : ${report.verdict.toUpperCase()}`,
    `checks         : ${report.summary.passed}/${report.summary.total} passed` +
      ` (${report.summary.failed} failed, ${report.summary.skipped} skipped,` +
      ` ${report.summary.requiredFailed} required failures)`,
    `duration       : ${report.durationMs} ms`,
    `result hash    : ${report.resultHash}`,
    `evidence dir   : ${report.evidenceDir}`
  ];
  const failed = report.checks.filter((c) => c.status === 'fail');
  for (const check of failed) {
    lines.push(`  FAIL [${check.severity}] ${check.id}: ${check.error ?? 'unknown error'}`);
  }
  return lines.join('\n');
}
