import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function RunResultsPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>;
}) {
  const { slug, runId } = await params;

  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const challenge = await prisma.challenge.findUnique({
    where: { slug },
  });

  if (!challenge) {
    notFound();
  }

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      challenge: true,
      verification: true,
    },
  });

  if (!run) {
    notFound();
  }

  if (run.userId !== user.id) {
    notFound();
  }

  const formatTime = (ms: number | null) =>
    ms === null ? 'N/A' : `${(ms / 1000).toFixed(2)}s`;
  const formatDate = (date: Date | null) =>
    date === null ? 'N/A' : new Date(date).toLocaleString();

  const toolLog = run.toolLog as
    | { solutionUrl?: string; submittedAt?: string }
    | null;

  const statusConfig: Record<string, { color: string; label: string }> = {
    in_progress: { color: 'text-blue-600 dark:text-blue-400', label: 'In progress' },
    submitted: { color: 'text-blue-600 dark:text-blue-400', label: 'Submitted, awaiting verification' },
    verifying: { color: 'text-yellow-600 dark:text-yellow-400 animate-pulse', label: 'Verifying…' },
    verified: { color: 'text-green-600 dark:text-green-400 font-medium', label: 'Verified' },
    failed: { color: 'text-red-600 dark:text-red-400 font-medium', label: 'Failed verification' },
  };

  const status = statusConfig[run.status] ?? {
    color: 'text-gray-600 dark:text-gray-400',
    label: run.status,
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <Link
            href={`/challenges/${slug}`}
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to {challenge.title}</span>
          </Link>
          <Link
            href='/dashboard'
            className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline'
          >
            Dashboard
          </Link>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Run Results
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className='text-gray-600 dark:text-gray-400 mb-6'>
            {challenge.title}
          </p>

          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Time
              </p>
              <p className='text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums'>
                {formatTime(run.elapsedMs)}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Attempts
              </p>
              <p className='text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums'>
                {run.attempts}
              </p>
            </div>
            <div className='bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Status
              </p>
              <p className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </p>
            </div>
          </div>

          {toolLog?.solutionUrl && (
            <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'>
                Solution URL
              </p>
              <a
                href={String(toolLog?.solutionUrl)}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline break-all'
              >
                {String(toolLog?.solutionUrl)}
              </a>
            </div>
          )}

          {run.verification && (
            <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
              <div className='flex items-center justify-between mb-2'>
                <h2 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  Verification
                </h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  run.verification.status === 'passed'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}>
                  {run.verification.status.charAt(0).toUpperCase() + run.verification.status.slice(1)}
                </span>
              </div>
              {run.verification.testOutput && (
                <p className='text-sm text-gray-700 dark:text-gray-300'>
                  {run.verification.testOutput}
                </p>
              )}
              <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                Verified {formatDate(run.verification.verifiedAt ?? null)}
              </p>
            </div>
          )}

          <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 grid gap-4 sm:grid-cols-3'>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Started at
              </p>
              <p className='text-sm text-gray-700 dark:text-gray-300'>
                {formatDate(run.startedAt ?? null)}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Ended at
              </p>
              <p className='text-sm text-gray-700 dark:text-gray-300'>
                {formatDate(run.endedAt ?? null)}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Submitted at
              </p>
              <p className='text-sm text-gray-700 dark:text-gray-300'>
                {toolLog?.submittedAt ? formatDate(new Date(toolLog.submittedAt)) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {run.status === 'in_progress' || run.status === 'submitted' || run.status === 'verifying' ? (
          <div className='bg-blue-50 dark:bg-blue-900/10 rounded-xl shadow-sm p-6 mb-8'>
            <h2 className='mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
              Challenge still running
            </h2>
            <p className='mb-4 text-gray-700 dark:text-gray-300'>
              Your run hasn&apos;t finished yet. Refresh this page to see updated results once
              verification completes.
            </p>
            <button
              onClick={() => window.location.reload()}
              className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium'
            >
              Refresh results
            </button>
          </div>
        ) : (
          <div className='flex items-center space-x-4 mb-8'>
            <Link
              href={`/challenges/${slug}`}
              className='flex items-center justify-center gap-2 rounded-full border border-solid border-indigo-600 px-5 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2'
            >
              Run again
            </Link>
            <Link
              href='/leaderboard'
              className='flex items-center justify-center gap-2 rounded-full border border-transparent px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            >
              View leaderboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
