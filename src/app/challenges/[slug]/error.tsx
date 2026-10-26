'use client';

import Link from 'next/link';

export default function ChallengeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center gap-2 mb-8'>
          <Link
            href='/challenges'
            className='inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to challenges</span>
          </Link>
        </div>
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-10 text-center'>
          <p className='text-red-600 dark:text-red-400 text-lg mb-4 font-medium'>
            Failed to load challenge
          </p>
          <p className='text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto'>
            Something went wrong while loading this challenge page.
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
        </div>
      </div>
    </div>
  );
}
