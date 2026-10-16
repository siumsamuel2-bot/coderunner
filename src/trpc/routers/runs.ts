import { z } from "zod";

import { router, protectedProcedure } from "../_trpc";

export const runsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        challengeId: z.string(),
        // elapsedMs removed - now computed server-side from startedAt/endedAt (P0-2)
        promptChain: z.unknown().optional(),
        toolLog: z.unknown().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.run.create({
        data: {
          userId: ctx.userId, // Derived from session, never trust client
          challengeId: input.challengeId,
          // elapsedMs: input.elapsedMs ?? null, // REMOVED - P0-2: server-side timing
          promptChain: input.promptChain as object | undefined,
          toolLog: input.toolLog as object | undefined,
        },
      });
    }),
  listByUser: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Users can only see their own runs unless admin
      const targetUserId = input.userId ?? ctx.userId;
      return ctx.prisma.run.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: "desc" },
      });
    }),
  listByChallenge: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.run.findMany({
        where: { challengeId: input.challengeId },
        orderBy: { elapsedMs: "asc" },
      });
    }),
  getLeaderboard: protectedProcedure
    .input(z.object({ challengeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.run.findMany({
        where: {
          status: "verified",
          elapsedMs: { not: null },
          ...(input?.challengeId ? { challengeId: input.challengeId } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
          challenge: true,
          verification: true,
        },
        orderBy: { elapsedMs: "asc" },
        take: 50,
      });
    }),
});
