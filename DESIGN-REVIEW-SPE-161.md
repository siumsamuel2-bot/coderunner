# Design Review — SPE-161: book-library-api challenge content (SPE-158)

**Reviewer:** UXDesigner (192b5fc0-cafb-4ec2-8359-db0ddb85576d)
**Date:** 2026-11-04
**Parent:** SPE-158
**Challenge:** book-library-api

---

## 1. Surface readiness (category-agnostic — verified)

All consuming surfaces derive options from data and require no new components or variant additions for the book-library-api challenge:

| Surface | Status | Notes |
|---------|--------|-------|
| `ChallengeCard` | Ready | Renders category/language/difficulty/time badges generically via `Badge` component |
| `ChallengesList` | Ready | Category filter options derive from data (`new Set(challenges.map(c => c.category))`) |
| Challenge detail page | Ready | Renders category/language/time/difficulty from challenge record; `_count.runs` for Total Attempts |
| `LeaderboardTable` | Ready | Groups by challenge slug, no category coupling |

**Verdict:** Surfaces are design-ready. No UI changes needed.

---

## 2. Blocker: challenge not seeded in database

The `book-library-api` challenge does **not** exist in any data source checked:

| Source | Result |
|--------|--------|
| `prisma/seed.ts` | Only 5 challenges: calculator, todo-auth, pdf-analyzer, landing-page, chatbot |
| `prisma/dev.db` (SQLite) | No `book-library-api` record |
| PostgreSQL `postgres` DB (127.0.0.1:5432) | No `challenge` table in `public` schema |

**Impact:** The challenge cannot appear on `/challenges` or `/challenges/book-library-api` until it is seeded. Rendering cannot be verified until the challenge record exists.

---

## 3. Required before verification

1. Add `book-library-api` to `prisma/seed.ts` with:
   - `slug: "book-library-api"`
   - `title`, `description`, `difficulty`, `estimatedMinutes`, `category`, `language`
   - `testSpec.checks` (drives Examples section)
   - `acceptanceCriteria` (drives Requirements section)
2. Run `prisma db seed` to insert the challenge
3. Verify on `/challenges` that the challenge appears in the listing
4. Verify on `/challenges/book-library-api` that all sections render with real data
5. Verify dark mode rendering

---

## 4. SPE-105 residual check

Error copy and button language are consistent across all challenge surfaces (fixed in SPE-105/SPE-158). No residual issues found.

---

## 5. Verdict

**Content surfaces are design-ready for book-library-api.** The only blocker is the missing database seed record. Once seeded, no code changes are required for the challenge to render correctly.
