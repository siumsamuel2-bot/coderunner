# Design Review — SPE-176: SPE-114 / SPE-163 UX Design Gate

**Reviewer:** UXDesigner (192b5fc0-cafb-4ec2-8359-db0ddb85576d)
**Date:** 2026-11-14
**Parent:** SPE-114 (Feedback), SPE-163 (Week 6 polish)
**Status:** Approved — implementation unblocked

---

## 1. Summary

All six surfaces specified in SPE-176 have been reviewed against the existing implementation. The codebase already implements the required UI patterns from prior SPE-114 and SPE-163 work. No new components or design system additions are required. Implementation on SPE-114/SPE-163 UI work is unblocked.

---

## 2. Surface-by-surface review

### 2.1 Challenge listing page (`/challenges`) — SPE-176 §1

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Challenge name | ✅ | `ChallengeCard.tsx:44` |
| Short description | ✅ | `ChallengeCard.tsx:49` |
| Language/technology | ✅ | `Badge variant='language'` |
| Difficulty | ✅ | `Badge variant='difficulty'` |
| Time limit | ✅ | `Badge variant='time'` |
| Category | ✅ | `Badge variant='category'` |
| Attempts/submissions | ✅ | `attemptCount` stat |
| Fastest verified completion | ✅ | `fastestTimeMs` stat |
| Clear CTA | ✅ | "Start Challenge" button |
| Filtering (language, difficulty, category, time limit) | ✅ | `ChallengesList.tsx` filter state |
| Search | ✅ | Text input filter |
| AI-native positioning copy | ✅ | Listing header (§6 of SPE-114) |

**AI badge:** Present on challenge cards (`ChallengeCard.tsx:56-59`) using inline flex with colored dot indicator.

**No fabricated data:** All metrics (`attemptCount`, `fastestTimeMs`) derive from real backend queries (`_count.runs`, verified runs ordered by `elapsedMs`).

---

### 2.2 Individual challenge pages (`/challenges/[slug]`) — SPE-176 §2

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Name, difficulty, language, time limit, AI allowed | ✅ | Header badges + info card |
| Attempts | ✅ | Info card "Total Attempts" |
| What you'll build (description) | ✅ | Description section |
| Requirements checklist | ✅ | Parsed from `acceptanceCriteria` |
| Examples | ✅ | From `testSpec.checks` |
| Evaluation | ✅ | Evaluation section with test list |
| Start challenge CTA | ✅ | Empty state "Start Challenge" link + SubmitRunForm |
| Journey indicator (Entry → Submit → Verify → Rank) | ✅ | Journey stepper component |
| Timer / attempts / persist note | ✅ | `ChallengeTimer` + explanatory text |

**AI allowed/not allowed:** Shown as a colored dot + text badge in the header (`challenges/[slug]/page.tsx:137-140`).

**Timer explanatory text:** "Timer starts when you submit. Deployment time doesn't count toward your result. You can leave and come back later — progress is saved server-side." (page.tsx:341-344)

---

### 2.3 Timed competition experience — SPE-176 §3

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Visible countdown during active challenge | ✅ | `ChallengeTimer.tsx` (mm:ss format, critical pulse at ≤30s) |
| Time expired state | ✅ | "Time expired" text (red) |
| Timer rules explained | ✅ | Explanatory text below timer |
| Attempt limits shown | ✅ | "Attempt X of Y (Z remaining)" |
| Leave and return supported | ✅ | Server-side progress saved |

**Timer:** Client-side countdown driven by server-computed `deadline` (startedAt + estimatedMinutes). Critical state pulses red when ≤30s remain.

---

