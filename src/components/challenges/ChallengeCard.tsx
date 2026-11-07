import Link from 'next/link';

import { formatDuration } from '@/lib/format';
import type { ChallengeListItem } from '@/lib/challenge-filters';

import { AiBadge } from './AiBadge';
import { CategoryChip } from './CategoryChip';
import { DifficultyBadge } from './DifficultyBadge';

/**
 * Challenge card (SPE-126 §1.2 + SPE-131 real-data metrics).
 *
 * The whole card is one Link (no nested interactive elements — the CTA is a
 * visual affordance only). All displayed stats are real backend data:
 * attemptCount is the number of runs started for the challenge and
 * fastestVerifiedMs is the fastest verified completion time (null when no
 * verified run exists yet — the metric is omitted, never faked).
 */
export function ChallengeCard({ challenge }: { challenge: ChallengeListItem }) {
  return (
    <Link
      href={`/challenges/${challenge.slug}`}
      className='group block rounded-xl outline-none ring-indigo-500 transition-shadow focus-visible:ring-2'
    >
      <div className='flex h-full flex-col rounded-xl bg-white shadow-sm transition-all group-hover:-translate-y-1 group-hover:shadow-md dark:bg-gray-800'>
        <div className='flex flex-1 flex-col p-5'>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <CategoryChip category={challenge.category} />
            <AiBadge aiAllowed={challenge.aiAllowed} />
          </div>

          <h3 className='mb-1.5 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {challenge.title}
          </h3>
          <p className='mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400'>
            {challenge.description}
          </p>

          <div className='mb-3 flex flex-wrap items-center gap-2 text-sm'>
            <DifficultyBadge difficulty={challenge.difficulty} />
            <span className='inline-flex items-center gap-1 text-gray-600 dark:text-gray-400'>
              <svg
                aria-hidden='true'
                className='h-4 w-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 8v4l3 3'
                />
              </svg>
              ~{challenge.estimatedMinutes} min
            </span>
          </div>

          <div className='mb-4 text-xs text-gray-500 dark:text-gray-500'>
            {challenge.attemptCount > 0 ? (
              <>
                {challenge.attemptCount}{' '}
                {challenge.attemptCount === 1 ? 'attempt' : 'attempts'}
                {challenge.fastestVerifiedMs !== null && (
                  <>
                    {' '}
                    · fastest verified{' '}
                    <span className='font-medium text-gray-700 dark:text-gray-300'>
                      {formatDuration(challenge.fastestVerifiedMs)}
                    </span>
                  </>
                )}
              </>
            ) : (
              'No attempts yet'
            )}
          </div>

          <div className='mt-auto flex justify-end'>
            <span className='inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400'>
              Start challenge
              <svg
                aria-hidden='true'
                className='h-4 w-4 transition-transform group-hover:translate-x-0.5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M14 5l7 7m0 0l-7 7m7-7H3'
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
