import { notFound } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>;
}) {
  const { slug, runId } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { slug },
  });

  if (!challenge) {
    notFound();
  }

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      user: {
        select: { id: true, name: true, image: true, email: true },
      },
      challenge: true,
      verification: true,
    },
  });

  if (!run || run.challengeId !== challenge.id) {
    notFound();
  }

  const isVerified = run.status === 'verified';
  const isFailed = run.status === 'failed';
  const completionTime =
    run.elapsedMs !== null ? `${(run.elapsedMs / 1000).toFixed(2)}s` : null;

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8'>
        <Link
          href={`/challenges/${slug}`}
          className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 mb-6'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
          </svg>
          <span>Back to {challenge.title}</span>
        </Link>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6'>
          <div className='flex items-center justify-between mb-4'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Results
            </h1>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isVerified
                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : isFailed
                  ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
            </span>
          </div>

          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Challenge
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {challenge.title}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Runner
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {run.user.name || 'Anonymous'}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Completion time
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {completionTime ?? 'N/A'}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Attempt
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                #{run.attempts}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Submitted
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {run.endedAt ? new Date(run.endedAt).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Verified at
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {run.verification?.verifiedAt
                  ? new Date(run.verification.verifiedAt).toLocaleString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {run.verification && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100'>
              Verification Report
            </h2>
            <pre className='overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300'>
              {run.verification.testOutput || 'No verification output available.'}
            </pre>
            {process.env.R2_PUBLIC_URL && (
              <p className='mt-3 text-sm text-gray-500 dark:text-gray-400'>
                Evidence: {`${process.env.R2_PUBLIC_URL}/verification/${runId}/`}
              </p>
            )}
          </div>
        )}

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            Solution
          </h2>
          <p className='text-gray-600 dark:text-gray-400'>
            {(run.toolLog as { solutionUrl?: string })?.solutionUrl ?? 'No solution URL recorded.'}
          </p>
        </div>
      </div>
    </div>
  );
}
