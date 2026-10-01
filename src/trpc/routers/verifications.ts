import { z } from "zod";
import { t } from "../trpc";

export const verificationsRouter = t.router({
  create: t.procedure
    .input(z.object({ runId: z.string() }))
    .mutation(() => {
      return null;
    }),

  getStatus: t.procedure
    .input(z.object({ runId: z.string() }))
    .query(() => {
      return null;
    }),
});