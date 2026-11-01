import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recoverStaleJobs } from '@/lib/verification/queue';
import { recoverStaleRuns } from '@/lib/verification/service';

type JobRow = {
  id: string;
  runId: string;
  challengeId: string;
  targetUrl: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RunRow = {
  id: string;
  userId: string;
  challengeId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  elapsedMs: number | null;
  attempt: number;
  createdAt: Date;
  updatedAt: Date;
};

function makeDb() {
  const jobs: JobRow[] = [];
  const runs: RunRow[] = [];

  return {
    verificationJob: {
      findMany: async ({ where }: { where: { status: string; updatedAt: { lt: Date } } }) =>
        jobs.filter((j) => j.status === where.status && j.updatedAt < where.updatedAt.lt),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<JobRow> }) => {
        let count = 0;
        for (const id of where.id.in) {
          const idx = jobs.findIndex((j) => j.id === id);
          if (idx !== -1) {
            Object.assign(jobs[idx], data, { updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    },
    run: {
      findMany: async ({ where }: { where: { status: string; updatedAt: { lt: Date } } }) =>
        runs.filter((r) => r.status === where.status && r.updatedAt < where.updatedAt.lt),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<RunRow> }) => {
        let count = 0;
        for (const id of where.id.in) {
          const idx = runs.findIndex((r) => r.id === id);
          if (idx !== -1) {
            Object.assign(runs[idx], data, { updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    },
    getJobs: () => jobs,
    getRuns: () => runs,
  };
}

const NOW = new Date('2026-11-01T12:00:00Z');
const HALF_HOUR_AGO = new Date(NOW.getTime() - 30 * 60 * 1000);
const THIRTY_ONE_MIN_AGO = new Date(NOW.getTime() - 31 * 60 * 1000);
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

function job(id: string, overrides: Partial<JobRow> = {}): JobRow {
  return {
    id,
    runId: `run-${id}`,
    challengeId: 'challenge-1',
    targetUrl: 'https://example.app',
    status: 'processing',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function run(id: string, overrides: Partial<RunRow> = {}): RunRow {
  return {
    id,
    userId: 'user-1',
    challengeId: 'challenge-1',
    status: 'verifying',
    startedAt: new Date(),
    endedAt: null,
    elapsedMs: null,
    attempt: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recoverStaleJobs (verification queue hardening)', () => {
  it('resets processing jobs older than the default 30-minute threshold to pending', async () => {
    const db = makeDb();
    db.getJobs().push(job('job-stale', { updatedAt: THIRTY_ONE_MIN_AGO }), job('job-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleJobs(undefined, db as never);

    expect(recovered).toBe(1);
    const stale = db.getJobs().find((j) => j.id === 'job-stale');
    const fresh = db.getJobs().find((j) => j.id === 'job-fresh');
    expect(stale?.status).toBe('pending');
    expect(stale?.error).toBe(null);
    expect(fresh?.status).toBe('processing');
  });

  it('returns 0 when there are no stale processing jobs', async () => {
    const db = makeDb();
    db.getJobs().push(job('job-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleJobs(undefined, db as never);

    expect(recovered).toBe(0);
    expect(db.getJobs()[0]?.status).toBe('processing');
  });

  it('uses a custom threshold when provided', async () => {
    const db = makeDb();
    db.getJobs().push(job('job-stale', { updatedAt: TWO_HOURS_AGO }), job('job-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleJobs(60 * 60 * 1000, db as never);

    expect(recovered).toBe(1);
    expect(db.getJobs().find((j) => j.id === 'job-stale')?.status).toBe('pending');
    expect(db.getJobs().find((j) => j.id === 'job-fresh')?.status).toBe('processing');
  });

  it('does not touch completed or failed jobs', async () => {
    const db = makeDb();
    db.getJobs().push(
      job('job-completed', { status: 'completed', updatedAt: TWO_HOURS_AGO }),
      job('job-failed', { status: 'failed', updatedAt: TWO_HOURS_AGO })
    );

    const recovered = await recoverStaleJobs(undefined, db as never);

    expect(recovered).toBe(0);
    expect(db.getJobs().find((j) => j.id === 'job-completed')?.status).toBe('completed');
    expect(db.getJobs().find((j) => j.id === 'job-failed')?.status).toBe('failed');
  });
});

describe('recoverStaleRuns (verification run hardening)', () => {
  it('resets verifying runs older than the default 30-minute threshold to submitted', async () => {
    const db = makeDb();
    db.getRuns().push(run('run-stale', { updatedAt: THIRTY_ONE_MIN_AGO }), run('run-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleRuns(undefined, db as never);

    expect(recovered).toBe(1);
    const stale = db.getRuns().find((r) => r.id === 'run-stale');
    const fresh = db.getRuns().find((r) => r.id === 'run-fresh');
    expect(stale?.status).toBe('submitted');
    expect(fresh?.status).toBe('verifying');
  });

  it('returns 0 when there are no stale verifying runs', async () => {
    const db = makeDb();
    db.getRuns().push(run('run-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleRuns(undefined, db as never);

    expect(recovered).toBe(0);
    expect(db.getRuns()[0]?.status).toBe('verifying');
  });

  it('uses a custom threshold when provided', async () => {
    const db = makeDb();
    db.getRuns().push(run('run-stale', { updatedAt: TWO_HOURS_AGO }), run('run-fresh', { updatedAt: HALF_HOUR_AGO }));

    const recovered = await recoverStaleRuns(60 * 60 * 1000, db as never);

    expect(recovered).toBe(1);
    expect(db.getRuns().find((r) => r.id === 'run-stale')?.status).toBe('submitted');
    expect(db.getRuns().find((r) => r.id === 'run-fresh')?.status).toBe('verifying');
  });

  it('does not touch runs in other statuses', async () => {
    const db = makeDb();
    db.getRuns().push(
      run('run-verified', { status: 'verified', updatedAt: TWO_HOURS_AGO }),
      run('run-submitted', { status: 'submitted', updatedAt: TWO_HOURS_AGO })
    );

    const recovered = await recoverStaleRuns(undefined, db as never);

    expect(recovered).toBe(0);
    expect(db.getRuns().find((r) => r.id === 'run-verified')?.status).toBe('verified');
    expect(db.getRuns().find((r) => r.id === 'run-submitted')?.status).toBe('submitted');
  });
});
