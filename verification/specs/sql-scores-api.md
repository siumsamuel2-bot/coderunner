# Verification spec: SQL Scores API

Challenge: "Build a scores API with SQL-style filtering, ordering and limits - create scored records, then query top-k, minScore filters and ordered listings" (SPE-163 / SPE-107 week-6 SQL/Data track, `sql` language, `data` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. No source code, framework, or internal API shape is assumed beyond the public contract below. The `sql` tag describes the intended implementation approach (a data store with SQL-style SELECT semantics - SQL, SQLite, or any equivalent data engine); like the existing language-tagged challenges the harness verifies observable behaviour, not the source language.

## The contract (discovery rules)

The submission must serve the API under the **same origin** as its base URL:

- **`GET /`** - the base URL must return HTTP `< 400`. A landing page, docs page, or JSON health payload are all acceptable.
- **`POST /api/scores`** - request body `{ "player": "...", "score": <number> }`. Returns a `2xx` **JSON object** with a non-empty `id`, echoing `player` and `score`. A body missing `player` or with a non-numeric `score` returns **`4xx`**.
- **`GET /api/scores`** - returns a `2xx` **JSON array** of stored records (objects carrying at least `id`, `player`, `score`). Default order: insertion order.
- **Query parameters on `GET /api/scores`** (combinable):
  - `player=<exact string>` - WHERE-style exact match: only records whose `player` equals the parameter (URL-decoded).
  - `player=<exact string>` - WHERE-style exact match: only records whose `player` equals the parameter (URL-decoded).
  - `order=score` - sort by score; `dir=asc` or `dir=desc` controls direction. An unknown `order` or `dir` value returns **`4xx`**.
  - `minScore=<number>` - only records with `score >= minScore` (WHERE semantics).
  - `limit=<positive integer>` - at most that many records. `limit=0`, a negative limit or a non-numeric limit returns **`4xx`**.
- **`DELETE /api/scores/{id}`** - returns `2xx`; the record disappears from subsequent listings. A DELETE of an unknown id returns **`404`**.

## Required checks

| id | passes when |
|---|---|
| `s-root-loads` | The base URL returns HTTP < 400 |
| `s-create-echoes` | `POST /api/scores` with seeded player/score returns a non-empty `id` and echoes both fields |
| `s-list-contains` | `GET /api/scores` contains every created record |
| `s-player-filter` | `GET /api/scores?player=<seeded>` returns only that player's records |
| `s-top-k-desc` | `GET /api/scores?player=<seeded>&order=score&dir=desc&limit=3` returns exactly the seeded top-3 in correct order |
| `s-minscore-filter` | `GET /api/scores?player=<seeded>&minScore=<seeded>` returns only qualifying records (count matches the harness computation) |
| `s-asc-order` | `GET /api/scores?player=<seeded>&order=score&dir=asc` returns scores in ascending order |
| `s-delete-removes` | `DELETE /api/scores/{id}` returns 2xx and the record disappears from the list |
| `s-delete-unknown-404` | `DELETE /api/scores/{unknown-id}` returns 404 |
| `s-validation-limit` | `limit=0` and `limit=abc` each return 4xx |
| `s-validation-create` | `POST /api/scores` without a `score` returns 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `s-json-content-type` | Listing responses are served as `application/json` |
| `s-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. List comparisons use the `player` + `score` pairs (exact equality; seeded scores are integers), so an entry format that merely wraps them differently still fails. Ordering checks compare the extracted score sequences element-by-element.

## Anti-mock design

All records in a verification run share one run-unique player name (`sql-<token>`), and every ordering/filter check filters by that player first - so leftover records from earlier runs of the same submission URL cannot pollute expectations. Players and scores are randomized per run from the harness seed (e.g. player `"sql-k3f9x2a1"`, score `412`), with distinct scores so ordering is unambiguous. The harness computes the expected top-3, filter counts and orderings itself. A submission that hardcodes a leaderboard or ignores the query parameters fails `s-top-k-desc`, `s-player-filter`, `s-minscore-filter` and `s-asc-order`. Re-running with the same `--seed` reproduces any run exactly for dispute review.
