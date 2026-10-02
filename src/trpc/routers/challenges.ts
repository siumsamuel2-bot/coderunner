import { z } from "zod";
import { t } from "../trpc";

export const challengesRouter = t.router({
  list: t.procedure.query(({ ctx }) => {
    return ctx.prisma.challenge.findMany({
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
    });
  }),

  getBySlug: t.procedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input, ctx }) => {
      return ctx.prisma.challenge.findUnique({
        where: { slug: input.slug },
      });
    }),
});
