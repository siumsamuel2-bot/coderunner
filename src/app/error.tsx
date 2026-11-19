'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Global error boundary (SPE-137): honest failure state with a working
 * retry. Logs to the console so the browser devtools keep the stack.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center'>
      <svg
        aria-hidden='true'
        className='mb-3 h-8 w-8 text-red-500 dark:text-red-400'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        />
      </svg>
      <h1 className='mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100'>
        Something went wrong
      </h1>
      <p className='mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400'>
        An unexpected error occurred while rendering this page. You can retry,
        or head back to the challenges.
      </p>
      <div className='flex flex-wrap justify-center gap-3'>
        <button
          type='button'
          onClick={reset}
          className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
        >
          Try again
        </button>
        <Link
          href='/challenges'
          className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
        >
          Browse challenges
        </Link>
      </div>
    </div>
  );
}
