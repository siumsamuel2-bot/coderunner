import type { Check, CheckResult, CheckStatus } from './types.ts';

/**
 * Executes checks sequentially in declaration order.
 *
 * - A check passes when `run()` resolves.
 * - A check fails when `run()` throws (any Error; CheckFailed carries evidence).
 * - A check whose `requires` ids include a failed or skipped check is skipped,
 *   so a hard early failure (e.g. "page never loaded") does not produce noisy
 *   cascading failures.
 */
export async function runChecks(checks: readonly Check[]): Promise<CheckResult[]> {
  const statuses = new Map<string, CheckStatus>();
  const results: CheckResult[] = [];

  for (const check of checks) {
    const unmet = (check.requires ?? []).filter((id) => statuses.get(id) !== 'pass');
    if (unmet.length > 0) {
      const result: CheckResult = {
        id: check.id,
        name: check.name,
        severity: check.severity,
        status: 'skip',
        durationMs: 0,
        error: `Skipped: requires [${unmet.join(', ')}] which did not pass`,
        evidence: []
      };
      statuses.set(check.id, 'skip');
      results.push(result);
      continue;
    }

    const started = Date.now();
    try {
      await check.run();
      const result: CheckResult = {
        id: check.id,
        name: check.name,
        severity: check.severity,
        status: 'pass',
        durationMs: Date.now() - started,
        error: null,
        evidence: []
      };
      statuses.set(check.id, 'pass');
      results.push(result);
    } catch (err) {
      const evidence =
        typeof err === 'object' && err !== null && 'evidence' in err && Array.isArray((err as { evidence: unknown }).evidence)
          ? ((err as { evidence: readonly string[] }).evidence as readonly string[])
          : [];
      const message =
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : `Non-error thrown: ${String(err)}`;
      const result: CheckResult = {
        id: check.id,
        name: check.name,
        severity: check.severity,
        status: 'fail',
        durationMs: Date.now() - started,
        error: message,
        evidence
      };
      statuses.set(check.id, 'fail');
      results.push(result);
    }
  }

  return results;
}
