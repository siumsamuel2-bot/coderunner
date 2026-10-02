import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { t } from "../trpc";

export const verificationsRouter = t.router({
  create: t.procedure
    .input(
      z.object({
        runId: z.string().min(1),
        status: z.enum(["passed", "failed"]).default("passed"),
        testOutput: z.string().optional(),
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
      return ctx.prisma.verification.upsert({
        where: { runId: input.runId },
        update: {
          status: input.status,
          testOutput: input.testOutput,
          verifiedAt: new Date(),
        },
        create: {
          runId: input.runId,
          status: input.status,
          testOutput: input.testOutput,
        },
      });
    }),

  getStatus: t.procedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(({ input, ctx }) => {
      return ctx.prisma.verification.findUnique({
        where: { runId: input.runId },
      });
    }),
});
