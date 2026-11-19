import type { CheckManifest } from '@/lib/check-manifest';

/**
 * Per-challenge check list (SPE-132, dep D5). Renders the exact check ids
 * the verification harness runs (parsed from verification/specs/<slug>.md),
 * grouped required first, then bonus. These are the same ids the results
 * page shows for the run (SPE-127 §4.3).
 */
export function CheckManifestList({ manifest }: { manifest: CheckManifest }) {
  const required = manifest.checks.filter((c) => c.severity === 'required');
  const bonus = manifest.checks.filter((c) => c.severity === 'bonus');

  const renderGroup = (
    title: string,
    checks: typeof manifest.checks,
    hint: string | null
  ) => {
    if (checks.length === 0) return null;
    return (
      <div>
        <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
          {title}
          {hint && (
            <span className='ml-2 text-xs font-normal text-gray-500 dark:text-gray-400'>
              {hint}
            </span>
          )}
        </p>
        <ul className='mt-2 space-y-1.5'>
          {checks.map((check) => (
            <li
              key={check.id}
              className='flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400'
            >
              <svg
                aria-hidden='true'
                className='mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500 dark:text-indigo-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <span>
                <span className='font-mono text-xs text-gray-500 dark:text-gray-500'>
                  {check.id}
                </span>{' '}
                — {check.passesWhen}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className='space-y-4'>
      {renderGroup(
        `Required checks (${required.length})`,
        required,
        'all must pass for a result to be verified'
      )}
      {renderGroup(
        `Bonus checks (${bonus.length})`,
        bonus,
        'reported but do not affect the verdict'
      )}
    </div>
  );
}
