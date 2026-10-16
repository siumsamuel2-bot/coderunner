
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { neon } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Errors worth retrying: transient connection failures from Neon (P1001/P1002 =
// can't reach/timed out, ECONNREFUSED/ECONNRESET/ETIMEDOUT = socket-level
// failures from dropped idle connections in the pool).
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1017"]);
const RETRYABLE_MESSAGES = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "Connection terminated"];
const MAX_ATTEMPTS = 5;

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code && RETRYABLE_CODES.has(e.code)) return true;
  const msg = e?.message ?? "";
  return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  const run = async (): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
      // Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s
      await sleep(2 ** attempt * 250 + Math.random() * 250);
      return run();
    }
  };
  return run();
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  // Neon uses the HTTP driver (@prisma/adapter-neon + @neondatabase/serverless)
  // which works on Cloudflare Pages edge runtime (no Node TCP needed).
  const sql = neon(connectionString);
  const adapter = new PrismaNeon(sql);
  const client = new PrismaClient({ adapter });
  // Retry transient connection errors so a sleeping/waking Neon yields a slow
  // response instead of a 500.
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          return withRetry(() => query(args));
        },
      },
    },
  }) as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
