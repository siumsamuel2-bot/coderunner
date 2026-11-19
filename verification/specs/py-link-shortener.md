# Verification spec: Python Link Shortener

Challenge: "Build a Python-backed link shortener: submit a long URL, get a short link, and make the short link redirect to the original. Created links persist in a visible list" (SPE-109 / SPE-107 week-2 Python track). Recommended stack: Flask or FastAPI with any persistence (in-memory is fine for a single run).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness drives the real UI with Playwright and probes the short link over HTTP; no source code or framework access is required or assumed.

## The contract (discovery rules)

The app must expose:

- **A URL input** for the long URL, findable via its placeholder text, accessible name, name, or id (hint: mention "url", "link", "address" or "website"; avoid the word "search").
- **A submit button**, findable via visible text or accessible name (`shorten`, `create`, `add`, `submit`, `shrink`, ...).
- **A visible short link**: after submitting, a link (or text) must appear on the page containing an absolute URL on the submission's own origin with a non-root path, e.g. `https://yourapp.example/abc123` or `https://yourapp.example/r/abc123`.
- **Redirect behavior**: `GET <short-url>` must return an HTTP 3xx response whose `Location` header is the original long URL.
- **Persistence within a run**: after creating a second link, the first link must still be listed.

## Required checks

| id | passes when |
|---|---|
| `url-page-loads` | Target URL returns HTTP < 400 |
| `url-form-present` | URL input and shorten/submit button are discoverable |
| `url-shorten-appears` | Submitting a random long URL surfaces a same-origin short link |
| `url-redirect-works` | `GET <short-url>` returns 3xx with `Location` = original URL |
| `url-second-link-persists` | A second short link is created and the first remains listed |
| `url-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Anti-mock design

Long URLs contain random paths and query params (`https://example.com/<random>?ref=<random>`). A submission that hardcodes redirects will fail; re-running with the same `--seed` reproduces any run exactly for dispute review.
