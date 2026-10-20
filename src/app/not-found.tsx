import Link from 'next/link';

/**
 * Branded 404 (SPE-137): consistent with the app's empty-state language,
 * with working paths out of the dead end.
 */
export default function NotFound() {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center'>
      <p
        aria-hidden='true'
        className='mb-2 font-mono text-5xl font-bold text-gray-300 dark:text-gray-700'
      >
        404
      </p>
      <h1 className='mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100'>
        This page does not exist
      </h1>
      <p className='mb-6 text-sm text-gray-600 dark:text-gray-400'>
        The page you are looking for was moved, removed, or never existed.
      </p>
      <div className='flex flex-wrap justify-center gap-3'>
        <Link
          href='/challenges'
          className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
        >
          Browse challenges
        </Link>
        <Link
          href='/'
          className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
