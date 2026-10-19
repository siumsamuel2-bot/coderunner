
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { formatDuration } from '@/lib/format';

import { CopyResultButton } from '@/components/challenges/CopyResultButton';
import { ResultStatusWatcher } from '@/components/challenges/ResultStatusWatcher';
import { VerificationNotice } from '@/components/challenges/VerificationNotice';

type CheckResult = {
  id: string;
  name: string;
  severity: string;
  status: string;
  error: string | null;
  evidence: string[];
};

export const dynamic = 'force-dynamic';

const FAIL_FIRST_ORDER = ['fail', 'skip', 'pass'];

/**
 * Submission result page (SPE-134, from the SPE-127 spec §3). Labels match
 * stored semantics: Started (run.startedAt), Verification completed
 * (run.endedAt — when the verdict was recorded), Total time (server-computed
 * elapsedMs), Rank (among verified runs). Only real backend metrics render:
 * no score block (scoring v1 is not implemented), no evidence links
 * (harness evidence entries are file paths, not URLs).
 */
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

  const byFailFirst = (a: CheckResult, b: CheckResult) =>
    FAIL_FIRST_ORDER.indexOf(a.status) - FAIL_FIRST_ORDER.indexOf(b.status);
  const requiredSorted = [...requiredChecks].sort(byFailFirst);
  const bonusSorted = [...bonusChecks].sort(byFailFirst);

  let rank: number | null = null;
  let verifiedTotal = 0;
  if (run.status === 'verified' && run.elapsedMs !== null) {
    const [fasterCount, totalCount] = await Promise.all([
      prisma.run.count({
        where: {
          challengeId: challenge.id,
          status: 'verified',
          elapsedMs: { lt: run.elapsedMs },
        },
      }),
      prisma.run.count({
        where: { challengeId: challenge.id, status: 'verified' },
      }),
    ]);
    rank = fasterCount + 1;
    verifiedTotal = totalCount;
  }

  const isVerified = run.status === 'verified';
  const isFailed = run.status === 'failed';

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

  const startedAtLabel = new Date(run.startedAt).toLocaleString();
  const verificationCompletedLabel = run.endedAt
    ? new Date(run.endedAt).toLocaleString()
    : 'Pending';

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

        {/* Result header */}
        <div
          className={`rounded-xl shadow-sm p-6 mb-6 ${
            isVerified
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : isFailed
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className='flex items-center justify-between gap-4'>
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
                    ? 'Verified ✓'
                    : isFailed
                      ? 'Verification failed'
                      : 'Verification in progress'}
                </h2>
                {isVerified && run.elapsedMs !== null ? (
                  <p
                    title={`${run.elapsedMs} ms`}
                    className='text-sm text-gray-600 dark:text-gray-400'
                  >
                    {challenge.title} · completed in{' '}
                    <span className='font-semibold'>{formatDuration(run.elapsedMs)}</span>
                    {rank !== null && (
                      <>
                        {' '}· ranked #{rank}
                        {verifiedTotal > 0 ? ` of ${verifiedTotal}` : ''}
                      </>
                    )}
                  </p>
                ) : isFailed ? (
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    {requiredFailed.length} of {requiredChecks.length} required
                    checks failed.
                  </p>
                ) : (
                  <p className='text-sm text-gray-600 dark:text-gray-400'>
                    <ResultStatusWatcher runId={run.id} />
                  </p>
                )}
              </div>
            </div>
            {isVerified && run.elapsedMs !== null && (
              <span
                title={`${run.elapsedMs} ms`}
                className='text-2xl font-bold text-green-700 dark:text-green-400'
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatDuration(run.elapsedMs)}
              </span>
            )}
          </div>
        </div>

        {/* Details — labels match stored semantics (SPE-127 §3.2) */}
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
                Started
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {startedAtLabel}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Verification completed
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {verificationCompletedLabel}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Total time
              </p>
              <p
                title={run.elapsedMs !== null ? `${run.elapsedMs} ms` : undefined}
                className='text-gray-900 dark:text-gray-100'
              >
                {run.elapsedMs !== null ? formatDuration(run.elapsedMs) : 'Pending'}
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Rank
              </p>
              <p className='text-gray-900 dark:text-gray-100'>
                {rank !== null ? `#${rank}` : '—'}
                {rank !== null && verifiedTotal > 0
                  ? ` of ${verifiedTotal} verified`
                  : ''}
              </p>
              {rank === null && !isVerified && (
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  Rank shown once verification passes.
                </p>
              )}
            </div>
          </div>
          <p className='mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500'>
            Run {run.id.slice(0, 8)} · attempt #{run.attempt}
          </p>
        </div>

        {/* Score block intentionally absent: scoring v1 is not implemented.
            Evidence links intentionally absent: harness evidence entries are
            evidence-directory file paths, not URLs (SPE-127 §3.2). */}
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

            {requiredFailed.length > 0 && (
              <p className='mb-3 text-sm font-medium text-red-600 dark:text-red-400'>
                Failed checks ({requiredFailed.length})
              </p>
            )}

            <div className='space-y-3'>
              <div className='mb-2 px-3 py-1 text-xs font-semibold bg-gray-50 dark:bg-gray-700/50 rounded'>
                Required Checks
              </div>
              {requiredSorted.map((check) => (
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
                  {bonusSorted.map((check) => (
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

        {/* Verification transparency, expanded by default (SPE-139,
            SPE-127 §4.2 placement: results page below checks). */}
        <div className='mb-6'>
          <VerificationNotice defaultOpen />
        </div>

        {/* Closing actions (SPE-127 §3.2 table) */}
        <div className='grid gap-3 sm:grid-cols-3'>
          <Link
            href={`/leaderboard#${slug}`}
            className='flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          >
            View leaderboard
          </Link>
          <Link
            href='/challenges'
            className='flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          >
            Try another challenge
          </Link>
          {isFailed && (
            <Link
              href={`/challenges/${slug}`}
              className='flex items-center justify-center py-3 px-4 border border-indigo-300 rounded-lg shadow-sm text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
            >
              Start a new attempt
            </Link>
          )}
          {isVerified && run.elapsedMs !== null && rank !== null && (
            <CopyResultButton
              challengeTitle={challenge.title}
              elapsedMs={run.elapsedMs}
              rank={rank}
            />
          )}
        </div>
      </div>
    </div>
  );
}
