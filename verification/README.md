# Coderunner Verification Harness

Headless verification harness for Coderunner speedrun submissions. For each of the 5 launch challenges it drives the submitted app like a real user, records evidence (screenshots, display readings, HTTP traces, console logs), and emits a structured, tamper-evident JSON report the leaderboard can consume.

Built standalone ([SPE-83](/SPE/issues/SPE-83)) so the app rebuild ([SPE-46](/SPE/issues/SPE-46)) can absorb it without blocking either side.

## Quick start

```bash
npm install
npx playwright install chromium   # once, per CI image

# Verify one challenge against a submission URL
node src/cli.ts verify --challenge calculator --target http://localhost:3000

# All five challenges against different URLs
node src/cli.ts verify --challenge all --config targets.json

# List challenges and their check suites
node src/cli.ts list
```

`targets.json` maps challenge ids to submission URLs:

```json
{
  "calculator": "http://localhost:3000",
  "todo-auth": "http://localhost:3001",
  "pdf-analyzer": "http://localhost:3002",
  "landing-page": "http://localhost:3003",
  "chatbot": "http://localhost:3004"
}
```

### Options

| flag | meaning |
|---|---|
| `--challenge <id\|all>` | challenge id (`calculator`, `todo-auth`, `pdf-analyzer`, `landing-page`, `chatbot`) or `all` |
| `--target <url>` | submission URL (ignored for `all` when `--config` is set) |
| `--config <file>` | JSON map of challenge -> URL (for `all`) |
| `--seed <n>` | pin the seed for reproducible test vectors (default: random per run; the seed is recorded in the report) |
| `--out <dir>` | output directory (default `results/`) |
| `--headed` | run the browser headed (debugging only) |

### Exit codes (CI-friendly)

- `0` — all requested challenges **passed**
- `1` — at least one required check failed (submission rejected)
- `2` — harness/usage error (not a submission failure)

## Output

Every run writes `results/<challenge>/<timestamp>/`:

- `report.json` — the verdict document (schema below)
- evidence files: screenshots (`01-loaded.png`, ...), `console-log.json`, `04-display-readings.json`, `01-http-trace.json`, etc.

```jsonc
{
  "schemaVersion": 1,
  "harnessVersion": "1.0.0",
  "challenge": "calculator",
  "targetUrl": "http://localhost:3000",
  "seed": 2693856173,
  "startedAt": "2026-09-30T21:00:00.000Z",
  "finishedAt": "2026-09-30T21:00:09.132Z",
  "durationMs": 9132,
  "verdict": "pass",
  "summary": { "total": 13, "passed": 13, "failed": 0, "skipped": 0, "requiredFailed": 0 },
  "checks": [
    {
      "id": "calc-add",
      "name": "Addition produces the correct result",
      "severity": "required",
      "status": "pass",
      "durationMs": 512,
      "error": null,
      "evidence": []
    }
  ],
  "evidenceDir": "calculator/20260930T210000000Z",
  "resultHash": "sha256:..."
}
```

**Verdict rule:** `pass` iff every `required` check passed. `bonus` checks (capability probes like keyboard input or file-size display) inform but never block. A failed dependency marks downstream checks `skip` (not fail) so a broken page produces one clear failure plus clean skips.

**Tamper evidence:** `resultHash` is the SHA-256 of the canonical JSON of the report body (sorted keys, no whitespace). Re-hash any report to prove it was not edited after the run.

**Dispute resolution:** rerun with the recorded `--seed`; test vectors (operands, todo texts, credentials, chat messages) are identical, so the same submission produces the same result.

## Design principles

1. **Observable behavior over implementation** - checks drive the real UI / public HTTP surface. No assumptions about framework, routes, or API shape. Contract: elements must be discoverable via visible text or accessible names.
2. **Randomized, seeded vectors** - a submission cannot hardcode answers to fixed test cases; runs are exactly reproducible via `--seed`.
3. **Evidence by default** - every run leaves screenshots and readings behind for human review of disputed runs.
4. **Zero console errors policy** - `console.error` or uncaught page errors during a session fail the submission.

## Challenge contracts

The human-readable, reviewable definition of "working" for each challenge lives in [specs/](specs/):

- [specs/calculator.md](specs/calculator.md) - buttons, display discovery, arithmetic, chained ops, divide-by-zero
- [specs/todo-auth.md](specs/todo-auth.md) - register/login/logout, CRUD, persistence, per-user isolation
- [specs/pdf-analyzer.md](specs/pdf-analyzer.md) - fixture upload, marker-text extraction, metadata
- [specs/landing-page.md](specs/landing-page.md) - hero, features, CTA, pricing, viewport meta
- [specs/chatbot.md](specs/chatbot.md) - message echo, response detection, conversation continuity

The PDF challenge uses the deterministic fixture `fixtures/sample.pdf` (regenerate with `npm run make:pdf`). Its text layer contains `VERIFICATION FIXTURE ALPHA`, which exists nowhere except inside the file - extraction cannot be faked from the filename alone.

## Testing the harness

```bash
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest: unit + E2E suite
```

The E2E suite spins up a reference mock app (`tests/helpers/mock-app.ts`) that implements all five challenge contracts, then:

- asserts every challenge **passes** against the reference implementation
- asserts **fail** verdicts + skip cascades against deliberately broken variants (missing button, missing pricing/viewport)
- asserts CLI exit codes `0`/`1`/`2` via real subprocesses
- asserts the same seed reproduces identical check statuses

Browser-dependent tests auto-skip when Playwright browsers are unavailable (`canLaunchBrowser` probe).

## Integrating into the rebuilt app (for SPE-46)

The harness is deliberately dependency-free from the app side. Wiring it in:

1. **Run it where the runner runs.** Verification executes untrusted submissions' pages in a real browser - keep it on a worker/CI runner, not in the web process. Suggested CI shape: `node src/cli.ts verify --challenge <id> --target <submission-url> --seed <run-seed> --out runs/<runId>/`.
2. **Persist the report verbatim.** Store the full `report.json` (and the evidence dir) on the Run record. Do not reshape it - the `resultHash` is the audit artifact.
3. **Read the verdict.** `verdict === 'pass'` + exit code `0` = verified completion; store `durationMs` from the run timer (SPE-53), not from the harness.
4. **Expose the evidence.** Deep-link the leaderboard row to `evidenceDir` files so disputes can be reviewed without a re-run.
5. **Pin the seed on the Run.** Generate the seed at submission time and store it; anyone can then reproduce the exact verification.
6. **Sandboxing note.** The harness itself does not isolate the submission host. Run submissions on throwaway containers/preview deployments; the harness assumes the target URL is already sandboxed by the platform.

## Layout

```
src/cli.ts                  CLI entry (verify / list, exit codes)
src/core/                   harness engine
  types.ts                    Check / CheckResult / VerificationReport schema
  rand.ts                     seeded RNG (mulberry32) + test-vector helpers
  harness.ts                  sequential check runner (pass/fail/skip, requires)
  report.ts                   summary, verdict, canonical-JSON SHA-256 hash
  evidence.ts                 timestamped evidence store
  browser.ts                  Playwright session + console/page-error capture
  http.ts                     fetch-based HTTP traces
  ui.ts                       contract-based element discovery helpers
src/challenges/<id>/        one verifier per challenge
src/registry.ts             challenge registry
specs/                      verification contracts (reviewable)
fixtures/                   deterministic PDF fixture + generator
tests/                      vitest suite + reference mock app
```