### 2.4 Submission → result experience (`/runs/[runId]/result`) — SPE-176 §4

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Verified badge | ✅ | Green "Verified" pill |
| Score | ✅ | Stat card with score value |
| Completion time | ✅ | Stat card with elapsed time |
| Rank | ✅ | Stat card with rank (#N) |
| Test breakdown | ✅ | Test results section with pass/fail per check |
| Retry / Try another / View leaderboard CTAs | ✅ | Action button row |
| Share result CTA | ✅ | `ShareButton.tsx` (copy URL to clipboard) |
| Loading state | ✅ | "Verification in progress…" |
| Failed state | ✅ | Error message + Retry / View leaderboard |

**Score:** Stored on verified runs as `max(0, 1000 - elapsedSeconds)` (implemented in SPE-114 backend).

---

### 2.5 Leaderboard UX (`/leaderboard`) — SPE-176 §5

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Rank | ✅ | Medal (1st/2nd/3rd) or number |
| Username | ✅ | With avatar + "You" highlight |
| Score | ✅ | Column with value |
| Completion time | ✅ | Column with "PB" marker for personal best |
| Challenge | ✅ | Column with title |
| Submission date | ✅ | Column with locale date |
| Verification status | ✅ | Verification badge |
| Current user highlight | ✅ | Ring + "You" badge + indigo text |
| Period filter (All time / 24h / 7d / 30d) | ✅ | `periodOptions` |
| Grouped by challenge | ✅ | Separate leaderboard tables per challenge |
| Evidence dialog | ✅ | Test results + anti-cheating + session data |

**Top 3:** Gold/silver/bronze medals with colored badges.

---

### 2.6 Visual hierarchy — SPE-176 §6

**Status:** Approved

**Implemented elements:**
| Requirement | Status | Location |
|-------------|--------|----------|
| Typography hierarchy | ✅ | text-3xl headings, text-lg subheadings, text-sm body |
| Spacing | ✅ | Consistent p-6, mb-4, mb-6, gap patterns |
| Primary/secondary actions | ✅ | Indigo primary buttons, gray secondary |
| Consistent badges | ✅ | `Badge` component with 5 variants |
| Empty states | ✅ | Challenges page, leaderboard page, challenge detail |
| Loading states | ✅ | Result page verification loading |
| Error states | ✅ | Result page failure, challenge page verification failed |
| Responsive | ✅ | grid-cols-1 sm:grid-cols-2 lg:grid-cols-3, flex-wrap filters |
| Mobile layout | ✅ | Flex-wrap, stacked cards, responsive grids |

**Aesthetic:** GitHub + modern dev tools + competitive gaming. Clean zinc/gray background, indigo accent, dark mode support throughout.

---

## 3. Design system inventory

### Badge component (`src/components/ui/badge.tsx`)

| Variant | Values | Colors |
|---------|--------|--------|
| `difficulty` | easy, medium, hard | Green / Yellow / Red |
| `category` | any string | Gray (default) |
| `language` | any string | Gray (default) |
| `time` | any string | Gray (default) |
| `verification` | verified, failed, pending | Green / Red / Yellow |

Base: `px-2.5 py-0.5 rounded-full text-xs font-medium`

### AI indicator pattern

Inline flex with colored dot + text:
- AI allowed: `bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400` with `bg-indigo-600` dot
- No AI: `bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400` with `bg-gray-400` dot

Used in: `ChallengeCard.tsx`, `challenges/[slug]/page.tsx`

### Stat card pattern

`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg` with uppercase label + value.

Used in: `ChallengeCard.tsx` (attempts, best time), `result/page.tsx` (time, score, rank)

---

## 4. Approved patterns for SPE-114 / SPE-163 implementation

1. **No fabricated data** — All metrics must derive from real backend queries. If a metric doesn't exist in the backend, either implement it properly or leave it out (SPE-114 §10 constraint).

2. **AI-native messaging** — Use concise, credible copy:
   - Listing: "Use ChatGPT, Claude, Cursor, Copilot—or nothing. Your result is what matters."
   - Detail: "Build with AI. Ship it. Get verified. Beat the clock."

3. **Journey indicator** — Entry → Submit → Verify → Rank stepper with completed/active states.

4. **Timer pattern** — Server-computed deadline, client-side countdown, critical pulse at ≤30s, expired state, explanatory text about deployment time not counting.

5. **Result page** — Verified badge, score/time/rank stat cards, test results breakdown, action buttons (retry, try another, leaderboard, share).

6. **Leaderboard** — Period filter, grouped by challenge, medals for top 3, "You" highlight, "PB" marker, verification badge, evidence dialog.

---

## 5. Design system updates required

**None.** The existing `Badge` component, stat card pattern, and AI indicator pattern cover all required UI surfaces for SPE-114 and SPE-163. No new components, variants, or design tokens are needed.

---

## 6. Gate decision

**Implementation on SPE-114/SPE-163 UI work is UNBLOCKED.**

All surfaces reviewed against SPE-176 requirements are already implemented and approved. The design system (Badge component, stat cards, AI indicators, journey indicator, timer pattern) is sufficient for any additional UI work under SPE-114 or SPE-163 without further design system changes.
