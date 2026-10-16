import { initTRPC, TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/nextjs";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

// Report every tRPC error to Sentry (server-side). No-op without DSN.
const sentryErrorMiddleware = t.middleware(async ({ next, path, type }) => {
  const result = await next();
  if (!result.ok) {
    Sentry.captureException(result.error, { tags: { source: "trpc", path, type } });
  }
  return result;
});

// Protected procedure - requires authenticated user
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

// Admin procedure - requires admin role
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const router = t.router;
export const procedure = t.procedure.use(sentryErrorMiddleware);
export const protectedProcedure = procedure.use(isAuthed);
export const adminProcedure = procedure.use(isAdmin);
export const createCallerFactory = t.createCallerFactory;
