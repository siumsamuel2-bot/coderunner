import { z } from 'zod';

import { router, procedure } from '../_trpc';
import { dedupeBestPerUser } from '@/lib/leaderboard';

export const runsRouter = router({
  create: procedure
    .input(
      z.object({
        userId: z.string(),
        challengeId: z.string(),
        promptChain: z.unknown().optional(),
        toolLog: z.unknown().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.run.create({
        data: {
          userId: input.userId,
          challengeId: input.challengeId,
          promptChain: input.promptChain as object | undefined,
          toolLog: input.toolLog as object | undefined,
        },
      });
    }),
  listByUser: procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.run.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
      });
    }),
  listByChallenge: procedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.run.findMany({
        where: { challengeId: input.challengeId },
        orderBy: { elapsedMs: 'asc' },
      });
    }),
  getLeaderboard: procedure
    .input(z.object({ challengeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Verified runs only. Best-per-user dedup (SPE-135 dep D2, SPE-127
      // §2.5): one rank per player — a user's slower runs never crowd the
      // board. Catalog volume is small (one row per verified submission),
      // so we fetch all and dedupe in JS (src/lib/leaderboard.ts).
      const runs = await ctx.prisma.run.findMany({
        where: {
          status: 'verified',
          elapsedMs: { not: null },
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        include: {
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
