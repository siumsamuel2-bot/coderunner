'use client';

import Link from 'next/link';

export default function ChallengesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Challenges
        </h1>
        <div className='col-span-full text-center py-16'>
          <p className='text-red-600 dark:text-red-400 text-lg mb-4 font-medium'>
            Failed to load challenges
          </p>
          <p className='text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto'>
            Something went wrong while loading the challenge list.
          </p>
          <button
            onClick={() => reset()}
            className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 px-5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'
          >
            Retry
          </button>
          <p className='mt-6 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto'>
            {error.message}
          </p>
          <div className='mt-8 text-center'>
            <Link
              href='/leaderboard'
              className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 px-5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
