import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "../src/generated/prisma-node/client";
import { parseCheckManifest } from "../src/lib/check-manifest";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

/** Verification specs live beside the harness; seeded from the same source. */
const SPECS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "verification",
  "specs"
);

/**
 * Challenge spec schema (SPE-108). Runtime-validated at seed time so a bad
 * spec fails loudly before it ever reaches production data. The type-level
 * contract is the Challenge model; this guard catches malformed entries in
 * `challenges` before any DB writes happen.
 */
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const LANGUAGES = ["typescript", "python", "rust"] as const;
const CATEGORIES = [
  "algorithms",
  "frontend",
  "backend",
  "full-stack",
  "ai",
  "apis",
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
  {
    slug: "book-library-api",
    title: "Book Library REST API",
    description:
      "Build a JSON REST API for a book library on the same origin as your app: GET /api/books lists books, POST /api/books creates one from { title, author }, GET /api/books/{id} reads one back, and DELETE /api/books/{id} removes it. A create without a title must be rejected.",
    difficulty: "medium",
    language: "typescript",
    category: "apis",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "book-root-loads", type: "http", expected: "status < 400" },
        { id: "book-list-json-array", type: "http", expected: "GET /api/books returns a JSON array" },
        { id: "book-create", type: "http", expected: "POST /api/books returns created book with id + title" },
        { id: "book-read-by-id", type: "http", expected: "GET /api/books/:id returns the created book" },
        { id: "book-appears-in-list", type: "http", expected: "created book present in GET /api/books" },
        { id: "book-delete", type: "http", expected: "DELETE then GET returns 404" },
        { id: "book-validation", type: "edge", expected: "POST without title returns 4xx" },
        { id: "book-json-content-type", type: "http", expected: "application/json responses (bonus)" },
        { id: "book-distinct-ids", type: "edge", expected: "two creates yield distinct ids (bonus)" },
        { id: "book-no-console-errors", type: "console", expected: "zero console errors (bonus)" },
      ],
    },
    acceptanceCriteria:
      "The base URL responds with HTTP < 400. GET /api/books returns a JSON array. POST /api/books with a JSON body { title, author } returns the created book with a non-empty id and the submitted title. GET /api/books/{id} returns that same book. The created book appears in GET /api/books. DELETE /api/books/{id} returns 2xx and a follow-up GET returns 404. POST /api/books without a title is rejected with a 4xx status.",
  },
  {
    slug: "rust-fizzbuzz-api",
    title: "Rust FizzBuzz API",
    description:
      "Build a Rust-backed FizzBuzz JSON API: GET /api/fizzbuzz/{n} returns Fizz for multiples of 3, Buzz for multiples of 5, FizzBuzz for multiples of 15, and the number itself otherwise. Non-positive or non-integer input must be rejected.",
    difficulty: "easy",
    language: "rust",
    category: "algorithms",
    estimatedMinutes: 15,
    testSpec: {
      checks: [
        { id: "fb-root-loads", type: "http", expected: "status < 400" },
        { id: "fb-fizz", type: "http", expected: "multiples of 3 return Fizz" },
        { id: "fb-buzz", type: "http", expected: "multiples of 5 return Buzz" },
        { id: "fb-fizzbuzz", type: "http", expected: "multiples of 15 return FizzBuzz" },
        { id: "fb-plain-number", type: "http", expected: "other numbers return the number as a string" },
        { id: "fb-validation", type: "edge", expected: "0 / -3 / abc return 4xx" },
        { id: "fb-json-content-type", type: "http", expected: "application/json responses (bonus)" },
        { id: "fb-distinct-results", type: "edge", expected: "Fizz/Buzz/FizzBuzz are distinct (bonus)" },
        { id: "fb-no-console-errors", type: "console", expected: "zero console errors (bonus)" },
      ],
    },
    acceptanceCriteria:
      "GET /api/fizzbuzz/{n} returns a 2xx JSON response whose result is Fizz for multiples of 3, Buzz for multiples of 5 and FizzBuzz for multiples of 15, and the number as a string otherwise. n = 0, negative or non-integer returns 4xx. The base URL responds with HTTP < 400.",
  },
  {
    slug: "rust-kv-store-api",
    title: "Rust Key-Value Store API",
    description:
      "Build a Rust-backed JSON key-value store: PUT /api/kv/{key} stores a value, GET reads it back, DELETE removes it, and GET /api/kv lists stored keys. Unknown keys return 404 and a put without a value is rejected.",
    difficulty: "medium",
    language: "rust",
    category: "backend",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "kv-root-loads", type: "http", expected: "status < 400" },
        { id: "kv-put-creates", type: "http", expected: "PUT stores a value and echoes it" },
        { id: "kv-get-reads", type: "http", expected: "GET returns the stored value" },
        { id: "kv-get-unknown-404", type: "http", expected: "unknown key returns 404" },
        { id: "kv-list-contains", type: "http", expected: "GET /api/kv lists the stored key" },
        { id: "kv-put-overwrites", type: "http", expected: "PUT on an existing key overwrites it" },
        { id: "kv-delete-removes", type: "http", expected: "DELETE removes the key (404 after)" },
        { id: "kv-validation", type: "edge", expected: "PUT without a value returns 4xx" },
        { id: "kv-json-content-type", type: "http", expected: "application/json responses (bonus)" },
        { id: "kv-list-excludes-deleted", type: "edge", expected: "deleted key absent from list (bonus)" },
        { id: "kv-no-console-errors", type: "console", expected: "zero console errors (bonus)" },
      ],
    },
    acceptanceCriteria:
      "PUT /api/kv/{key} with { value } returns a 2xx JSON object echoing the value. GET /api/kv/{key} returns the stored value or 404 for an unknown key. GET /api/kv returns a JSON array listing stored keys. Re-putting a key overwrites its value. DELETE removes the key so a follow-up GET returns 404. A PUT without a value is rejected with 4xx.",
  },
  {
    slug: "rust-text-stats-api",
    title: "Rust Text Stats API",
    description:
      "Build a Rust-backed text statistics API: POST /api/stats with { text } returns the number of characters, words and lines in that text. Empty text reports zero words and a request without text is rejected.",
    difficulty: "medium",
    language: "rust",
    category: "data",
    estimatedMinutes: 30,
    testSpec: {
      checks: [
        { id: "stats-root-loads", type: "http", expected: "status < 400" },
        { id: "stats-post-counts", type: "http", expected: "character/word/line counts match" },
        { id: "stats-single-word", type: "http", expected: "single word -> 1 word, 1 line" },
        { id: "stats-empty-text", type: "edge", expected: "empty text -> 0 words or 4xx" },
        { id: "stats-validation", type: "edge", expected: "POST without text returns 4xx" },
        { id: "stats-json-content-type", type: "http", expected: "application/json responses (bonus)" },
        { id: "stats-no-console-errors", type: "console", expected: "zero console errors (bonus)" },
      ],
    },
    acceptanceCriteria:
      "POST /api/stats with { text } returns a 2xx JSON object with numeric character, word and line counts for that exact text. A single word reports 1 word on 1 line. Empty text reports 0 words (or is rejected with 4xx). A request without a text field is rejected with 4xx.",
  },
];

