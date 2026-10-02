import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { t } from "../trpc";

const LEADERBOARD_SIZE = 50;

export const runsRouter = t.router({
  create: t.procedure
    .input(
      z.object({
        challengeId: z.string().min(1),
        promptChain: z.unknown().optional(),
        toolLog: z.unknown().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in to start a run",
        });
      }
      const challenge = await ctx.prisma.challenge.findUnique({
        where: { id: input.challengeId },
        select: { id: true },
      });
      if (!challenge) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found" });
      }
      return ctx.prisma.run.create({
        data: {
          userId,
          challengeId: input.challengeId,
          status: "in_progress",
          promptChain: input.promptChain as Prisma.InputJsonValue | undefined,
          toolLog: input.toolLog as Prisma.InputJsonValue | undefined,
        },
        include: { challenge: true },
      });
    }),

  complete: t.procedure
    .input(
      z.object({
        runId: z.string().min(1),
        status: z.enum(["completed", "failed"]).default("completed"),
        elapsedMs: z.number().int().nonnegative().optional(),
        toolLog: z.unknown().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        select: { id: true },
      });
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }
      return ctx.prisma.run.update({
        where: { id: input.runId },
        data: {
          status: input.status,
          endedAt: new Date(),
          elapsedMs: input.elapsedMs,
          toolLog: input.toolLog as Prisma.InputJsonValue | undefined,
        },
        include: { verification: true },
      });
    }),

  listByUser: t.procedure.query(({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sign in to view your runs",
      });
    }
    return ctx.prisma.run.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: {
        challenge: { select: { slug: true, title: true, difficulty: true } },
        verification: true,
      },
    });
  }),

  listByChallenge: t.procedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input, ctx }) => {
      return ctx.prisma.run.findMany({
        where: { challenge: { slug: input.slug }, status: "completed" },
        orderBy: { elapsedMs: "asc" },
        include: {
          user: { select: { id: true, name: true, image: true } },
          verification: { select: { status: true } },
        },
      });
    }),

  getLeaderboard: t.procedure.query(({ ctx }) => {
    return ctx.prisma.run.findMany({
      where: {
        status: "completed",
        elapsedMs: { not: null },
        verification: { status: "passed" },
      },
      orderBy: { elapsedMs: "asc" },
      take: LEADERBOARD_SIZE * 4,
      select: {
        id: true,
        elapsedMs: true,
        endedAt: true,
        user: { select: { id: true, name: true, image: true } },
        challenge: { select: { slug: true, title: true, difficulty: true } },
      },
    });
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
