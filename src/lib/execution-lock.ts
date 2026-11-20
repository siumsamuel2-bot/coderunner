/**
 * Stale executionRunId lock management (SPE-89 platform fix).
 *
 * Tracks the lifecycle of an executionRunId lock on a Run record and
 * automatically clears locks that have expired (past executionRunExpiresAt).
 * This replaces the app-level sweeper (SPE-100 / src/lib/paperclip.ts) once
 * SPE-89 ships and SPE-102 removes the fallback code.
 *
 * Four new Run model fields (added to schema.prisma):
 *  - executionRunStartedAt: when the lock was taken
 *  - executionRunExpiresAt: when the lock expires (timeout)
 *  - executionRunClearedAt: when the lock was cleared
 *  - executionRunClearedBy: who cleared the lock
 */

import { prisma } from "@/lib/prisma";

/**
 * Default TTL for an executionRunId lock: 24 hours.
 * A run that holds a lock longer than this is considered stale.
 */
export const EXECUTION_LOCK_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Set the executionRunId lock on a run, recording when it was taken
 * and when it expires.
 */
export async function setExecutionLock(
  runId: string,
  executionRunId: string,
  ttlMs: number = EXECUTION_LOCK_DEFAULT_TTL_MS
) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + ttlMs);

  return await prisma.run.update({
    where: { id: runId },
    data: {
      executionRunId,
      executionRunStartedAt: startedAt,
      executionRunExpiresAt: expiresAt,
      executionRunClearedAt: null,
      executionRunClearedBy: null,
    },
  });
}

/**
 * Clear the executionRunId lock on a run, recording when and by whom.
 */
export async function clearExecutionLock(
  runId: string,
  clearedBy: string
) {
  return await prisma.run.update({
    where: { id: runId },
    data: {
      executionRunId: null,
      executionRunClearedAt: new Date(),
      executionRunClearedBy: clearedBy,
    },
  });
}

/**
 * Clear all expired executionRunId locks. A lock is expired when
 * executionRunId is set AND executionRunExpiresAt is in the past.
 * Returns the number of locks cleared.
 */
export async function clearStaleExecutionLocks(): Promise<number> {
  const now = new Date();

  const staleRuns = await prisma.run.findMany({
    where: {
      executionRunId: { not: null },
      executionRunExpiresAt: { lt: now },
    },
    select: { id: true },
  });

  let cleared = 0;
  for (const run of staleRuns) {
    await clearExecutionLock(run.id, "platform:sweeper");
    cleared += 1;
  }

  return cleared;
}
