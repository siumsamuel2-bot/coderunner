# SPE-143 Design Specs — Next UX Wave

## Principles
- **No fabricated data**: Only display data that exists in the backend (Challenge, Run, Verification, VerificationJob). If a metric doesn't exist, leave it out or mark it as not available.
- **Design tokens**: Geist Sans / Geist Mono, Tailwind 4, `bg-zinc-50`/`dark:bg-black`, `bg-white`/`dark:bg-gray-800` cards, `text-gray-900`/`dark:text-gray-100`, indigo-600 primary, green-600 success, red-600 error, yellow-600 warning.
- **Competitive platform feel**: GitHub + modern developer tools + competitive gaming — clean, developer-focused, not flashy.
- **State coverage**: Every screen handles loading, error, empty, and success states.

---

## Spec 1: Verified Leaderboard Transparency Page

### Goal
Make verification transparent so users understand *how* a run was verified and *what* evidence backs each leaderboard entry.

### Screens
**Leaderboard page (`/leaderboard`)** — per challenge, grouped by slug.

### Acceptance Criteria
1. Each leaderboard entry shows: rank, username, avatar, completion time, submission date, verification status badge.
2. Verification status badge is one of: `Verified` (green), `Failed` (red), `Pending` (yellow), `N/A` (gray).
3. Clicking an entry opens a **run evidence modal** showing:
   - Verification status and verifiedAt timestamp
   - Test results (functional, acceptance, performance) — only if backend provides them
   - Deployment verification status — only if backend provides it
   - Anti-cheating mechanisms applied (only claim what VerificationJob.status/attempts actually reflects)
   - Prompt chain and tool log summary (only if Run.promptChain/toolLog exist)
4. No fake statistics: no user counts, no submission history, no fake test names.
5. Empty state: "No verified runs yet. Be the first on the board." (existing, keep)
6. Loading state: skeleton table rows while fetching.
7. Error state: inline error banner with retry action.

### Component Notes
- Reuse existing table structure; add a "View evidence" button per row that opens a dialog.
- Verification badge: colored pill (green/red/yellow/gray) with status text.
- Evidence dialog: scrollable, grouped sections (Tests, Deployment, Anti-cheating, Session), collapsible sections for prompt chain/tool log.
- Consistent with existing table classes: `divide-y divide-gray-200 dark:divide-gray-700`, `bg-white dark:bg-gray-800`.

---

## Spec 2: Submission Result Page Redesign

### Goal
Replace the inline success message in SubmitRunForm with a proper, dedicated results experience showing verdict, score, time, rank, tests, and next actions.

### Screens
**Submission result page (`/runs/[runId]/result`)** — reached after successful submission + verification.

### Acceptance Criteria
1. **Verdict**: Large "Verified ✓" / "Failed ✗" / "Verifying…" status at top.
2. **Score**: Only if backend calculates score (Run.score or derived). Otherwise omit.
3. **Completion time**: `X.XXs` from Run.elapsedMs, only when verified and not null.
4. **Rank**: User's rank on this challenge's leaderboard (computed from verified runs with lower elapsedMs). Only if computable.
5. **Tests**: List of test categories (functional, acceptance, performance) with pass/fail — only from Verification.testOutput if present.
6. **Next-action CTAs**: "View leaderboard", "Try another challenge", "Retry challenge" (if attempts remain per VerificationJob.maxAttempts).
7. Empty/error state: "Verification failed" with reason from Verification.testOutput, plus retry CTA.
8. Loading state: "Verification in progress…" with pulse animation while status is `verifying`/`submitted`.

### Component Notes
- Verdict badge: large colored pill centered at top.
- Metric cards: Score, Time, Rank — 3-column grid on desktop, stacked on mobile.
- Tests section: checklist with ✓/✗ icons per test category.
- CTA row: primary (View leaderboard), secondary (Try another, Retry).
- No fabricated scores or ranks — compute rank from actual verified runs data.

---

## Spec 3: Competition Flow Clarity

### Goal
Make the entry → submit → verify → rank journey explicit with clear timing and state communication.

### Screens
**Challenge detail page (`/challenges/[slug]`)** — add timer + journey indicators.

### Acceptance Criteria
1. **Timer visibility**: When a run is in progress for the user, show a visible countdown (from Run.startedAt + challenge.estimatedMinutes). Server-derived, not client-side-only.
2. **Timer expiry**: Show "Time expired" state when the challenge time limit has passed and run is not verified.
3. **Journey indicator**: Progress steps (Entry → Submit → Verify → Rank) with active step highlighted based on Run.status.
4. **Attempts**: Show remaining attempts if VerificationJob tracks them (attempts/maxAttempts).
5. **Can leave and return**: Clear note that the run persists server-side (user can navigate away and come back).
6. **Empty state**: "You haven't started this challenge yet." with primary CTA.
7. **Error state**: Submission failure banner with retry.

### Component Notes
- Timer: mono font (Geist_Mono), prominent, red when <30s remaining.
- Journey: horizontal stepper with 4 steps, active step in indigo-600, completed in green-600, pending in gray-400.
- Timer driven by server timestamps (Run.startedAt, endedAt) to avoid client-side drift.
- No fake timing — if Run doesn't have startedAt/endedAt populated, show "Timing not available" rather than a fake countdown.

---

## Spec 4: Responsive / Visual Hierarchy Polish Pass

### Goal
Raise visual quality across all screens: mobile breakpoints, spacing, token consistency, empty/loading/error states.

### Screens
All pages: Home, Challenges list, Challenge detail, Leaderboard, Dashboard, Submission result.

### Acceptance Criteria
1. **Mobile**: Single-column layout on <640px, stacked cards, full-width CTAs, readable text sizes.
2. **Spacing**: Consistent 1.5rem section gaps, 1rem card padding, 0.5rem element gaps.
3. **Typography hierarchy**: h1 (page title), h2 (section), h3 (card title), body, caption — consistent scale across pages.
4. **Badges**: Consistent language/difficulty/status badges (rounded-full, px-2 py-0.5, text-xs font-medium).
5. **Empty states**: Icon + text + primary CTA on every list/table page.
6. **Loading states**: Skeleton cards/tables, pulse animations for async actions.
7. **Error states**: Inline error banners (red-50/dark:red-900/50) with retry action.
8. **Dark mode**: All polish applies to both light and dark variants.

### Component Notes
- Reuse existing card classes: `bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6`.
- Buttons: indigo-600 primary, gray-100/dark:bg-gray-700 secondary, consistent padding (py-3 px-4).
- Inputs: `border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500`.
- No flashy gaming aesthetics — keep developer-tool aesthetic.

---

## Done Criteria
- [ ] Specs document posted on SPE-143 (this comment)
- [ ] Acceptance criteria defined per screen for all 4 areas
- [ ] Component notes reference existing design tokens and classes
- [ ] State coverage (loading/error/empty) specified for every screen
- [ ] No fabricated data claims — all metrics tied to backend models
- [ ] Consistent with SPE-130 P0 priority order and SPE-126/SPE-127 spec format

## Related
- Parent: SPE-130
- Production reference: https://coderunner-web.workers.dev
- Current wave: SPE-131/132/136/137/138
- Cadence: SPE-107 Week 4-5
