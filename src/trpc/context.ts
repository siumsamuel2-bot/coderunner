import { prisma } from '@/lib/prisma';

export interface Context {
  prisma: typeof prisma;
}

export function createContext(): Context {
  return { prisma };
}
