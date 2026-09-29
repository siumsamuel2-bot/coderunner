import { prisma } from "@/lib/prisma";

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  console.log("Tables:", tables.map((t) => t.name).join(", "));
  const challenges = await prisma.challenge.count();
  console.log(`Prisma client connected. Challenge rows: ${challenges}`);
}

main()
  .catch((error) => {
    console.error("DB check failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
