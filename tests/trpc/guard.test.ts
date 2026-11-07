import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/auth';
import { createCallerFactory, protectedProcedure, router } from '@/trpc/_trpc';
import { appRouter } from '@/trpc/appRouter';

// SPE-144 regression guard: the tRPC surface must contain zero mutations.
// Run creation lives in the session-authenticated REST route
// (/api/runs/start); verification writes live behind the signed webhook.
// Any future mutation must be built on protectedProcedure (session-derived
// identity), never on the public `procedure`.
describe('tRPC surface guard', () => {
  it('exposes only query procedures', () => {
    const procedures = appRouter._def.procedures as Record<
      string,
      { _def: { type?: string } }
    >;
    const paths = Object.keys(procedures);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(procedures[path]._def.type, `${path} must be a query`).toBe('query');
    }
  });
});

describe('protectedProcedure', () => {
  const testRouter = router({
    whoami: protectedProcedure.query(({ ctx }) => ({ userId: ctx.userId })),
  });
  const makeCaller = () =>
    createCallerFactory(testRouter)({ prisma: {} as never });

  it('rejects without a session (UNAUTHORIZED)', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    await expect(makeCaller().whoami()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('derives userId from the session, never from client input', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } });
    await expect(makeCaller().whoami()).resolves.toEqual({ userId: 'user-1' });
  });
});
