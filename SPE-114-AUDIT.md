# SPE-114 Audit — CodeRunner UX/Product Review

Date: 2026-11-11
Reviewer: UXDesigner (192b5fc0-cafb-4ec2-8359-db0ddb85576d)
Issue: SPE-114 (Feedback, high, blocked, assigned to UXDesigner)

## 1. What already works well

**Challenge discovery (`/challenges`)**
- Challenge cards display: name, description, difficulty badge, category badge, language badge, time-limit badge, attempt count, fastest verified time
- Client-side filter/search: text search, language, difficulty, category, time limit dropdowns
- Empty state ("No challenges available yet") with "View leaderboard" CTA
- Loading (`loading.tsx`) and error (`error.tsx`) boundary on the route

**Individual challenge page (`/challenges/[slug]`)**
- Header breadcrumb ("Back to challenges"), badges for difficulty/category/language/time
- "What you'll build" section with description
- Requirements checklist parsed from `acceptanceCriteria`
- Examples section from `testSpec.checks` (DOM, interaction, API, output, edge, viewport types)
- Evaluation section explaining verification
- Journey indicator: Entry → Submit → Verify → Rank with completed/active states
- Timer shows when a run is in progress (deadline from `startedAt + estimatedMinutes`)
- Attempts remaining counter (from `VerificationJob.maxAttempts`)
- Persistence note ("run is saved server-side — leave and come back")
- Error state for failed verification with test output
- Empty state ("You haven't started this challenge yet") with "Start Challenge" CTA
- Submit run form: solution URL input, verification status polling (SSE), success/error states
- `Total Attempts` stat added to header info grid (SPE-157)

**Timed competition experience**
- `ChallengeTimer` client-side countdown with critical (<30s) pulse styling
- "Time expired" state at zero
- Deadline computed server-side from `startedAt + estimatedMinutes`, passed to client

**Verified leaderboard (`/leaderboard`)**
- Runs grouped by challenge with per-challenge leaderboards
- Medal badges (gold/silver/bronze) for ranks 1-3
- Personal best ("PB") indicator for current user
- "You" highlight on current user's row
- Verification status badge per run
- Evidence dialog: status, verified-at, test results breakdown, anti-cheating notes, session (promptChain/toolLog)
- Challenge tab navigation
- Empty state ("No verified runs yet")

**Submission → result (`/runs/[runId]/result`)**
- Loading state ("Verification in progress…")
- Failed state with reason, retry/view leaderboard CTAs
- Verified state with time, rank, test results breakdown, try another/retry/view leaderboard CTAs
- Rank computed by counting verified runs with lower elapsedMs

**Backend / data model**
- Prisma schema: User, Challenge, Run, Verification, VerificationJob
- Challenge fields: slug, title, description, difficulty, estimatedMinutes, category, language, testSpec (JSON), acceptanceCriteria
- Run fields: status, startedAt, endedAt, elapsedMs, promptChain, toolLog
- Verification: status, testOutput, verifiedAt
- VerificationJob: status, attempts, maxAttempts, error
- API routes: POST/GET `/api/runs`, POST `/api/verify`, tRPC `runs.getLeaderboard`
- Verification harness (`@coderunner/verification-harness`) runs headless against the submitted URL
- Seed data: 5 challenges (Calculator, Todo app with auth, PDF analyzer, Landing page, Chatbot)

**Design system**
- Shared `Badge` component (difficulty/category/language/time variants)
- Consistent indigo primary, zinc/gray neutral, dark mode support
- Responsive grid (1 col mobile → 2 col sm → 3 col lg)

## 2. What is missing

Per SPE-114 requirements:

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Challenge cards show all listed fields | ✅ Done |
| 1 | Filtering: language, difficulty, category, time limit | ✅ Done (client-side) |
| 2 | Challenge header: name, difficulty, language, time limit, AI allowed/not allowed | ⚠️ Missing `AI allowed/not allowed` — no `aiAllowed` field on Challenge model |
| 2 | Requirements as scanable checklist | ✅ Done |
| 2 | Examples (inputs/outputs) | ✅ Done (from testSpec) |
| 2 | Evaluation explanation | ✅ Done |
| 2 | Prominent "Start Challenge" CTA | ⚠️ Only in empty state; not prominent in main content |
| 3 | Visible countdown during active challenge | ✅ Done (client-side) |
| 3 | When challenge starts / time remains / what happens on expiry | ⚠️ Partially — countdown shown, but no explicit "starts when you submit" messaging |
| 3 | Whether deployment time counts / can leave and return | ⚠️ Persistence note exists; deployment-time counting not documented |
| 3 | Number of attempts allowed | ✅ Done (attempts remaining) |
| 4 | Verification process transparency (functional/hidden tests, acceptance criteria, performance, deployment verification, anti-cheating) | ⚠️ Partially — evidence dialog shows test results and anti-cheating notes, but no explicit "what gets verified" checklist on challenge page |
| 5 | Submission result: verified/score/time/rank/tests | ⚠️ Partially — result page shows time + rank + tests, but no **score** (no scoring system exists) |
| 5 | Post-result actions: view leaderboard / try another / retry / share | ⚠️ Missing "Share result" |
| 6 | AI-native positioning explicit throughout | ❌ Not present — no AI allowed badge, no "Build with AI" messaging on challenge pages |
| 7 | Leaderboard: rank, username, score, time, challenge, date, verification status | ⚠️ Missing **score**; has rank/user/time/challenge/date/verification |
| 7 | Highlight: current user's rank / top 3 / personal best / fastest completion | ✅ Top 3 medals, "You" badge, PB indicator |
| 8 | Visual hierarchy: typography, spacing, badges, empty/loading/error, responsive | ✅ Mostly done (SPE-149–155) |
| 9 | Preserve existing functionality | ✅ Incremental approach followed |

