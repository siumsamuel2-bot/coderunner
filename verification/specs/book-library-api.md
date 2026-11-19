# Verification spec: Book Library REST API

Challenge: "Build a JSON REST API for a book library — list, create, read and delete books over HTTP" (SPE-158 / SPE-107 week-4 content drop, `apis` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. No source code, framework, or internal API shape is assumed beyond the public contract below.

## The contract (discovery rules)

The submission must serve a JSON API under the **same origin** as its base URL:

- **`GET /`** — the base URL must return HTTP `< 400`. A landing page, API docs page, or a JSON health payload are all acceptable; the harness does not require HTML here.
- **`GET /api/books`** — returns `200` (or another `2xx`) with `Content-Type: application/json` and a **JSON array** (it may be empty, or pre-seeded with books).
- **`POST /api/books`** — request body `{ "title": "...", "author": "..." }` (author optional). Returns a `2xx` **JSON object** that echoes the submitted `title` and exposes a non-empty `id` (string or number). The created book must be retrievable afterwards.
- **`GET /api/books/{id}`** — returns a `2xx` **JSON object** whose `id` matches the requested id and whose `title` matches the created book.
- **`DELETE /api/books/{id}`** — returns a `2xx`; a subsequent `GET /api/books/{id}` returns **`404`**.
- **`POST /api/books` with no `title`** — returns a **`4xx`** (validation error), not a `2xx`.

Paths are literal: the API lives at `/api/books` and `/api/books/{id}`. `{id}` is whatever identifier the create response returned.

## Required checks

| id | passes when |
|---|---|
| `book-root-loads` | The base URL returns HTTP < 400 |
| `book-list-json-array` | `GET /api/books` returns a 2xx JSON array |
| `book-create` | `POST /api/books` with a random title/author returns a 2xx JSON object echoing the title and exposing a non-empty `id` |
| `book-read-by-id` | `GET /api/books/{id}` returns a 2xx JSON object with the same `id` and `title` |
| `book-appears-in-list` | The created book is present in `GET /api/books` (matched by id or title) |
| `book-delete` | `DELETE /api/books/{id}` returns 2xx and a follow-up `GET /api/books/{id}` returns 404 |
| `book-validation` | `POST /api/books` without a `title` returns 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `book-json-content-type` | API responses are served as `application/json` |
| `book-distinct-ids` | Creating two books yields two different ids (no fixed/hardcoded id) |
| `book-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. Titles are compared by exact string equality after the round trip. There is no text scraping for this challenge — the API is the surface.

## Anti-mock design

Book titles and authors are randomized per run from the harness seed (e.g. `fluent otter 123`). A submission that hardcodes a fixed catalog or echoes canned values will fail `book-read-by-id`, `book-appears-in-list` and `book-distinct-ids`. Re-running with the same `--seed` reproduces any run exactly for dispute review.
