import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// In-memory DB backing the mocked prisma client. Declared via vi.hoisted so
// the module factories below can close over it before test-file body runs.
const store = vi.hoisted(() => ({ runs: [] as RunRow[] }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/verification/queue', () => ({
  addVerificationJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    run: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        store.runs.find((r) => r.id === where.id) ?? null
      ),
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            challengeId: string;
            status: { in: string[] };
          };
        }) =>
          store.runs.find(
            (r) =>
              r.userId === where.userId &&
              r.challengeId === where.challengeId &&
              where.status.in.includes(r.status)
          ) ?? null
      ),
      count: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; challengeId: string };
        }) =>
          store.runs.filter(
            (r) =>
              r.userId === where.userId && r.challengeId === where.challengeId
          ).length
      ),
      create: vi.fn(async ({ data }: { data: Omit<RunRow, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const row: RunRow = {
          id: `run-${store.runs.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.runs.push(row);
        return row;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<RunRow>;
        }) => {
          const row = store.runs.find((r) => r.id === where.id);
          if (!row) throw new Error(`Run ${where.id} not found`);
          Object.assign(row, data, { updatedAt: new Date() });
          return row;
        }
      ),
    },
    verification: {
      upsert: vi.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { runId: string };
          update?: Record<string, unknown>;
          create?: Record<string, unknown>;
        }) => ({ runId: where.runId, ...(update ?? create) })
      ),
    },
  },
}));

import { auth } from '@/auth';
import { POST as startRun } from '@/app/api/runs/start/route';
import { POST as abandonRun } from '@/app/api/runs/[runId]/abandon/route';
import { POST as submitRun } from '@/app/api/runs/route';
import { POST as verificationWebhook } from '@/app/api/verification-webhook/route';

const CHALLENGE = 'challenge-1';

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function abandonRequest(runId: string): {
  request: Request;
  ctx: { params: Promise<{ runId: string }> };
} {
  return {
    request: jsonRequest(`http://localhost/api/runs/${runId}/abandon`, {}),
    ctx: { params: Promise.resolve({ runId }) },
  };
}

async function start(): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await startRun(
    jsonRequest('http://localhost/api/runs/start', { challengeId: CHALLENGE })
  );
  return { ok: res.ok, status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function abandon(runId: string) {
  const { request, ctx } = abandonRequest(runId);
  const res = await abandonRun(request, ctx);
  return { ok: res.ok, status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function submit(runId: string, solutionUrl = 'https://example.app') {
  const res = await submitRun(
    jsonRequest('http://localhost/api/runs', { runId, solutionUrl })
  );
  return { ok: res.ok, status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function webhook(runId: string, verdict: 'pass' | 'fail') {
  const res = await verificationWebhook(
    new Request('http://localhost/api/verification-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.VERIFICATION_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({ runId, status: verdict, testOutput: 'ok' }),
    })
  );
  return { ok: res.ok, status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  store.runs.length = 0;
  process.env.VERIFICATION_WEBHOOK_SECRET = 'test-secret';
  vi.mocked(auth).mockResolvedValue({
    user: { id: 'user-1' },
  } as never);
});

describe('POST /api/runs/[runId]/abandon (SPE-128)', () => {
  it('401 without a session (no unauthenticated trust paths, SPE-118)', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { status } = await abandon('run-x');
    expect(status).toBe(401);
  });

  it('404 for an unknown run', async () => {
    const { status } = await abandon('missing');
    expect(status).toBe(404);
  });

  it('403 when the caller is not the run owner', async () => {
    const started = await start();
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-2' },
    } as never);
    const res = await abandon(started.body.id as string);
    expect(res.status).toBe(403);
  });

  it('transitions in_progress -> abandoned and stamps endedAt', async () => {
    const started = await start();
    const runId = started.body.id as string;

    const res = await abandon(runId);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('abandoned');
    expect(typeof res.body.endedAt).toBe('string');
    expect(new Date(res.body.endedAt as string).getTime()).toBeGreaterThan(0);
  });

  it('409 on an already-abandoned run (no double abandon)', async () => {
    const started = await start();
    const runId = started.body.id as string;
    await abandon(runId);

    const res = await abandon(runId);
    expect(res.status).toBe(409);
    expect(String(res.body.error)).toContain('abandoned');
  });

  it('409 for submitted and verified runs (verification pipeline owns them)', async () => {
    const started = await start();
    const runId = started.body.id as string;

    await submit(runId);
    const resSubmitted = await abandon(runId);
    expect(resSubmitted.status).toBe(409);

    await webhook(runId, 'pass');
    const resVerified = await abandon(runId);
    expect(resVerified.status).toBe(409);
  });
});

describe('E2E: start -> abandon -> start again -> submit -> verify', () => {
  it('full flow: abandon releases the challenge; abandoned runs consume an attempt slot', async () => {
    // 1. Start attempt #1.
    const first = await start();
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('in_progress');
    expect(first.body.attempt).toBe(1);
    const firstRunId = first.body.id as string;

    // 2. Leave-and-return: a second start while the run is active must 409
    //    (not create a parallel run) and hand back runId + status for resume.
    const conflict = await start();
    expect(conflict.status).toBe(409);
    expect(conflict.body.runId).toBe(firstRunId);
    expect(conflict.body.status).toBe('in_progress');

    // 3. Abandon the stuck run.
    const abandoned = await abandon(firstRunId);
    expect(abandoned.status).toBe(200);
    expect(abandoned.body.status).toBe('abandoned');

    // 4. Starting again succeeds — no 409 after abandon — and the abandoned
    //    attempt is counted (attempt #2).
    const second = await start();
    expect(second.status).toBe(201);
    expect(second.body.attempt).toBe(2);
    const secondRunId = second.body.id as string;

    // 5. Submit the new attempt: server-side timing, transitions to submitted.
    await new Promise((resolve) => setTimeout(resolve, 15));
    const submitted = await submit(secondRunId);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('submitted');
    expect(submitted.body.elapsedMs).toBeGreaterThan(0);

    // 6. Verification completes via webhook -> verified.
    const verified = await webhook(secondRunId, 'pass');
    expect(verified.status).toBe(200);
    const afterWebhook = await store.runs.find((r) => r.id === secondRunId);
    expect(afterWebhook?.status).toBe('verified');
    // Server-side elapsedMs is not overwritten by the harness (SPE-119).
    expect(afterWebhook?.elapsedMs).toBe(submitted.body.elapsedMs);
  });

  it('leave-and-return is unaffected by abandoned runs (no ghost 409s)', async () => {
    // A previously abandoned run must never resurface as a conflict.
    const first = await start();
    await abandon(first.body.id as string);

    for (let i = 0; i < 3; i += 1) {
      const res = await start();
      expect(res.status).toBe(201);
      await abandon(res.body.id as string);
    }

    // Other users' runs never conflict.
    const mine = await start();
    expect(mine.status).toBe(201);
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-2' },
    } as never);
    const theirs = await start();
    expect(theirs.status).toBe(201);
  });

  it('abandoned runs do not appear as active and never block submit/verify paths', async () => {
    const started = await start();
    const runId = started.body.id as string;
    await abandon(runId);

    // Submitting an abandoned run is rejected (it is not in_progress).
    const res = await submit(runId);
    expect(res.status).toBe(409);

    // A stale webhook report cannot clobber the abandoned terminal state.
    const stale = await webhook(runId, 'pass');
    expect(stale.status).toBe(409);
    const row = store.runs.find((r) => r.id === runId);
    expect(row?.status).toBe('abandoned');
  });
});
