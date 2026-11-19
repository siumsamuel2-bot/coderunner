# Verification spec: Rust Text Stats API

Challenge: "Build a Rust-backed text statistics API - POST /api/stats returns character, word and line counts for any string" (SPE-159 / SPE-107 week-5 new track, `rust` language, `data` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. The `rust` tag describes the intended implementation language (a Rust HTTP service); like the existing `python`-tagged challenges the harness verifies observable behaviour, not the source language.

## The contract (discovery rules)

The submission must serve a JSON text-statistics API under the **same origin** as its base URL:

- **`GET /`** - the base URL must return HTTP `< 400`. A landing page, docs page, or JSON health payload are all acceptable.
- **`POST /api/stats`** - request body `{ "text": "..." }`. Returns a `2xx` **JSON object** carrying three numeric counts for that exact text:
  - **characters** - the total length of the string, including spaces and newlines. Field aliases accepted: `characters`, `chars`, `length`, `characterCount`.
  - **words** - the number of whitespace-separated tokens. Field aliases accepted: `words`, `wordCount`.
  - **lines** - the number of newline-separated lines (`text` split on `\n`). Field aliases accepted: `lines`, `lineCount`.
  - Counts may be JSON numbers or numeric strings; field names are matched case-insensitively.
- **`POST /api/stats` with empty text** (`""`) - returns either a `2xx` object reporting **0 words**, or a `4xx`; both are accepted.
- **`POST /api/stats` without a `text` field** - returns a **`4xx`** (validation error), not a `2xx`.

The path is literal: `/api/stats`.

## Required checks

| id | passes when |
|---|---|
| `stats-root-loads` | The base URL returns HTTP < 400 |
| `stats-post-counts` | A seeded multi-line text returns characters, words and lines matching the harness's own counts |
| `stats-single-word` | A single word yields `words = 1` and `lines = 1` |
| `stats-empty-text` | Empty text yields 0 words, or is rejected with 4xx |
| `stats-validation` | `POST /api/stats` without a `text` field returns 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `stats-json-content-type` | Responses are served as `application/json` |
| `stats-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. Counts are read from the first matching field alias and compared to the harness's counts (characters = string length, words = whitespace tokens, lines = `\n` segments).

## Anti-mock design

The multi-line text is generated per run from the harness seed (2-5 lines, 2-6 words per line), so a submission that returns fixed counts cannot pass. Re-running with the same `--seed` reproduces the exact text and counts for dispute review.
