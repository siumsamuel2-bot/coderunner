import { router, procedure } from '../_trpc';
import { prisma } from '../../lib/prisma';

export const challengesRouter = router({
  list: procedure.query(async () => {
    return await prisma.challenge.findMany();
  }),
  getBySlug: procedure.input(({ slug }: { slug: string })).query(async ({ input }) => {
    return await prisma.challenge.findUnique({
      where: { slug: input.slug }
    });
  })
});
