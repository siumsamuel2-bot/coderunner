import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "../src/generated/prisma-node/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

/**
 * Challenge spec schema (SPE-108). Runtime-validated at seed time so a bad
 * spec fails loudly before it ever reaches production data. The type-level
 * contract is the Challenge model; this guard catches malformed entries in
 * `challenges` before any DB writes happen.
 */
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const LANGUAGES = ["typescript", "python"] as const;
const CATEGORIES = [
  "algorithms",
  "frontend",
  "backend",
  "full-stack",
  "ai",
  "data",
  "general",
] as const;

interface ChallengeSpec {
  slug: string;
  title: string;
  description: string;
  difficulty: (typeof DIFFICULTIES)[number];
  language: (typeof LANGUAGES)[number];
  category: (typeof CATEGORIES)[number];
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
  if (!LANGUAGES.includes(spec.language)) {
    throw new Error(
      `Challenge "${label}": language must be one of ${LANGUAGES.join(", ")}`
    );
  }
  if (!CATEGORIES.includes(spec.category)) {
    throw new Error(
      `Challenge "${label}": category must be one of ${CATEGORIES.join(", ")}`
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
      "Build a working calculator with +, -, *, /, clear, and decimal support. It must also handle chained operations (like 12 + 7 - 5 =) and survive dividing by zero.",
    difficulty: "easy",
    language: "typescript",
    category: "algorithms",
    estimatedMinutes: 15,
    testSpec: {
      checks: [
        { id: "calc-page-loads", type: "http", expected: "status < 400" },
        { id: "calc-buttons-present", type: "dom", target: "all calculator buttons" },
        { id: "calc-display-updates", type: "interaction", expected: "display updates while typing" },
        { id: "calc-add", type: "interaction", expected: "random a+b correct" },
        { id: "calc-sub", type: "interaction", expected: "random a-b correct" },
        { id: "calc-mul", type: "interaction", expected: "random a*b correct" },
        { id: "calc-div", type: "interaction", expected: "random a/b correct incl. 7/2 = 3.5" },
        { id: "calc-decimal", type: "interaction", expected: "quarter-step decimals add correctly" },
        { id: "calc-chained", type: "interaction", expected: "a + b - c shows the correct result" },
        { id: "calc-clear", type: "interaction", expected: "clear resets to empty or 0" },
        { id: "calc-div-zero", type: "edge", expected: "5/0 does not crash; 2+2 still works after" },
        { id: "calc-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "All four operations work on randomized inputs, including decimals like 7 / 2 = 3.5. Chained operations (for example 12 + 7 - 5 =) show the correct result. Clear resets the display to empty or 0. Dividing by zero does not crash the app and later calculations still work. No console errors.",
  },
  {
    slug: "todo-auth",
    title: "Todo app with auth",
    description:
      "Build a todo app with user registration and login, create/toggle-complete/delete for todos, and per-user data isolation. Todos must persist across page reloads.",
    difficulty: "medium",
    language: "typescript",
    category: "full-stack",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "todo-page-loads", type: "http", expected: "status < 400" },
        { id: "todo-register-userA", type: "auth", expected: "user A registers and reaches a logged-in state" },
        { id: "todo-create", type: "interaction", expected: "created todo text is visible" },
        { id: "todo-toggle", type: "interaction", expected: "todo can be marked complete" },
        { id: "todo-persistence", type: "interaction", expected: "todos and toggled state survive a reload" },
        { id: "todo-delete", type: "interaction", expected: "deleted todo stays gone after reload" },
        { id: "todo-isolation", type: "auth", expected: "logged out: nothing visible; user B cannot see A's todos; A still sees their own" },
        { id: "todo-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "A new user can register and reach a logged-in state. Created todos appear in the list. A todo can be marked complete, and both todos and their completed state survive a page reload. A deleted todo stays gone after a reload. Logged-out visitors see no todos, and a second registered user cannot see the first user's todos, while the first user still sees their own. No console errors.",
  },
  {
    slug: "pdf-analyzer",
    title: "PDF analyzer",
    description:
      "Build a tool that accepts a PDF upload and surfaces its content: extracted text plus metadata such as page count, file name, or file size.",
    difficulty: "hard",
    language: "typescript",
    category: "data",
    estimatedMinutes: 45,
    testSpec: {
      checks: [
        { id: "pdf-page-loads", type: "http", expected: "status < 400" },
        { id: "pdf-file-input", type: "dom", target: "file input" },
        { id: "pdf-extracts-text", type: "interaction", expected: "fixture marker phrase appears after upload" },
        { id: "pdf-metadata", type: "output", expected: "page-count, file-name, or file-size signal displayed" },
        { id: "pdf-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "A file input exists on the page. After uploading the sample PDF, the extracted text appears, including the fixture's marker phrase. A metadata signal is displayed: page count, file name, or file size. No console errors.",
  },
  {
    slug: "landing-page",
    title: "Landing page that converts",
    description:
      "Build a marketing landing page with a hero headline, a features section, a visible call-to-action, and pricing content.",
    difficulty: "medium",
    language: "typescript",
    category: "frontend",
    estimatedMinutes: 25,
    testSpec: {
      checks: [
        { id: "land-http-ok-html", type: "http", expected: "HTTP 200 with an HTML body" },
        { id: "land-title", type: "dom", target: "non-empty document title" },
        { id: "land-viewport-meta", type: "dom", target: "viewport meta tag" },
        { id: "land-hero-h1", type: "dom", target: "visible non-empty hero h1" },
        { id: "land-features", type: "dom", target: "features section" },
        { id: "land-cta", type: "dom", target: "visible CTA control" },
        { id: "land-pricing", type: "dom", target: "pricing content" },
        { id: "land-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "The page returns HTTP 200 with an HTML body and a non-empty document title. A viewport meta tag is present. The hero h1, features section, CTA control, and pricing content all render. No console errors.",
  },
  {
    slug: "chatbot",
    title: "Chatbot",
    description:
      "Build a chat UI where sent messages appear in a history list and a bot replies to each one.",
    difficulty: "easy",
    language: "typescript",
    category: "ai",
    estimatedMinutes: 20,
    testSpec: {
      checks: [
        { id: "chat-page-loads", type: "http", expected: "status < 400" },
        { id: "chat-input-discoverable", type: "dom", target: "message input + send control or Enter fallback" },
        { id: "chat-user-message-appears", type: "interaction", expected: "sent message text becomes visible" },
        { id: "chat-bot-responds", type: "interaction", expected: "bot response appears within 30s" },
        { id: "chat-continuity", type: "interaction", expected: "a second message also gets a response within 30s" },
        { id: "chat-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "The message input and send control (or an Enter fallback) are discoverable. A sent message becomes visible in the chat. The bot responds to the first message and to a follow-up message, each within 30 seconds. No console errors.",
  },
  {
    slug: "array-mastery",
    title: "Array Mastery",
    description:
      "Build a TypeScript array playground: accept a comma/space separated list of numbers and apply sort (asc/desc), filter (even/odd), map (double), reduce (sum) and dedupe operations, showing the result after each click.",
    difficulty: "medium",
    language: "typescript",
    category: "algorithms",
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
  {
    slug: "py-string-lab",
    title: "Python String Lab",
    description:
      "Build a Python-backed string lab: accept a line of text and apply reverse, uppercase, lowercase, word count and palindrome checks, showing the result after each click.",
    difficulty: "easy",
    language: "python",
    category: "algorithms",
    estimatedMinutes: 20,
    testSpec: {
      checks: [
        { id: "str-page-loads", type: "http", expected: "status < 400" },
        { id: "str-input-present", type: "dom", target: "text input" },
        {
          id: "str-controls-present",
          type: "dom",
          targets: ["reverse", "uppercase", "lowercase", "word count", "palindrome"],
        },
        { id: "str-reverse", type: "interaction", op: "reverse", expected: "reversed string" },
        { id: "str-uppercase", type: "interaction", op: "uppercase", expected: "ALL CAPS" },
        { id: "str-lowercase", type: "interaction", op: "lowercase", expected: "all lowercase" },
        { id: "str-word-count", type: "interaction", op: "word count", expected: "correct count" },
        { id: "str-palindrome", type: "interaction", op: "palindrome", expected: "positive verdict" },
        { id: "str-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "All five string operations work on randomized seeded inputs and print correct results; empty input does not crash the page (bonus); no console errors.",
  },
  {
    slug: "py-json-forge",
    title: "Python JSON Forge",
    description:
      "Build a Python-backed JSON workbench: paste JSON, then prettify, minify, or sort object keys; invalid JSON must produce a friendly error.",
    difficulty: "medium",
    language: "python",
    category: "data",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "json-page-loads", type: "http", expected: "status < 400" },
        { id: "json-input-present", type: "dom", target: "JSON textarea" },
        {
          id: "json-controls-present",
          type: "dom",
          targets: ["prettify", "minify", "sort keys"],
        },
        { id: "json-prettify", type: "interaction", op: "prettify", expected: "indented output" },
        { id: "json-minify", type: "interaction", op: "minify", expected: "compact output" },
        { id: "json-sort-keys", type: "interaction", op: "sort keys", expected: "keys alphabetical" },
        { id: "json-invalid-input", type: "edge", input: "not json", expected: "friendly error" },
        { id: "json-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "Prettify indents, minify compacts, sort keys orders object keys alphabetically; invalid JSON shows a friendly error; no console errors.",
  },
  {
    slug: "py-link-shortener",
    title: "Python Link Shortener",
    description:
      "Build a Python-backed link shortener: submit a long URL, get a short link, and make the short link redirect to the original. Created links persist in a visible list.",
    difficulty: "hard",
    language: "python",
    category: "backend",
    estimatedMinutes: 45,
    testSpec: {
      checks: [
        { id: "url-page-loads", type: "http", expected: "status < 400" },
        { id: "url-form-present", type: "dom", target: "URL input + submit" },
        { id: "url-shorten-appears", type: "interaction", op: "shorten", expected: "short link visible" },
        { id: "url-redirect-works", type: "http", expected: "3xx redirect to original URL" },
        { id: "url-second-link-persists", type: "interaction", op: "shorten second", expected: "both links listed" },
        { id: "url-no-console-errors", type: "console", expected: "zero console errors" },
      ],
    },
    acceptanceCriteria:
      "Shortening produces a working short link that HTTP-redirects (3xx) to the original URL; multiple links persist and stay listed; no console errors.",
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
        language: challenge.language,
        category: challenge.category,
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
