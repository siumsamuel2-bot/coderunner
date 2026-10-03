import { z } from 'zod';

import { router, procedure } from '../_trpc';

export const verificationsRouter = router({
  create: procedure
    .input(
      z.object({
        runId: z.string(),
        status: z.string(),
        testOutput: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.verification.create({
        data: {
          runId: input.runId,
          status: input.status,
          testOutput: input.testOutput ?? null,
        },
      });
    }),
  getStatus: procedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.verification.findUnique({
        where: { runId: input.runId },
      });
    }),
});
