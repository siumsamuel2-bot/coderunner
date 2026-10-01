import { z } from "zod";
import { t } from "../trpc";

export const runsRouter = t.router({
  create: t.procedure
    .input(
      z.object({
        challengeId: z.string(),
        promptChain: z.optional(z.any()),
        toolLog: z.optional(z.any()),
      })
    )
    .mutation(() => {
      return null;
    }),

  listByUser: t.procedure.query(() => {
    return [] as const;
  }),

  listByChallenge: t.procedure
    .input(z.object({ challengeId: z.string() }))
    .query(() => {
      return [] as const;
    }),

  getLeaderboard: t.procedure.query(() => {
    return [] as const;
  }),

  healthCheck: t.procedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  errorBoundary: t.procedure
    .input(z.object({ errorId: z.string() }))
    .query(({ input }) => {
      return { errorId: input.errorId, status: "monitored" };
    }),
});