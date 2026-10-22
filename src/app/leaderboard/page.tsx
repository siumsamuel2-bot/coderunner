import Link from 'next/link';
import type { Metadata } from 'next';

import { serverTrpc } from '@/utils/trpc';
import { LeaderboardTable } from './LeaderboardTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Global speedrun leaderboard - fastest verified AI app-building times across all challenges.',
};

type LeaderboardRun = Awaited<ReturnType<typeof serverTrpc.runs.getLeaderboard>>[number];

export default async function LeaderboardPage() {
  let topRuns: LeaderboardRun[] = [];
  let loadError: string | null = null;

  try {
    topRuns = await serverTrpc.runs.getLeaderboard();
  } catch {
    loadError =
      'Failed to load the leaderboard. Please check your connection and retry.';
  }

  // Group verified runs by challenge for separate leaderboards
  const runsByChallenge: Record<string, typeof topRuns> = {};
  for (const run of topRuns) {
    const slug = run.challenge.slug;
    if (!runsByChallenge[slug]) runsByChallenge[slug] = [];
    runsByChallenge[slug].push(run);
  }

  const slugs = Object.keys(runsByChallenge);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Leaderboard
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-4xl mx-auto'>
          Fastest verified times for each challenge
        </p>

        {loadError && (
          <div className='mb-8 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md flex items-center gap-2 text-sm'>
            <span className='font-medium'>Unable to load leaderboard</span>
            <span>{loadError}</span>
            <Link
              href='/leaderboard'
              className='ml-auto text-indigo-600 dark:text-indigo-400 font-medium hover:underline'
            >
              Retry
            </Link>
          </div>
        )}

        <div className='mb-8'>
          <div className='flex flex-wrap -mb-px'>
            {slugs.map((slug) => (
              <Link
                key={slug}
                href={`/challenges/${slug}`}
                className='mr-2 mb-2 px-4 py-2 rounded-t-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              >
                {runsByChallenge[slug][0]?.challenge.title}
              </Link>
            ))}
          </div>
        </div>

        {slugs.length === 0 && (
          <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
            No verified runs yet. Be the first on the board.
          </p>
        )}

        {slugs.map((slug) => (
          <div key={slug} className='mb-12'>
            <h2 className='mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100'>
              {runsByChallenge[slug][0]?.challenge.title} Leaderboard
            </h2>

            <div className='overflow-x-auto'>
              <LeaderboardTable runs={runsByChallenge[slug]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
