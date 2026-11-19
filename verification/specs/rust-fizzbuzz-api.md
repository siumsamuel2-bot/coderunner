# Verification spec: Rust FizzBuzz API

Challenge: "Build a Rust-backed FizzBuzz JSON API - GET /api/fizzbuzz/{n} returns the FizzBuzz answer for n" (SPE-159 / SPE-107 week-5 new track, `rust` language, `algorithms` category).

## What "working" means

A submission passes when **all required checks below pass** against the live base URL. The harness talks to the submission over HTTP (Node `fetch`) and, for the console-error bonus, loads the base URL in a real browser. No source code, framework, or internal API shape is assumed beyond the public contract below. The `rust` tag describes the intended implementation language (a Rust HTTP service); like the existing `python`-tagged challenges the harness verifies observable behaviour, not the source language.

## The contract (discovery rules)

The submission must serve the API under the **same origin** as its base URL:

- **`GET /`** - the base URL must return HTTP `< 400`. A landing page, docs page, or JSON health payload are all acceptable; the harness does not require HTML here.
- **`GET /api/fizzbuzz/{n}`** - `{n}` is a positive integer. Returns a `2xx` **JSON object** containing the answer. The harness reads the answer from a `result` field (a string, or a number for the plain-number case); a bare JSON string body is also accepted.
  - divisible by **15** → `"FizzBuzz"`
  - divisible by **3** (not 5) → `"Fizz"`
  - divisible by **5** (not 3) → `"Buzz"`
  - otherwise → the number itself (`"7"`)
- **`GET /api/fizzbuzz/{n}`** where `{n}` is **not a positive integer** (e.g. `0`, `-3`, `abc`) → returns a **`4xx`**, not a `2xx`.

Paths are literal: the API lives at `/api/fizzbuzz/{n}`.

## Required checks

| id | passes when |
|---|---|
| `fb-root-loads` | The base URL returns HTTP < 400 |
| `fb-fizz` | `/api/fizzbuzz/3` and `/api/fizzbuzz/9` both return `"Fizz"` |
| `fb-buzz` | `/api/fizzbuzz/5` and `/api/fizzbuzz/25` both return `"Buzz"` |
| `fb-fizzbuzz` | `/api/fizzbuzz/15` and `/api/fizzbuzz/30` both return `"FizzBuzz"` |
| `fb-plain-number` | `/api/fizzbuzz/{n}` for non-multiples (incl. a seeded random n) returns the number as a string |
| `fb-validation` | `/api/fizzbuzz/0`, `/api/fizzbuzz/-3` and `/api/fizzbuzz/abc` each return 4xx |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `fb-json-content-type` | Responses are served as `application/json` |
| `fb-distinct-results` | `Fizz`, `Buzz` and `FizzBuzz` are three distinct output strings |
| `fb-no-console-errors` | Loading the base URL in a browser records zero `console.error` / uncaught page errors |

## Result parsing

Each check parses the raw JSON body with `JSON.parse`; a body that is not valid JSON fails the check. The answer is compared by exact string equality (`"Fizz"`, `"Buzz"`, `"FizzBuzz"`, or the decimal digits of n).

## Anti-mock design

One of the plain-number cases is drawn from the harness seed (any 1-100 value that is not a multiple of 3 or 5), so a submission that hardcodes only the classic 1-100 table still has to answer a seeded value. Re-running with the same `--seed` reproduces any run exactly for dispute review.
