# Verification spec: Rust Key-Value Store API

Challenge: "Build a Rust-backed JSON key-value store API - put, get, list and delete string values over HTTP" (SPE-159 / SPE-107 week-5 new track, `rust` language, `backend` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. No source code, framework, or internal API shape is assumed beyond the public contract below. The service may be implemented in any way - the `rust` tag describes the intended implementation language (a Rust HTTP server), consistent with the existing `python`-tagged challenges.

## The contract (discovery rules)

The submission must serve a JSON key-value API under the **same origin** as its base URL:

- **`GET /`** - the base URL must return HTTP `< 400`. A landing page, API docs page, or a JSON health payload are all acceptable; the harness does not require HTML here.
- **`PUT /api/kv/{key}`** - request body `{ "value": "..." }`. Stores `value` under `key` and returns a `2xx` **JSON object** echoing the stored `value` (and ideally `key`). Re-`PUT` on an existing key **overwrites** the previous value.
- **`GET /api/kv/{key}`** - returns a `2xx` **JSON object** whose `value` equals the stored value. `{ key }` is the path segment sent by the client.
- **`GET /api/kv/{unknown}`** - returns **`404`** for a key that was never stored.
- **`GET /api/kv`** - returns a `2xx` **JSON array** listing stored keys. An entry may be a bare key string or an object with a `key` field. The array must contain a key that was just stored.
- **`DELETE /api/kv/{key}`** - returns a `2xx`; a subsequent `GET /api/kv/{key}` returns **`404`**.
- **`PUT /api/kv/{key}` with no `value`** - returns a **`4xx`** (validation error), not a `2xx`.

Paths are literal for the collection: `/api/kv` and `/api/kv/{key}`. `{key}` is any URL-safe token the client chooses.

## Required checks

| id | passes when |
|---|---|
| `kv-root-loads` | The base URL returns HTTP < 400 |
| `kv-put-creates` | `PUT /api/kv/{key}` with a random value returns a 2xx JSON object echoing that value |
| `kv-get-reads` | `GET /api/kv/{key}` returns a 2xx JSON object whose `value` equals the stored value |
| `kv-get-unknown-404` | `GET /api/kv/{key}` for a never-stored key returns 404 |
| `kv-list-contains` | `GET /api/kv` returns a 2xx JSON array containing the stored key |
| `kv-put-overwrites` | A second `PUT` on the same key returns 2xx and a follow-up `GET` returns the new value |
| `kv-delete-removes` | `DELETE /api/kv/{key}` returns 2xx and a follow-up `GET` returns 404 |
| `kv-validation` | `PUT /api/kv/{key}` without a `value` returns 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `kv-json-content-type` | `GET /api/kv` is served as `application/json` |
| `kv-list-excludes-deleted` | The list no longer contains a key after it is deleted |
| `kv-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. Values are compared by exact string equality after the round trip. `GET /api/kv` tolerates either string entries or `{ key }` objects.

## Anti-mock design

Keys and values are randomized per run from the harness seed (e.g. key `a1b2c3d4e5`, value `fluent otter 123`). A submission that hardcodes a fixed catalog or echoes canned values will fail `kv-get-reads`, `kv-put-overwrites` and `kv-list-contains`. Re-running with the same `--seed` reproduces any run exactly for dispute review.
