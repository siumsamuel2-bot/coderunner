import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  // Railway free tier sleeps the Postgres service on idle; waking it can take
  // 30-90s. Allow long connect/pool timeouts so the first request after an idle
  // period waits for Postgres to wake instead of 500ing (SPE-86 crash loop).
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 120_000,
    idleTimeoutMillis: 60_000,
    max: 3,
    keepAlive: true,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
