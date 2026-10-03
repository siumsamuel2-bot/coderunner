import { z } from 'zod';

import { router, procedure } from '../_trpc';

export const challengesRouter = router({
  list: procedure.query(async ({ ctx }) => {
    return ctx.prisma.challenge.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }),
  getBySlug: procedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.challenge.findUnique({
        where: { slug: input.slug },
      });
    }),
});
