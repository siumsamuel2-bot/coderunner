import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma-node/client";

// Node-host twin of src/lib/prisma.ts. The app client is generated with
// runtime = "workerd" (static .wasm import for Cloudflare Workers), which
// cannot load under plain Node, so Node-only consumers (prisma/seed.ts,
// scripts/db-check.ts, scripts/verification-worker.ts -> verification
// runner/service/queue) use this client instead. See SPE-123.
const globalForPrisma = globalThis as unknown as { prismaNode?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaNeon({ connectionString });
  const client = new PrismaClient({ adapter });
  return client;
}

export const prisma = globalForPrisma.prismaNode ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaNode = prisma;
