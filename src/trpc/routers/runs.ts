import { router, procedure } from '../_trpc';
import { prisma } from '../../lib/prisma';

export const runsRouter = router({
  create: procedure.input(({ userId, challengeId, elapsedMs, promptChain, toolLog }: { 
    userId: string; 
    challengeId: string; 
    elapsedMs: number; 
    promptChain: any; 
    toolLog: any 
  })).mutation(async ({ input }) => {
    return await prisma.run.create({
      data: {
        userId: input.userId,
        challengeId: input.challengeId,
        elapsedMs: input.elapsedMs,
        promptChain: input.promptChain,
        toolLog: input.toolLog
      }
    });
  }),
  listByUser: procedure.input(({ userId }: { userId: string })).query(async ({ input }) => {
    return await prisma.run.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: 'desc' }
    });
  }),
  listByChallenge: procedure.input(({ challengeId }: { challengeId: string })).query(async ({ input }) => {
    return await prisma.run.findMany({
      where: { challengeId: input.challengeId },
      orderBy: { elapsedMs: 'asc' }
    });
  }),
  getLeaderboard: procedure.input(({ challengeId }: { challengeId: string })).query(async ({ input }) => {
    return await prisma.run.findMany({
      where: { challengeId: input.challengeId },
      orderBy: { elapsedMs: 'asc' },
      take: 10
    });
  })
});
