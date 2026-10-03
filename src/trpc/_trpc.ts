import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/prisma';
import type { Context } from './context';

export const router = TRPCInit.router;
export const procedure = TRPCInit.procedure;

const TRPCInit = TRPC.server().createContext<Context>({
  async opts() {
    return {
      prisma,
    };
  }
});

export type AppRouter = typeof appRouter;
