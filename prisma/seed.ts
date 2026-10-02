import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const challenges = [
  {
    slug: "calculator",
    title: "Calculator",
    description:
      "Build a working calculator app with +, -, *, /, clear, and decimal support.",
    difficulty: "easy",
    estimatedMinutes: 15,
    testSpec: {
      checks: [
        { id: "renders", type: "dom", target: "calculator-root" },
        { id: "add", type: "interaction", op: "2+3", expected: "5" },
        { id: "subtract", type: "interaction", op: "9-4", expected: "5" },
        { id: "multiply", type: "interaction", op: "6*7", expected: "42" },
        { id: "divide", type: "interaction", op: "8/2", expected: "4" },
        { id: "decimal", type: "interaction", op: "0.1+0.2", expected: "0.3" },
        { id: "clear", type: "interaction", action: "clear", expected: "0" },
      ],
    },
    acceptanceCriteria:
      "All four operations work, clear resets state, decimal input supported, no eval() on client.",
  },
  {
    slug: "todo-auth",
    title: "Todo app with auth",
    description:
      "Build a todo app with user login and full create/read/update/delete of todos.",
    difficulty: "medium",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "login", type: "auth", flow: "login", expected: "session" },
        { id: "create", type: "api", method: "POST", path: "/api/todos", expected: 201 },
        { id: "read", type: "api", method: "GET", path: "/api/todos", expected: "list" },
        { id: "update", type: "api", method: "PATCH", path: "/api/todos/:id", expected: 200 },
        { id: "delete", type: "api", method: "DELETE", path: "/api/todos/:id", expected: 200 },
        { id: "protected", type: "auth", path: "/api/todos", unauthenticated: 401 },
      ],
    },
    acceptanceCriteria:
      "Unauthenticated requests are rejected with 401; CRUD round-trips persist per user.",
  },
  {
    slug: "pdf-analyzer",
    title: "PDF analyzer",
    description:
      "Build a tool that accepts a PDF and extracts text and metadata.",
    difficulty: "hard",
    estimatedMinutes: 45,
    testSpec: {
      checks: [
        { id: "upload", type: "interaction", target: "pdf-upload" },
        { id: "text-extract", type: "output", contains: "extracted text" },
        { id: "metadata", type: "output", fields: ["title", "pages", "author"] },
        { id: "invalid-input", type: "edge", input: "not-a-pdf", expected: "error" },
      ],
    },
    acceptanceCriteria:
      "Text extraction works on a sample PDF, metadata fields surface, non-PDF input yields a friendly error.",
  },
  {
    slug: "landing-page",
    title: "Landing page that converts",
    description:
      "Build a marketing landing page with hero, features, CTA, and pricing section.",
    difficulty: "medium",
    estimatedMinutes: 25,
    testSpec: {
      checks: [
        { id: "hero", type: "dom", target: "hero" },
        { id: "features", type: "dom", target: "features" },
        { id: "cta", type: "dom", target: "cta" },
        { id: "pricing", type: "dom", target: "pricing" },
        { id: "mobile", type: "viewport", width: 375, expected: "no-horizontal-scroll" },
      ],
    },
    acceptanceCriteria:
      "All four sections render, CTA is above the fold on desktop, page is mobile-responsive.",
  },
  {
    slug: "chatbot",
    title: "Chatbot",
    description:
      "Build a simple chatbot UI that responds to user messages.",
    difficulty: "easy",
    estimatedMinutes: 20,
    testSpec: {
      checks: [
        { id: "input", type: "dom", target: "chat-input" },
        { id: "send", type: "interaction", action: "send", expected: "reply" },
        { id: "history", type: "dom", target: "chat-history" },
        { id: "loading", type: "interaction", expected: "pending-state" },
      ],
    },
    acceptanceCriteria:
      "Messages render in a history list, a reply appears after send, pending state shown while waiting.",
  },
];

const demoRuns = [
  { email: "demo@coderunner.local", name: "Demo Runner", slug: "calculator", elapsedMs: 45_200 },
  { email: "demo@coderunner.local", name: "Demo Runner", slug: "landing-page", elapsedMs: 78_500 },
  { email: "demo@coderunner.local", name: "Demo Runner", slug: "todo-auth", elapsedMs: 132_400 },
  { email: "demo@coderunner.local", name: "Demo Runner", slug: "chatbot", elapsedMs: 61_800 },
];

async function main() {
  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { slug: challenge.slug },
      update: {
        title: challenge.title,
        description: challenge.description,
        difficulty: challenge.difficulty,
        estimatedMinutes: challenge.estimatedMinutes,
        testSpec: challenge.testSpec,
        acceptanceCriteria: challenge.acceptanceCriteria,
      },
      create: challenge,
    });
  }

  for (const demoRun of demoRuns) {
    const user = await prisma.user.upsert({
      where: { email: demoRun.email },
      update: { name: demoRun.name },
      create: { email: demoRun.email, name: demoRun.name },
    });
    const challenge = await prisma.challenge.findUnique({
      where: { slug: demoRun.slug },
      select: { id: true },
    });
    if (!challenge) continue;
    const run = await prisma.run.upsert({
      where: { id: `demo-${demoRun.slug}` },
      update: {
        status: "completed",
        endedAt: new Date(),
        elapsedMs: demoRun.elapsedMs,
      },
      create: {
        id: `demo-${demoRun.slug}`,
        userId: user.id,
        challengeId: challenge.id,
        status: "completed",
        endedAt: new Date(),
        elapsedMs: demoRun.elapsedMs,
      },
    });
    await prisma.verification.upsert({
      where: { runId: run.id },
      update: { status: "passed" },
      create: { runId: run.id, status: "passed", testOutput: "seeded demo verification" },
    });
  }

  const count = await prisma.challenge.count();
  console.log(`Seed complete: ${count} challenges`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
