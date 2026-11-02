# Verification spec: Book library API

Challenge: "Build a REST API for a book library" (SPE-158, `apis` category, medium).

## What "working" means

A submission passes when **all required checks below pass** against the live submission URL. The harness exercises the HTTP API directly and asserts status codes and response shapes.

## The contract

- The app must expose JSON endpoints under `/api/books`.
- Create: `POST /api/books` with a valid body returns `201` and the created book (with an `id`).
- List: `GET /api/books` returns a JSON array of books.
- Search: `GET /api/books?q=<text>` returns only books matching the query.
- Read: `GET /api/books/:id` returns the book, or `404` if absent.
- Delete: `DELETE /api/books/:id` removes the book and returns `200` (or `204`).
- Invalid create bodies return `400`.

## Required checks

| id | passes when |
|---|---|
| `books-api-page-loads` | Target base URL returns HTTP < 400 |
| `books-api-create` | `POST /api/books` with a valid body returns `201` and a body containing a new `id` |
| `books-api-list` | `GET /api/books` returns a JSON array containing the created book |
| `books-api-search` | `GET /api/books?q=<title>` returns only matching books |
| `books-api-read` | `GET /api/books/:id` returns the created book with `200` |
| `books-api-delete` | `DELETE /api/books/:id` succeeds and a subsequent `GET` returns `404` |
| `books-api-validation` | `POST /api/books` with an invalid body returns `400` |

## Bonus checks

| id | passes when |
|---|---|
| `books-api-update` | `PATCH`/`PUT /api/books/:id` updates a field and persists it |
| `books-api-json-content-type` | Responses carry `Content-Type: application/json` |
| `books-api-pagination` | `GET /api/books?limit=N` caps the number of returned items |

## Anti-mock design

The harness creates a book with a randomized title and then reads it back by `id`. A submission cannot pass without a real persistent store: the created id must be retrievable and the search must reflect the just-created record.
