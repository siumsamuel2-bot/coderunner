import { prisma } from './prisma';

export interface Context {
  prisma: typeof prisma;
}
