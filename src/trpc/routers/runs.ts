import { z } from 'zod';

import { router, procedure } from '../_trpc';
import { dedupeBestPerUser } from '@/lib/leaderboard';

// SPE-144 audit: `create` (unauthenticated, client-supplied userId — identity
// forgery), `listByUser` and `listByChallenge` (dead code leaking
// promptChain/toolLog) were removed. Run creation goes through the
// session-authenticated REST route (/api/runs/start) only.
export const runsRouter = router({
  getLeaderboard: procedure
    .input(
      z
        .object({
          challengeId: z.string().optional(),
          period: z.enum(['all-time', '24h', '7d', '30d']).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Verified runs only. Best-per-user dedup (SPE-135 dep D2, SPE-127
      // §2.5): one rank per player — a user's slower runs never crowd the
      // board. Catalog volume is small (one row per verified submission),
      // so we fetch all and dedupe in JS (src/lib/leaderboard.ts).
      const now = new Date();
      let periodFilter: Date | undefined;
      if (input?.period === '24h') {
        periodFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (input?.period === '7d') {
        periodFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (input?.period === '30d') {
        periodFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      const runs = await ctx.prisma.run.findMany({
        where: {
          status: 'verified',
          elapsedMs: { not: null },
          ...(periodFilter ? { endedAt: { gte: periodFilter } } : {}),
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        select: {
          id: true,
          userId: true,
          challengeId: true,
          elapsedMs: true,
          score: true,
          endedAt: true,
          user: {
            select: { id: true, name: true, image: true },
          },
          challenge: {
            select: { id: true, slug: true, title: true, difficulty: true },
          },
        },
        orderBy: { elapsedMs: 'asc' },
      });
      return dedupeBestPerUser(runs);
    }),
});
