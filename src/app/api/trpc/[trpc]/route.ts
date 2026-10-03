import { createNextApiHandler } from '@trpc/server/adapters/next';
import { appRouter } from '@/src/trpc/appRouter';
import { prisma } from '@/src/lib/prisma';

export default createNextApiHandler({
  router: appRouter,
  createContext: () => ({ prisma }),
});
