import Link from 'next/link';

type Variant = 'no-results' | 'no-catalog' | 'no-verified-runs';

/**
 * Shared empty states (SPE-126 §2.3). `no-results` = filters matched nothing
 * (offers Clear all); `no-catalog` = no challenges exist at all;
 * `no-verified-runs` = the leaderboard has no verified runs yet (§2.6).
 */
export function EmptyState({
  variant,
  onClearFilters,
}: {
  variant: Variant;
  onClearFilters?: () => void;
}) {
  if (variant === 'no-verified-runs') {
    return (
      <div className='py-12 text-center'>
        <svg
          aria-hidden='true'
          className='mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-600'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M8 21h8m-4-4v4m-4-13a4 4 0 118 0c0 1.5-.5 2.5-1.5 3.5S13 12 13 14h-2c0-2-1-3-2-4s-1.5-2-1.5-3.5z'
          />
        </svg>
        <p className='font-medium text-gray-900 dark:text-gray-100'>
          No verified runs yet. Be the first on the board.
        </p>
        <Link
          href='/challenges'
          className='mt-4 inline-flex rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500'
        >
          Browse challenges
        </Link>
      </div>
    );
  }
  if (variant === 'no-results') {
    return (
      <div className='py-12 text-center'>
        <svg
          aria-hidden='true'
          className='mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-600'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
          />
        </svg>
        <p className='text-gray-900 dark:text-gray-100 font-medium'>
          No challenges match your filters
        </p>
        <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
          Try removing a filter or two.
        </p>
        {onClearFilters && (
          <button
            type='button'
            onClick={onClearFilters}
            className='mt-4 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500'
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }
  return (
    <div className='py-12 text-center'>
      <svg
        aria-hidden='true'
        className='mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-600'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
          d='M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9'
        />
      </svg>
      <p className='font-medium text-gray-900 dark:text-gray-100'>
        No challenges yet
      </p>
      <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
        New challenges land every week.
      </p>
    </div>
  );
}
