# Verification spec: Python JSON Forge

Challenge: "Build a Python-backed JSON workbench: paste JSON, then prettify, minify, or sort object keys; invalid JSON must produce a friendly error" (SPE-109 / SPE-107 week-2 Python track). Recommended stack: Flask or FastAPI + any frontend.

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness drives the real UI with Playwright; no source code, framework, or API access is required or assumed.

## The contract (discovery rules)

The app must expose:

- **A textarea or text input** for JSON. It must be findable via its placeholder text, accessible name, name, or id (hint: mention "json", "data", "paste" or "payload" in one of those).
- **Buttons** for each operation, findable via visible text or accessible name (aria-label):
  - Prettify (`prettify`, `prett`, `beautify`, `format`, `indent`)
  - Minify (`minify`, `compact`, `compress`, `strip`)
  - Sort keys (`sort keys`, `sort`, `order keys`, `a-z`)
- **A result area**: after clicking an operation, new text must appear on the page containing the transformed JSON.
- **Error surfacing**: submitting invalid JSON must add visible text containing a word like `error`, `invalid`, `not valid`, `unexpected`, or `cannot`.

## Required checks

| id | passes when |
|---|---|
| `json-page-loads` | Target URL returns HTTP < 400 |
| `json-input-present` | A visible editable JSON textarea/input is found |
| `json-controls-present` | All three operation buttons are discoverable |
| `json-prettify` | Compact JSON becomes indented (`"key": value` with whitespace after the colon; all keys present) |
| `json-minify` | Indented JSON becomes compact (tokens not separated by indentation) |
| `json-sort-keys` | Object keys appear in alphabetical order in the output |
| `json-invalid-input` | Invalid JSON produces a visible friendly error |
| `json-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Result parsing

After each click the harness diffs the page's visible text against the pre-click snapshot and inspects the newly added text. Keys are matched as `"key"`; whitespace-tolerant where noted.

## Anti-mock design

JSON documents (keys and values) are randomized per run from the harness seed. A submission that hardcodes outputs for fixed inputs will fail; re-running with the same `--seed` reproduces any run exactly for dispute review.
