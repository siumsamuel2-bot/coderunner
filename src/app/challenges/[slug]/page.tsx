import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { capitalizeLabel } from '@/lib/format';
import type { CheckManifest } from '@/lib/check-manifest';

import { AiBadge } from '@/components/challenges/AiBadge';
import { CategoryChip } from '@/components/challenges/CategoryChip';
import { CheckManifestList } from '@/components/challenges/CheckManifestList';
import { DifficultyBadge } from '@/components/challenges/DifficultyBadge';
import { VerificationNotice } from '@/components/challenges/VerificationNotice';

import { SubmitRunForm } from './SubmitRunForm';

export const dynamic = 'force-dynamic';

/**
 * Challenge detail page (SPE-132). Header with real metadata + attempt
 * stats, "What you'll build", requirements checklist from the stored
 * acceptance criteria, evaluation section from the real check manifest
 * (dep D5) with the process-level notice as fallback, prominent Start
 * CTA anchoring to the run form. No invented content (SPE-114 §10).
 */
export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { slug },
  });

  if (!challenge) {
    notFound();
  }

  const session = await auth();

  const [attemptCount, myAttemptCount] = await Promise.all([
    prisma.run.count({ where: { challengeId: challenge.id } }),
    session?.user?.id
      ? prisma.run.count({
          where: { challengeId: challenge.id, userId: session.user.id },
        })
      : Promise.resolve(0),
  ]);

  // Requirements checklist: split the stored acceptance criteria into
  // sentence-level items. Static prose, real data, no pass/fail implied.
  const requirements = challenge.acceptanceCriteria
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const manifest =
    (challenge.testSpec as { checkManifest?: CheckManifest } | null)
      ?.checkManifest ?? null;

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='mx-auto max-w-4xl px-4 sm:px-6 lg:px-8'>
        <Link
          href='/challenges'
          className='mb-6 inline-flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
          </svg>
          <span>Back to challenges</span>
        </Link>

        {/* Challenge header */}
        <header className='mb-8'>
          <div className='mb-3 flex flex-wrap items-center gap-2'>
            <CategoryChip category={challenge.category} />
            <AiBadge aiAllowed={challenge.aiAllowed} />
          </div>
          <h1 className='mb-4 text-3xl font-bold text-gray-900 dark:text-gray-100'>
            {challenge.title}
          </h1>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400'>
            <DifficultyBadge difficulty={challenge.difficulty} />
            <span className='inline-flex items-center gap-1'>
              <svg aria-hidden='true' className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' />
              </svg>
              {capitalizeLabel(challenge.language)}
            </span>
            <span className='inline-flex items-center gap-1'>
              <svg aria-hidden='true' className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 8v4l3 3' />
              </svg>
              ~{challenge.estimatedMinutes} min estimate
            </span>
            {attemptCount > 0 && <span>{attemptCount} attempts so far</span>}
            {myAttemptCount > 0 && (
              <span>
                You: {myAttemptCount}{' '}
                {myAttemptCount === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>
          <a
            href='#start'
            className='mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black'
          >
            Start challenge
            <svg aria-hidden='true' className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 14l-7 7m0 0l-7-7m7 7V3' />
            </svg>
          </a>
        </header>

        {/* What you'll build */}
        <section className='mb-8 rounded-xl bg-white shadow-sm p-6 dark:bg-gray-800'>
          <h2 className='mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {"What you'll build"}
          </h2>
          <p className='text-gray-700 dark:text-gray-300'>
            {challenge.description}
          </p>
        </section>

        {/* Requirements */}
        <section className='mb-8 rounded-xl bg-white shadow-sm p-6 dark:bg-gray-800'>
          <h2 className='mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            Requirements
          </h2>
          <ul className='space-y-2'>
            {requirements.map((requirement, index) => (
              <li
                key={index}
                className='flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300'
              >
                <svg
                  aria-hidden='true'
                  className='mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
                  />
                </svg>
                {requirement}
              </li>
            ))}
          </ul>
        </section>

        {/* Evaluation */}
        <section className='mb-8 rounded-xl bg-white shadow-sm p-6 dark:bg-gray-800'>
          <h2 className='mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {"How you'll be verified"}
          </h2>
          {manifest && manifest.checks.length > 0 ? (
            <div className='mb-4'>
              <CheckManifestList manifest={manifest} />
            </div>
          ) : null}
          <VerificationNotice />
        </section>

        {/* Start challenge */}
        <section id='start' className='scroll-mt-6'>
          <div className='rounded-xl bg-white shadow-sm p-6 ring-2 ring-indigo-500/40 dark:bg-gray-800'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100'>
              Start challenge
            </h2>
            <p className='mb-5 text-sm text-gray-600 dark:text-gray-400'>
              Submit the URL where your solution is hosted. The clock starts
              server-side when your run begins and stops when you submit —
              your official time is computed from database timestamps, not
              your device.
            </p>
            <SubmitRunForm challengeId={challenge.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
