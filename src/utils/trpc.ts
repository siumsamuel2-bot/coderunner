import { appRouter } from '@/trpc/appRouter';
import { createCallerFactory } from '@/trpc/_trpc';
import { createContext } from '@/trpc/context';

/**
 * Server-side tRPC caller for use in Server Components and route handlers.
 * Calls procedures directly against Prisma without an HTTP hop.
 */
export const serverTrpc = createCallerFactory(appRouter)(createContext());
