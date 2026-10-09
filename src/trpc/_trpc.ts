import { initTRPC } from '@trpc/server';
import * as Sentry from '@sentry/nextjs';

import type { Context } from './context';

const t = initTRPC.context<Context>().create();

// Report every tRPC error to Sentry (server-side). No-op without DSN.
const sentryErrorMiddleware = t.middleware(async ({ next, path, type }) => {
  const result = await next();
  if (!result.ok) {
    Sentry.captureException(result.error, { tags: { source: 'trpc', path, type } });
  }
  return result;
});

export const router = t.router;
export const procedure = t.procedure.use(sentryErrorMiddleware);
export const createCallerFactory = t.createCallerFactory;
