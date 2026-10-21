import { initTRPC, TRPCError } from '@trpc/server';
import * as Sentry from '@sentry/nextjs';

import type { Context } from './context';
import { auth } from '@/auth';

const t = initTRPC.context<Context>().create({
  // SPE-144: never leak raw driver/Prisma error details to API callers.
  // Uncaught non-TRPCError exceptions surface as INTERNAL_SERVER_ERROR with
  // the original message (e.g. constraint names, SQL) — mask those in
  // production. Sentry still receives the full error via the middleware
  // below. Intentional TRPCErrors (UNAUTHORIZED, NOT_FOUND, BAD_REQUEST
  // from zod, ...) keep their messages in every environment.
  errorFormatter({ shape, error }) {
    if (error.code === 'INTERNAL_SERVER_ERROR' && process.env.NODE_ENV === 'production') {
      return { ...shape, message: 'An unexpected error occurred.', data: { ...shape.data, stack: undefined } };
    }
    return shape;
  },
});

// Report every tRPC error to Sentry (server-side). No-op without DSN.
const sentryErrorMiddleware = t.middleware(async ({ next, path, type }) => {
  const result = await next();
  if (!result.ok) {
    Sentry.captureException(result.error, { tags: { source: 'trpc', path, type } });
  }
  return result;
});

const isAuthed = t.middleware(async ({ ctx, next }) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { ...ctx, session, userId: session.user.id },
  });
});

export const router = t.router;
export const procedure = t.procedure.use(sentryErrorMiddleware);
// Every mutation MUST be built on protectedProcedure: identity is derived
// from the session, never from client input (SPE-144).
export const protectedProcedure = t.procedure
  .use(sentryErrorMiddleware)
  .use(isAuthed);
export const createCallerFactory = t.createCallerFactory;
