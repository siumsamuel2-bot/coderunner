/**
 * Run lifecycle state machine (SPE-119, extended by SPE-128 with `abandoned`).
 *
 * Legal transitions:
 *   (start)        -> in_progress
 *   in_progress    -> submitted        (POST /api/runs)
 *   in_progress    -> abandoned        (POST /api/runs/[runId]/abandon)
 *   submitted      -> verifying        (verification worker)
 *   verifying      -> verified | failed
 *
 * `abandoned` is terminal: it never returns to active and never appears on
 * leaderboards (leaderboards filter `status: 'verified'`).
 */

export const RUN_STATUSES = [
  'in_progress',
  'submitted',
  'verifying',
  'verified',
  'failed',
  'abandoned',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

/** Statuses that block starting a new run for the same user/challenge. */
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = [
  'in_progress',
  'submitted',
  'verifying',
];

/**
 * Abandon is only valid while the run is `in_progress`. Submitted/verifying
 * runs are owned by the verification pipeline; verified/failed/abandoned are
 * already terminal.
 */
export function canAbandon(status: string): boolean {
  return status === 'in_progress';
}

/**
 * Attempt number for a new run: count of ALL prior runs (including abandoned
 * and failed ones) + 1. Abandoning consumes an attempt slot — this is
 * intentional (SPE-128): it prevents start/abandon farming and keeps the
 * attempt counter an honest record of attempts made.
 */
export function nextAttemptNumber(priorRunCount: number): number {
  return priorRunCount + 1;
}
