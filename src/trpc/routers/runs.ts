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
        orderBy: { elapsedMs: 'asc' },
      });
    }),
  getLeaderboard: procedure
    .input(z.object({ challengeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.run.findMany({
        where: {
          status: 'verified',
          elapsedMs: { not: null },
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
          challenge: true,
        },
        orderBy: { elapsedMs: 'asc' },
        take: 50,
      });
    }),
});
