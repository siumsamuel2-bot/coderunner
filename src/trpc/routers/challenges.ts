import { z } from "zod";
import { t } from "../trpc";

export const challengesRouter = t.router({
  list: t.procedure.query(() => {
    return [] as const;
  }),

  getBySlug: t.procedure
    .input(z.object({ slug: z.string() }))
    .query(() => {
      return null;
    }),
});