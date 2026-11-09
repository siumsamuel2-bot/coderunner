# Verification spec: SQL Mini Query API

Challenge: "Build a SQL-flavored mini analytics API - ingest rows, then answer aggregate queries (count / sum / avg / min / max) with an optional category filter" (SPE-163 / SPE-107 week-6 SQL/Data track, `sql` language, `data` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. No source code, framework, or internal API shape is assumed beyond the public contract below. The service may be implemented any way you like (a real SQL engine, SQLite, or an in-memory store) - the `sql` tag describes the intended flavor of the challenge (relational aggregation), consistent with the `rust`- and `python`-tagged challenges.

## The contract (discovery rules)

The submission must serve the API under the **same origin** as its base URL:

- **`GET /`** - the base URL must return HTTP `< 400`. A landing page, docs page, or JSON health payload are all acceptable.
- **`POST /api/ingest`** - request body `{ "rows": [ { "category": "...", "value": <number> }, ... ] }`. The array must be non-empty, every `category` a non-empty string, every `value` a finite number. Replaces the entire store with these rows. Returns a `2xx` **JSON object** containing the number of ingested rows as `ingested` (equal to `rows.length`).
- **`POST /api/query`** - request body `{ "op": "sum" | "avg" | "min" | "max" | "count", "category": "..."? }`. The optional `category` acts as a WHERE filter; without it, the query spans all rows.
  - `count` -> `{ "result": <number of matching rows> }` (an empty filter set yields `result: 0`).
  - `sum` -> `{ "result": <sum of matching values> }` (an empty filter set yields `result: 0`).
  - `min` / `max` -> `{ "result": <extreme value among matching rows> }`.
  - `avg` -> `{ "result": <mean of matching values, rounded to 2 decimal places> }`.
  - `avg`, `min` or `max` over an **empty** filter set (e.g. a category that was never ingested) must return a **`4xx`**, not a `2xx`.
  - Any other `op` (or a missing `op`) must return a **`4xx`**.
- **`POST /api/ingest` with an invalid payload** (empty `rows` array, a row missing `value`, a non-numeric `value`, or an empty `category`) must return a **`4xx`** and must not modify the store.

## Required checks

| id | passes when |
|---|---|
| `q-root-loads` | The base URL returns HTTP < 400 |
| `q-ingest-accepts` | `POST /api/ingest` with 12 seeded rows returns 2xx with `ingested: 12` |
| `q-count-all` | `POST /api/query { op: "count" }` returns the seeded row count |
| `q-count-category` | `POST /api/query { op: "count", category }` returns the expected per-category count |
| `q-sum-all` | `POST /api/query { op: "sum" }` returns the exact seeded sum |
| `q-min-category` | `POST /api/query { op: "min", category }` returns the expected minimum |
| `q-max-category` | `POST /api/query { op: "max", category }` returns the expected maximum |
| `q-avg-category` | `POST /api/query { op: "avg", category }` returns the expected mean (tolerance 0.01) |
| `q-validation-op` | An unknown `op` (and a missing `op`) return 4xx |
| `q-empty-avg-4xx` | `avg` over a category that has no rows returns 4xx |
| `q-validation-ingest` | `POST /api/ingest` with a row missing `value` returns 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `q-json-content-type` | Query responses are served as `application/json` |
| `q-reingest-replaces` | A second ingest with 3 fresh rows makes `count` return 3 |
| `q-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. Numeric results are compared with exact equality for integer aggregates (`count`, `sum`, `min`, `max`) and with a tolerance of 0.01 for `avg`. The harness computes all expectations from the seeded rows itself - no trust in echoed inputs.

## Anti-mock design

Rows are randomized per run from the harness seed (3 categories, 12 rows, integer values; e.g. category `"steel-lion"`, value `481`). A submission that hardcodes a fixed dataset or echoes canned aggregates will fail `q-count-all`, `q-sum-all` and `q-avg-category`. Re-running with the same `--seed` reproduces any run exactly for dispute review.
