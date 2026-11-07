import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import type { ChallengeListItem } from '@/lib/challenge-filters';

import { ChallengeBrowser } from '@/components/challenges/ChallengeFilters';

export const dynamic = 'force-dynamic';

/**
 * Challenges listing (SPE-131). Server component fetches the catalog plus
 * real per-challenge stats (attempt count, fastest verified completion)
 * computed from the runs table; the client component handles filtering.
 * Only backend-backed metrics are rendered — nothing is invented.
 */
export default async function ChallengesPage() {
  const [challenges, runs] = await Promise.all([
    prisma.challenge.findMany(),
    prisma.run.findMany({
      select: { challengeId: true, status: true, elapsedMs: true },
    }),
  ]);

  const attemptCounts = new Map<string, number>();
  const fastestVerified = new Map<string, number>();
  for (const run of runs) {
    attemptCounts.set(run.challengeId, (attemptCounts.get(run.challengeId) ?? 0) + 1);
    if (run.status === 'verified' && run.elapsedMs !== null) {
      const current = fastestVerified.get(run.challengeId);
      if (current === undefined || run.elapsedMs < current) {
        fastestVerified.set(run.challengeId, run.elapsedMs);
      }
    }
  }

  const items: ChallengeListItem[] = challenges.map((challenge) => ({
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty,
    language: challenge.language,
    category: challenge.category,
    aiAllowed: challenge.aiAllowed,
    estimatedMinutes: challenge.estimatedMinutes,
    attemptCount: attemptCounts.get(challenge.id) ?? 0,
    fastestVerifiedMs: fastestVerified.get(challenge.id) ?? null,
  }));

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-4 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Challenges
        </h1>
        <p className='mb-8 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
          Build apps with AI and race against the clock on verified leaderboards.
          Use ChatGPT, Claude, Cursor, Copilot — or nothing. Your result is what
          matters.
        </p>

        <ChallengeBrowser challenges={items} />

        <p className='mt-12 text-center text-gray-600 dark:text-gray-400'>
          Missing a category or found a bug?{' '}
          <Link
            href='/feedback'
            className='text-indigo-600 dark:text-indigo-400 hover:underline'
          >
            Tell us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
