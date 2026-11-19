# Verification spec: Python String Lab

Challenge: "Build a Python-backed string lab: accept a line of text and apply reverse, uppercase, lowercase, word count and palindrome checks with a visible result" (SPE-109 / SPE-107 week-2 Python track). Recommended stack: Flask or FastAPI + any frontend.

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness drives the real UI with Playwright; no source code, framework, or API access is required or assumed.

## The contract (discovery rules)

The app must expose:

- **A text input** for a line of text. It must be findable via its placeholder text, accessible name, name, or id (hint: mention "string", "text", "phrase", "sentence" or "word" in one of those).
- **Buttons** for each operation, findable via visible text or accessible name (aria-label):
  - Reverse (`reverse`, `backwards`, `mirror`, `flip`)
  - Uppercase (`uppercase`, `upper case`, `to upper`, `all caps`)
  - Lowercase (`lowercase`, `lower case`, `to lower`)
  - Word count (`word count`, `count words`, `words`)
  - Palindrome check (`palindrome`)
- **A result area**: after clicking an operation, new text must appear on the page containing the result.

## Required checks

| id | passes when |
|---|---|
| `str-page-loads` | Target URL returns HTTP < 400 |
| `str-input-present` | A visible editable text input/textarea is found |
| `str-controls-present` | All five operation buttons are discoverable |
| `str-reverse` | Random word reversed correctly |
| `str-uppercase` | Mixed-case random word appears in ALL CAPS |
| `str-lowercase` | Mixed-case random word appears in all lowercase |
| `str-word-count` | Word count of a random 2-6 word phrase is correct |
| `str-palindrome` | A generated palindrome yields a positive verdict (`yes` / `true` / `palindrome` / `is`) |
| `str-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `str-empty-input` | Clicking an operation with an empty input does not crash the page |

## Result parsing

After each click the harness diffs the page's visible text against the pre-click snapshot and looks for the expected string/number inside the newly added text. Case-sensitive where the operation is case-transforming.

## Anti-mock design

Input strings are randomized per run from the harness seed. A submission that hardcodes outputs for fixed inputs will fail; re-running with the same `--seed` reproduces any run exactly for dispute review.
