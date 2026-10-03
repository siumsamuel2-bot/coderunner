import { router, procedure } from '../_trpc';
import { prisma } from '../../lib/prisma';

export const verificationsRouter = router({
  create: procedure.input(({ runId, status, testOutput }: { 
    runId: string; 
    status: string; 
    testOutput: string | null 
  })).mutation(async ({ input }) => {
    return await prisma.verification.create({
      data: {
        runId: input.runId,
        status: input.status,
        testOutput: input.testOutput
      }
    });
  }),
  getStatus: procedure.input(({ runId }: { runId: string })).query(async ({ input }) => {
    return await prisma.verification.findUnique({
      where: { runId: input.runId }
    });
  })
});
