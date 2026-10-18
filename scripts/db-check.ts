import { prisma } from "@/lib/prisma-node";

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("Tables:", tables.map((t: { tablename: string }) => t.tablename).join(", "));
  const challenges = await prisma.challenge.count();
  console.log(`Prisma client connected. Challenge rows: ${challenges}`);
}

main()
  .catch((error) => {
    console.error("DB check failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