/**
 * Attaches the check manifest parsed from `verification/specs/<slug>.md` to
 * the challenge's testSpec. This keeps the challenge page's "how you'll be
 * verified" list in lockstep with the spec the harness enforces, without a
 * separate sync step. A missing/empty spec leaves testSpec untouched.
 */
function withCheckManifest(spec: ChallengeSpec): Prisma.InputJsonValue {
  const specFile = path.join(SPECS_DIR, `${spec.slug}.md`);
  if (!existsSync(specFile)) {
    return spec.testSpec;
  }
  const manifest = parseCheckManifest(
    readFileSync(specFile, "utf8"),
    `verification/specs/${spec.slug}.md`
  );
  if (manifest.checks.length === 0) {
    return spec.testSpec;
  }
  return {
    ...(spec.testSpec as Record<string, unknown>),
    checkManifest: manifest,
  } as unknown as Prisma.InputJsonValue;
}

async function main() {
  for (const challenge of challenges) {
    validateChallengeSpec(challenge);
    const testSpec = withCheckManifest(challenge);
    await prisma.challenge.upsert({
      where: { slug: challenge.slug },
      update: {
        title: challenge.title,
        description: challenge.description,
        difficulty: challenge.difficulty,
        language: challenge.language,
        category: challenge.category,
        estimatedMinutes: challenge.estimatedMinutes,
        testSpec,
        acceptanceCriteria: challenge.acceptanceCriteria,
      },
      create: { ...challenge, testSpec },
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
