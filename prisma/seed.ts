import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/**
 * Challenge spec schema (SPE-108). Runtime-validated at seed time so a bad
 * spec fails loudly before it ever reaches production data. The type-level
 * contract is the Challenge model; this guard catches malformed entries in
 * `challenges` before any DB writes happen.
 */
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

interface ChallengeSpec {
  slug: string;
  title: string;
  description: string;
  difficulty: (typeof DIFFICULTIES)[number];
  estimatedMinutes: number;
  testSpec: Prisma.InputJsonValue;
  acceptanceCriteria: string;
}

function validateChallengeSpec(spec: ChallengeSpec): void {
  const label = spec.slug ?? "<unknown>";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.slug)) {
    throw new Error(`Challenge "${label}": slug must be lowercase kebab-case`);
  }
  if (!spec.title.trim() || !spec.description.trim()) {
    throw new Error(`Challenge "${label}": title and description are required`);
  }
  if (!DIFFICULTIES.includes(spec.difficulty)) {
    throw new Error(
      `Challenge "${label}": difficulty must be one of ${DIFFICULTIES.join(", ")}`
    );
  }
  if (!Number.isInteger(spec.estimatedMinutes) || spec.estimatedMinutes <= 0) {
    throw new Error(`Challenge "${label}": estimatedMinutes must be a positive integer`);
  }
  if (!spec.acceptanceCriteria.trim()) {
    throw new Error(`Challenge "${label}": acceptanceCriteria is required`);
  }
  const testSpec = spec.testSpec as { checks?: unknown } | null;
  const checks = testSpec?.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error(`Challenge "${label}": testSpec.checks must be a non-empty array`);
  }
  const ids = new Set<string>();
  for (const check of checks) {
    const id = (check as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`Challenge "${label}": every testSpec check needs a non-empty id`);
    }
    if (ids.has(id)) {
      throw new Error(`Challenge "${label}": duplicate check id "${id}"`);
    }
    ids.add(id);
  }
}

const challenges: ChallengeSpec[] = [
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
  {
    slug: "array-mastery",
    title: "Array Mastery",
    description:
      "Build a TypeScript array playground: accept a comma/space separated list of numbers and apply sort (asc/desc), filter (even/odd), map (double), reduce (sum) and dedupe operations, showing the result after each click.",
    difficulty: "medium",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "arr-page-loads", type: "http", expected: "status < 400" },
        { id: "arr-input-present", type: "dom", target: "number list text input" },
        {
          id: "arr-controls-present",
          type: "dom",
          targets: ["sort asc", "sort desc", "filter even", "filter odd", "double", "sum", "dedupe"],
        },
        { id: "arr-sort-asc", type: "interaction", op: "sort ascending", expected: "values ascending" },
        { id: "arr-sort-desc", type: "interaction", op: "sort descending", expected: "values descending" },
        { id: "arr-filter-even", type: "interaction", op: "filter even", expected: "evens only, input order" },
        { id: "arr-filter-odd", type: "interaction", op: "filter odd", expected: "odds only, input order" },
        { id: "arr-map-double", type: "interaction", op: "double", expected: "each value * 2, input order" },
        { id: "arr-reduce-sum", type: "interaction", op: "sum", expected: "correct total" },
        { id: "arr-dedupe", type: "interaction", op: "dedupe", expected: "first occurrences only, input order" },
        { id: "arr-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "All seven operations work on randomized seeded inputs and print correct results in order; empty input does not crash the page (bonus); no console errors.",
  },
];

async function main() {
  for (const challenge of challenges) {
    validateChallengeSpec(challenge);
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
  const count = await prisma.challenge.count();
  console.log(`Seed complete: ${count} challenges`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
