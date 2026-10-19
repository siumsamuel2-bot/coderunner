import Link from 'next/link';

import { serverTrpc } from '@/utils/trpc';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { EmptyState } from '@/components/challenges/EmptyState';
import { sortChallenges, type ChallengeListItem } from '@/lib/challenge-filters';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const challenges = await serverTrpc.challenges.list();
  const items: ChallengeListItem[] = challenges.map((challenge) => ({
    ...challenge,
    attemptCount: 0,
    fastestVerifiedMs: null,
  }));

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      <div className='px-4 py-12 sm:px-6 lg:px-8'>
        <h1 className='mb-6 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner
        </h1>
        <p className='mb-8 text-center text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
          Build apps with AI and race against the clock on verified leaderboards
        </p>

        <div className='mb-12'>
          <h2 className='mb-4 text-2xl font-semibold text-center text-gray-900 dark:text-gray-100'>
            Available Challenges
          </h2>
          {items.length > 0 ? (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {sortChallenges(items).map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          ) : (
            <EmptyState variant='no-catalog' />
          )}
        </div>

        <div className='flex justify-center space-x-4'>
          <Link
            href='/leaderboard'
            className='flex h-12 w-full items-center justify-center gap-2 rounded-full border border-solid border-indigo-600 px-5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 md:w-[200px]'
          >
            View Leaderboard
          </Link>
          <Link
            href='/feedback'
            className='flex h-12 w-full items-center justify-center gap-2 rounded-full border border-solid border-gray-400 px-5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 md:w-[200px]'
          >
            Give Feedback
          </Link>
        </div>
      </div>
    </div>
  );
}
