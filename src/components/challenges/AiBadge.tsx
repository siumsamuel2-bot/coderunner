/**
 * AI-allowed indicator (SPE-126 §1.2). Icon + text (not color-only);
 * screen-reader labels distinguish allowed vs not allowed.
 */
export function AiBadge({ aiAllowed }: { aiAllowed: boolean }) {
  if (aiAllowed) {
    return (
      <span
        aria-label='AI coding assistants allowed'
        title='AI coding assistants allowed'
        className='inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
      >
        <svg
          aria-hidden='true'
          className='h-3.5 w-3.5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
          />
        </svg>
        AI allowed
      </span>
    );
  }
  return (
    <span
      aria-label='AI coding assistants not allowed'
      title='AI coding assistants not allowed'
      className='inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    >
      <svg
        aria-hidden='true'
        className='h-3.5 w-3.5'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
          d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636'
        />
      </svg>
      No AI
    </span>
  );
}
