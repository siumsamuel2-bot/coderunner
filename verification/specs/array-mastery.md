# Verification spec: Array Mastery

Challenge: "Build a TypeScript array playground: accept a list of numbers and apply sort, filter, map, reduce and dedupe operations with a visible result" (SPE-108 / SPE-107 week-1 content drop).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness drives the real UI with Playwright; no source code, framework, or API access is required or assumed.

## The contract (discovery rules)

The app must expose:

- **A text input** for the list of numbers (comma- and/or space-separated, e.g. `3, 1, 4, 1, 5, 9, 2, 6`). It must be findable via its placeholder text, accessible name, name, or id (hint: mention "array", "numbers", "list" or "values" in one of those).
- **Buttons** for each operation, findable via visible text or accessible name (aria-label):
  - Sort ascending (`sort asc`, `ascending`, `a-z`, ...)
  - Sort descending (`sort desc`, `descending`, `z-a`, ...)
  - Filter even (`even`)
  - Filter odd (`odd`)
  - Double each value (`double`, `x2`, `*2`, `twice`)
  - Sum of values (`sum`, `total`, `reduce`)
  - Deduplicate (`dedupe`, `unique`, `distinct`, `remove duplicates`)
- **A result area**: after clicking an operation, new text must appear on the page containing the resulting values in order (any separator is fine: `1, 2, 3`, `1 2 3`, `[1,2,3]`, one per line...).

## Required checks

| id | passes when |
|---|---|
| `arr-page-loads` | Target URL returns HTTP < 400 |
| `arr-input-present` | A visible editable text input/textarea is found |
| `arr-controls-present` | All seven operation buttons are discoverable |
| `arr-sort-asc` | Random list sorts ascending correctly |
| `arr-sort-desc` | Random list sorts descending correctly |
| `arr-filter-even` | Clicking "even" yields only the even values, in input order |
| `arr-filter-odd` | Clicking "odd" yields only the odd values, in input order |
| `arr-map-double` | Clicking "double" yields every value multiplied by 2, in input order |
| `arr-reduce-sum` | Clicking "sum" yields the correct total (printed as a number) |
| `arr-dedupe` | Clicking "dedupe" yields each value's first occurrence only, in input order |
| `arr-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `arr-empty-input` | Clicking an operation with an empty input does not crash the page (no uncaught error, controls still work) |

## Result parsing

After each click the harness diffs the page's visible text against the pre-click snapshot and looks for the expected number sequence inside the newly added text. Separators are arbitrary; order matters. For `sum`, a single number matching the expected total must appear in the new text.

## Anti-mock design

Input arrays are randomized per run from the harness seed (8-14 values, -50..50). A submission that hardcodes outputs for fixed inputs will fail; re-running with the same `--seed` reproduces any run exactly for dispute review.