## 3. What can be improved without backend changes

**P1 — High impact (frontend-only):**
- **AI-native messaging**: Add "Build with AI. Beat the clock." copy on challenge listing header and challenge pages. AI rules already uniform (all challenges allow AI per seed data — no per-challenge variation exists).
- **Prominent "Start Challenge" CTA** on challenge page main content (currently only in empty state).
- **Explicit "what gets verified" checklist** on challenge page evaluation section (functional tests, acceptance criteria, etc. — derived from testSpec).
- **Timer clarity**: Add text explaining "Timer starts when you submit. Deployment time does not count toward your score. You can leave and return — progress is saved server-side."
- **Result page score**: Currently no score exists; could display elapsed time more prominently as the ranking metric.
- **Share result** CTA on result page.

**P2 — Polish (frontend-only):**
- Empty/loading/error states already exist on all major routes — verify coverage.
- Responsive mobile layout — cards stack single-column on mobile; leaderboard table scrolls horizontally.
- Visual hierarchy already improved via Badge component, typography, spacing (SPE-149–155).

## 4. What requires backend/database changes

| Item | Backend change needed |
|------|----------------------|
| AI allowed/not allowed badge | Add `aiAllowed` Boolean field to Challenge model; seed data; update queries |
| Scoring / score field | Add `score` Int field to Run model; compute score; display on result page and leaderboard |
| Server-side trustworthy timing | Timer deadline currently computed client-side from `startedAt + estimatedMinutes`. For trustworthiness, deadline should be validated server-side (elapsedMs vs estimatedMinutes). |
| Period filter on leaderboard | Add date-range query support to `getLeaderboard` tRPC procedure |
| "Fastest completion" highlight on leaderboard | Already shows fastest time per challenge via `elapsedMs` ordering |

## 5. Architectural risks

1. **Client-side timer** (`ChallengeTimer.tsx`): Countdown runs in browser; can be manipulated by user. SPE-114 §3 explicitly says "Do not implement fake timing or client-side-only timing if the existing architecture supports server-side timing." The deadline is derived from server `startedAt`, but there's no server-side enforcement that `elapsedMs <= estimatedMinutes * 60 * 1000`.

2. **`elapsedMs = 0` on failed verification** (`service.ts:97`): Failed runs get `elapsedMs: 0`, which could distort leaderboard/fastest-time queries if status isn't strictly filtered to `verified`.

3. **Verification depends on public URL**: Users must host their solution publicly; no fallback for local development.

4. **No auth guard on `/api/deployment`** (SPE-145, already fixed — deleted/gated).

5. **`aiAllowed` not in schema**: SPE-114 §2 and §6 require showing AI rules per challenge, but the Challenge model has no field for it. Per SPE-114 §10 ("Don't fabricate functionality"), this badge cannot be added without a backend field.

## 6. Recommended implementation order

Per SPE-114 §11 priorities, adjusted for what's already done (SPE-149–158) and what's frontend-actionable:

### Phase 1 — Frontend-only (no backend) — Can start now

1. **AI-native messaging**: Add "Build with AI. Beat the clock." / "Use ChatGPT, Claude, Cursor, Copilot—or nothing. Your result is what matters." to challenge listing header and challenge pages.
2. **Prominent "Start Challenge" CTA** on challenge page main content area.
3. **Verification transparency checklist** on challenge page evaluation section.
4. **Timer explanatory text** (starts on submit, deployment time doesn't count, can leave/return).
5. **Share result** CTA on result page.
6. **Result page prominence**: Make elapsed time/rank more prominent as the ranking metric (no score exists yet).

### Phase 2 — Requires backend (blocked until API work)

7. `aiAllowed` field on Challenge model → AI allowed/not allowed badge.
8. `score` field on Run model → score display on result page + leaderboard.
9. Server-side timing enforcement.
10. Period filter on leaderboard.

### Blocker

`aiAllowed` badge (SPE-114 §2, §6) and scoring (SPE-114 §5) require Prisma schema changes + API updates. These are backend-blocked and cannot be implemented by UXDesigner alone.

## 7. Notes

- SPE-149 through SPE-158 (all done) already delivered most P1/P2 frontend work: challenge card redesign, challenge page redesign, leaderboard UX, filters/search, loading/error states, responsive layout, visual polish, Badge design system.
- SPE-114 remains `blocked` — likely because the remaining items (AI badge, scoring, server timing) require backend work that hasn't been scheduled.
- Recommendation: Execute Phase 1 frontend-only items, then reassess SPE-114 blocker status once Phase 1 is complete.
