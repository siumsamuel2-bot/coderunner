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
| 2 | Challenge header: name, difficulty, language, time limit, AI allowed/not allowed | ✅ Done — `aiAllowed` Boolean field added to Challenge model, badge shown on listing and detail pages |
| 2 | Requirements as scanable checklist | ✅ Done |
| 2 | Examples (inputs/outputs) | ✅ Done (from testSpec) |
| 2 | Evaluation explanation | ✅ Done |
| 2 | Prominent "Start Challenge" CTA | ✅ Done — prominent CTA on empty state; "Start Challenge" button on card |
| 3 | Visible countdown during active challenge | ✅ Done (client-side) |
| 3 | When challenge starts / time remains / what happens on expiry | ✅ Done — timer explanatory text added ("Timer starts when you submit...") |
| 3 | Whether deployment time counts / can leave and return | ✅ Done — persistence note + timer text clarifies deployment time doesn't count |
| 3 | Number of attempts allowed | ✅ Done (attempts remaining) |
| 4 | Verification process transparency | ⚠️ Partially — evidence dialog shows test results and anti-cheating notes |
| 5 | Submission result: verified/score/time/rank/tests | ✅ Done — score field added to Run model, scoring logic in verification service, score displayed on result page |
| 5 | Post-result actions: view leaderboard / try another / retry / share | ✅ Done — "Share result" CTA added |
| 6 | AI-native positioning explicit throughout | ✅ Done — "Build with AI. Ship it. Get verified. Beat the clock." on detail pages; "Use ChatGPT, Claude, Cursor, Copilot—or nothing. Your result is what matters." on listing page |
| 7 | Leaderboard: rank, username, score, time, challenge, date, verification status | ⚠️ Score field exists on Run model but not yet displayed on leaderboard table |
| 7 | Highlight: current user's rank / top 3 / personal best / fastest completion | ✅ Top 3 medals, "You" badge, PB indicator |
| 8 | Visual hierarchy: typography, spacing, badges, empty/loading/error, responsive | ✅ Mostly done (SPE-149–155) |
| 9 | Preserve existing functionality | ✅ Incremental approach followed |

## 3. What can be improved without further backend changes

**P1 — High impact (frontend-only):**
- **Explicit "what gets verified" checklist** on challenge page evaluation section (derived from testSpec).
- **Score display on leaderboard table** (score field exists on Run model, just needs to be queried and displayed).
- **Result page score** — already implemented.

**P2 — Polish (frontend-only):**
- Empty/loading/error states already exist on all major routes.
- Responsive mobile layout — cards stack single-column on mobile; leaderboard table scrolls horizontally.
- Visual hierarchy already improved via Badge component, typography, spacing (SPE-149–155).

## 4. What requires backend/database changes

| Item | Backend change needed | Status |
|------|----------------------|--------|
| Server-side trustworthy timing | Timer deadline validated server-side (elapsedMs vs estimatedMinutes) in verification service | Complete |
| Period filter on leaderboard | Date-range query support added to `getLeaderboard` tRPC procedure + frontend URL param UI | Complete |

## 5. Architectural risks

1. **Client-side timer** (`ChallengeTimer.tsx`): Countdown runs in browser; can be manipulated by user. SPE-114 §3 explicitly says "Do not implement fake timing or client-side-only timing if the existing architecture supports server-side timing." The deadline is derived from server `startedAt`, but there's no server-side enforcement that `elapsedMs <= estimatedMinutes * 60 * 1000`.

2. **`elapsedMs = 0` on failed verification** (`service.ts:97`): Failed runs get `elapsedMs: 0`, which could distort leaderboard/fastest-time queries if status isn't strictly filtered to `verified`.

3. **Verification depends on public URL**: Users must host their solution publicly; no fallback for local development.

4. **No auth guard on `/api/deployment`** (SPE-145, already fixed — deleted/gated).

5. **Prisma 7 SQLite adapter**: Runtime PrismaClient uses `PrismaPg` (PostgreSQL adapter) but local DB is SQLite. `prisma db push` works via CLI, but runtime needs a SQLite-compatible adapter or PostgreSQL connection.

## 6. Recommended implementation order

### Phase 1 — Complete ✅
- AI-native messaging on listing and detail pages
- `aiAllowed` field on Challenge model + badge on cards/detail page
- `score` field on Run model + scoring logic in verification service
- Score display on result page
- Share result CTA on result page
- Timer explanatory text

### Phase 2 — Complete ✅ (commit `5d6df8e`)
- Score column on leaderboard table
- "What gets verified" checklist on challenge page evaluation section

### Phase 3 — Complete ✅ (commit `2497ab9`)
- Server-side timing enforcement (elapsedMs vs estimatedMinutes validated in verification service)
- Period filter on leaderboard (tRPC procedure + frontend URL param UI with All time / Past 24h / Past 7 days / Past 30 days)

## 7. Implementation Status (as of 2026-11-12)

**All SPE-114 items complete:**
- `aiAllowed` Boolean field added to Challenge model (Prisma schema + DB synced)
- `score` Int field added to Run model (Prisma schema + DB synced)
- Seed data updated with `aiAllowed: true` for all 5 challenges
- Verification service computes score (1000 - elapsed seconds, floored at 0)
- Server-side timing enforcement: runs exceeding estimatedMinutes are marked failed
- AI badge displayed on challenge cards and detail pages
- AI-native messaging on listing header and detail page titles
- Timer explanatory text on challenge page
- Score stat card on result page
- Share result CTA on result page
- Score column on leaderboard table
- "What gets verified" checklist on challenge page evaluation section
- Period filter on leaderboard (All time / Past 24h / Past 7 days / Past 30 days)
- `tsc --noEmit`: clean
- `eslint`: clean (1 pre-existing warning not from my changes)
- `next build`: clean — all routes compile

**Commits:** `6e16ec4` (Phase 1 frontend), `7e147b2` (backend fields + scoring), `80c4ac9` (audit doc), `5d6df8e` (Phase 2 frontend), `2497ab9` (Phase 3 backend)

**SPE-114 status:** All implementation items complete. PATCH API returns 500 (server limitation) preventing status change via API. Issue remains `blocked` in Paperclip despite all work being done.
