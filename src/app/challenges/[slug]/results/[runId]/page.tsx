
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

type CheckResult = {
  id: string;
  name: string;
  severity: string;
  status: string;
  error: string | null;
  evidence: string[];
};

export const dynamic = 'force-dynamic';

export default async function RunResultsPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>;
}) {
  const { slug, runId } = await params;

  const session = await auth();

  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });

  if (!challenge) {
    notFound();
  }

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      verification: {
        select: {
          id: true,
          status: true,
          testOutput: true,
          reportData: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!run || run.challengeId !== challenge.id) {
    notFound();
  }

  if (session?.user?.id !== run.userId) {
    redirect('/dashboard');
  }

  const reportDataRaw = run.verification?.reportData ?? null;

  const reportData: CheckResult[] | null =
    reportDataRaw && Array.isArray(reportDataRaw)
      ? (reportDataRaw as CheckResult[])
      : null;

  const checks = reportData ?? [];
  const requiredChecks = checks.filter((c) => c.severity === 'required');
  const bonusChecks = checks.filter((c) => c.severity === 'bonus');
  const requiredPassed = requiredChecks.filter((c) => c.status === 'pass');
  const requiredFailed = requiredChecks.filter((c) => c.status === 'fail');

  let rank: number | null = null;
  if (run.status === 'verified' && run.elapsedMs !== null) {
    const fasterCount = await prisma.run.count({
      where: {
        challengeId: challenge.id,
        status: 'verified',
        elapsedMs: { lt: run.elapsedMs },
      },
    });
    rank = fasterCount + 1;
  }

  const isVerified = run.status === 'verified';
  const isFailed = run.status === 'failed';
  const isVerifying = run.status === 'verifying' || run.status === 'submitted';

  const badgeClass = (passed: boolean) =>
    passed
      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
      : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';

  const statusIconClass = (status: string) =>
    status === 'pass'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      : status === 'fail'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400';

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8'>
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
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            Submission Results
          </h1>
        </div>

        <div
          className={`rounded-xl shadow-sm p-6 mb-6 ${
            isVerified
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : isFailed
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className='flex items-center space-x-3'>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isVerified
                ? 'bg-green-600 text-white'
                : isFailed
                  ? 'bg-red-600 text-white'
                  : 'bg-blue-600 text-white animate-pulse'
            }`}>
              {isVerified ? '✓' : isFailed ? '✕' : '⟳'}
            </div>
            <div>
              <h2 className={`
                text-lg font-semibold
                ${isVerified ? 'text-green-800 dark:text-green-400' :
                isFailed ? 'text-red-800 dark:text-red-400' :
                'text-blue-800 dark:text-blue-400'}
              `}>
                {isVerified
                  ? 'Verified!'
                  : isFailed
                    ? 'Verification Failed'
                    : isVerifying
                      ? 'Verification in Progress'
                      : 'Submitted'}
              </h2>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                {isVerified
                  ? `Completed in ${(run.elapsedMs ?? 0) / 1000}s`
                  : isFailed
                    ? 'Your submission did not pass all required checks.'
                    : 'Waiting for verification to complete...'}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6'>
          <h3 className='mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
            Submission Details
          </h3>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Challenge
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {challenge.title}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Submitted
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {new Date(run.startedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Completion Time
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {run.elapsedMs !== null
                  ? `${(run.elapsedMs / 1000).toFixed(2)}s`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Rank
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {rank !== null ? `#${rank}` : '—'}
                {rank !== null && run.elapsedMs !== null ? ' (among verified runs)' : ''}
              </p>
              {rank === null && run.status !== 'verified' && (
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  Rank shown once verification passes.
                </p>
              )}
            </div>
          </div>
        </div>

        {reportData && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6'>
            <h3 className='mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Verification Checks
            </h3>

            <div className='mb-4 flex items-center justify-between'>
              <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                {requiredPassed.length}/{requiredChecks.length} required checks passed
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${badgeClass(requiredFailed.length === 0)}`}
              >
                {requiredFailed.length === 0 ? 'All required passed' : `${requiredFailed.length} failed`}
              </span>
            </div>

            <div className='space-y-3'>
              <div className='mb-2 px-3 py-1 text-xs font-semibold bg-gray-50 dark:bg-gray-700/50 rounded'>
                Required Checks
              </div>
              {requiredChecks.map((check) => (
                <div
                  key={check.id}
                  className='flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700'
                >
                  <div className='flex items-center space-x-3'>
                    <span className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-medium ${statusIconClass(check.status)}`}>
                      {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✕' : '–'}
                    </span>
                    <div>
                      <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                        {check.name}
                      </p>
                      {check.error && (
                        <p className='text-xs text-red-600 dark:text-red-400 mt-0.5'>
                          {check.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {bonusChecks.length > 0 && (
                <>
                  <div className='mt-4 mb-2 px-3 py-1 text-xs font-semibold bg-gray-50 dark:bg-gray-700/50 rounded'>
                    Bonus Checks
                  </div>
                  {bonusChecks.map((check) => (
                    <div
                      key={check.id}
                      className='flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700'
                    >
                      <div className='flex items-center space-x-3'>
                        <span className={`w-5 h-5 rounded-sm flex items-center justify-center text-xs font-medium ${statusIconClass(check.status)}`}>
                          {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✕' : '–'}
                        </span>
                        <div>
                          <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {check.name}
                          </p>
                          {check.error && (
                            <p className='text-xs text-red-600 dark:text-red-400 mt-0.5'>
                              {check.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {run.verification?.testOutput && !reportData && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6'>
            <h3 className='mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Verification Output
            </h3>
            <p className='text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-900/50 p-4 rounded'>
              {run.verification.testOutput}
            </p>
          </div>
        )}

        <div className='grid gap-3 sm:grid-cols-3'>
          {isVerified && (
            <Link
              href='/leaderboard'
              className='flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700'
            >
              View Leaderboard
            </Link>
          )}
          <Link
            href={`/challenges/${slug}`}
            className='flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700'
          >
            Try Another Challenge
          </Link>
          {isFailed && (
            <button
              className='flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
