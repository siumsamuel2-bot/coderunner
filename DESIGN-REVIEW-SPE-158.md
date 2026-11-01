# Design Review — SPE-158 Content Surfaces (APIs category)

**Reviewer:** UXDesigner (192b5fc0-cafb-4ec2-8359-db0ddb85576d)
**Date:** 2026-11-01
**Scope:** Challenge card, challenges listing, challenge detail page, submit form, leaderboard
**Purpose:** Design-readiness review for the new APIs category challenge (SPE-158)

---

## 1. What already works well

| Surface | Strengths |
|---------|-----------|
| ChallengeCard | Difficulty/category/language/time badges, "Best verified time" stat, attempts stat, prominent "Start Challenge" CTA, hover states, dark mode |
| ChallengesList | Responsive grid (1/2/3 col), client-side search + filters (language/difficulty/category/time limit), empty state for no matches, "Clear filters" action |
| Challenge detail page | All SPE-114 sections present (header, what you'll build, requirements checklist, examples, evaluation, journey indicator, timer, attempts, start CTA), real backend data only, loading/error/empty states |
| SubmitRunForm | Clear submission flow, URL input, verification status polling via SSE, success/failed/verifying states |
| LeaderboardTable | Medals (gold/silver/bronze), "You" marker for current user, "PB" personal-best marker, verification badges, evidence dialog, dark mode |
| Badge component | Shared variants (difficulty, category, language, time, verification), consistent styling, dark mode support |

---

## 2. Gaps & inconsistencies (SPE-105 residuals)

### Error copy (actionability)
- `SubmitRunForm.tsx:63`: "Failed to submit run. Please try again." → **fixed** — now includes actionable guidance (check internet + public URL accessibility)
- `page.tsx:328` (challenge detail): "No reason provided." → **fixed** — now reads "No specific reason was returned. Try resubmitting your solution."
- Leaderboard page load error already actionable ("Please check your connection and retry.")

### Shared button/component language
- "Start Challenge" CTA is consistent across card (button) and detail page empty state (Link) — styling matches (indigo border, hover:bg-indigo-50)
- No divergent button variants found across challenge surfaces

### Leaderboard
- SPE-64 addressed WR badge, "that's you" marker, filter consistency — all present
- No period filter on leaderboard (SPE-64 noted as deferred/out of scope)

---

## 3. Recommendations for APIs category challenge (SPE-158)

### Data requirements (no fabricated metrics)
The new APIs challenge must only render real backend data:
- `category` = "apis" (new category value, must appear in filter options automatically via `ChallengesList` dedupe)
- `language` — actual tech (e.g., "REST", "GraphQL", "Node")
- `difficulty` — "medium" per spec; badge color maps via `difficultyColor()` (yellow)
- `estimatedMinutes` — real time limit
- `acceptanceCriteria` — parsed into requirements checklist via `parseRequirements()`
- `testSpec.checks` — drives Examples section
- `_count.runs` — Total Attempts
- `runs[0].elapsedMs` — Best verified time

### Surface readiness
All consuming surfaces are category-agnostic and will pick up the new challenge automatically:
- `ChallengeCard` — renders category/time/language badges generically
- `ChallengesList` — category filter options derive from data (`new Set(challenges.map(c => c.category))`)
- `page.tsx` (detail) — renders category/language/time/difficulty from challenge record
- `LeaderboardTable` — groups by challenge slug, no category coupling

### UX checklist for the APIs challenge
- [ ] Challenge seeded with `category: "apis"` and valid `language`/`difficulty`/`estimatedMinutes`
- [ ] `acceptanceCriteria` present (non-empty) so Requirements section renders
- [ ] `testSpec.checks` present so Examples section renders
- [ ] At least one verified run exists so "Best verified time" isn't just "—"
- [ ] Verify on `/challenges` that "apis" appears in the Category filter dropdown
- [ ] Verify on `/challenges/[slug]` that all sections render with real data
- [ ] Verify dark mode rendering on all surfaces

---

## 4. SPE-105 residual polish status

| Item | Status |
|------|--------|
| Error copy → actionable | Done (this review) |
| Leaderboard residuals (filter, "that's you", WR badge) | Done in SPE-64; period filter deferred |
| Shared button/component language consistency | Consistent; no action needed |

---

## 5. Verdict

Content surfaces are **design-ready** for the APIs category challenge. All consuming components are category-agnostic and derive options from data. No new components or variant additions required for SPE-158. Error copy improvements landed in this review.
