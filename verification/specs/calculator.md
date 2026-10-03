# Verification spec: Calculator

Challenge: "Build a working calculator app with +, -, *, /, clear, decimal support" (SPE-55 #1).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness drives the real UI with Playwright; no source code, framework, or API access is required or assumed.

## The contract (discovery rules)

The app must expose:

- **Buttons** for digits `0-9`, `+`, `-`, multiplication (`*`, `x` or `×`), division (`/` or `÷`), `=` (equals), clear (`AC`, `C`, `CE` or `Clear`), and a decimal point (`.` or `,`). Buttons must be findable via their visible text or accessible name (aria-label).
- **A display**: any element (or input) whose text/value changes when digit buttons are pressed. The harness discovers it automatically by diffing the DOM while typing.

## Required checks

| id | passes when |
|---|---|
| `calc-page-loads` | Target URL returns HTTP < 400 |
| `calc-buttons-present` | All 15 button classes above are discoverable |
| `calc-display-updates` | Typing `1 2 3 4` updates some display element |
| `calc-add` | Random `a + b` (ints 1-99) shows `a+b` |
| `calc-sub` | Random non-negative `a - b` shows `a-b` |
| `calc-mul` | Random `a * b` (2-99 x 2-9) shows `a*b` |
| `calc-div` | Random `a / b` shows `a/b`; also a decimal case like `7/2 = 3.5` |
| `calc-decimal` | Random quarter-step decimals (e.g. `3.75 + 2.50`) add correctly |
| `calc-chained` | `a + b - c =` (no `=` between steps) shows the correct result |
| `calc-clear` | Clear resets the display to empty or `0` |
| `calc-div-zero` | `5/0=` does not crash the app; a follow-up `2+2=4` still works |
| `calc-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `calc-keyboard` | Typing `1+2` on the keyboard + `Enter` yields `3` |

## Result parsing

Displayed results are parsed as the trailing number of the display text. `7`, `7.0`, `7.00`, `7,000` and scientific notation are all accepted for value `7`. Displaying `Error`/`Infinity` for `5/0` is acceptable - the requirement is only that the app keeps working.

## Anti-mock design

Operands are randomized per run from the harness seed. A submission that hardcodes expected outputs for fixed expressions will fail; re-running with the same `--seed` reproduces any run exactly for dispute review.
