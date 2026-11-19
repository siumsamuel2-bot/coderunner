import { z } from 'zod';

import { router, procedure } from '../_trpc';

export const runsRouter = router({
  create: procedure
    .input(
      z.object({
        userId: z.string(),
        challengeId: z.string(),
        elapsedMs: z.number().optional(),
        promptChain: z.unknown().optional(),
        toolLog: z.unknown().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.run.create({
        data: {
          userId: input.userId,
          challengeId: input.challengeId,
          elapsedMs: input.elapsedMs ?? null,
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
        orderBy: { score: 'desc', elapsedMs: 'asc' },
      });
    }),
  getLeaderboard: procedure
    .input(
      z
        .object({
          challengeId: z.string().optional(),
          period: z.enum(['all', 'day', 'week', 'month']).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? 'all';
      const now = new Date();
      let periodFilter: Date | undefined;
      if (period === 'day') {
        periodFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (period === 'week') {
        periodFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        periodFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      return ctx.prisma.run.findMany({
        where: {
          status: 'verified',
          score: { not: null },
          ...(periodFilter ? { createdAt: { gte: periodFilter } } : {}),
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
          challenge: true,
          verification: true,
          speedrun: true,
        },
        orderBy: [{ score: 'desc' }, { elapsedMs: 'asc' }],
        take: 50,
      });
    }),
  getWorldRecords: procedure
    .input(z.object({ challengeId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.worldRecord.findMany({
        where: {
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
          challenge: true,
        },
        orderBy: [{ score: 'desc' }],
        take: 50,
      });
    }),
  getPersonalRecords: procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.personalRecord.findMany({
        where: { userId: input.userId },
        include: {
          challenge: true,
        },
        orderBy: [{ bestScore: 'desc' }],
        take: 50,
      });
    }),
});
