import { notFound } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { ShareButton } from './ShareButton';

export const dynamic = 'force-dynamic';

type TestOutput = Record<string, { passed?: number; failed?: number } | string>;

function parseTestOutput(testOutput: string | null): TestOutput | null {
  if (!testOutput) return null;
  try {
    const parsed = JSON.parse(testOutput);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as TestOutput;
    }
    return { raw: testOutput };
  } catch {
    return { raw: testOutput };
  }
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      user: { select: { id: true, name: true, image: true } },
      challenge: true,
      verification: true,
      verificationJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!run) {
    notFound();
  }

  const verification = run.verification;
  const job = run.verificationJobs[0];
  const testOutput = parseTestOutput(verification?.testOutput ?? null);

  const isVerified = run.status === 'verified';
  const isFailed = run.status === 'failed';
  const isVerifying = run.status === 'verifying' || run.status === 'submitted';

  // Rank: count of verified runs on same challenge with lower elapsedMs
  let rank: number | null = null;
  if (isVerified && run.elapsedMs !== null && run.challengeId) {
    const lower = await prisma.run.count({
      where: {
        challengeId: run.challengeId,
        status: 'verified',
        elapsedMs: { not: null, lt: run.elapsedMs },
      },
    });
    rank = lower + 1;
  }

  const attemptsRemaining =
    job && job.maxAttempts != null
      ? Math.max(0, job.maxAttempts - job.attempts)
      : null;

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
        <Link
          href='/challenges'
          className='inline-flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 mb-6'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
          </svg>
          <span>Back to challenges</span>
        </Link>

        {/* Loading state */}
        {isVerifying && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center'>
            <div className='inline-flex items-center gap-2 mb-4'>
              <span className='h-3 w-3 rounded-full bg-indigo-600 animate-pulse'></span>
              <span className='text-indigo-600 dark:text-indigo-400 font-medium text-sm'>Verification in progress…</span>
            </div>
            <p className='text-gray-600 dark:text-gray-400 text-sm'>
              Your run is being verified. This page will update once verification completes.
            </p>
          </div>
        )}

        {/* Failed / error state */}
        {isFailed && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
            <div className='mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-3 py-1 text-xs font-medium'>
              <span>✗</span> Failed
            </div>
            <h1 className='mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Verification failed
            </h1>
            {testOutput && !('raw' in testOutput) ? null : (
              <p className='mb-4 text-gray-600 dark:text-gray-400 text-sm'>
                {verification?.testOutput || 'No reason provided.'}
              </p>
            )}
            <div className='flex gap-3'>
              {run.challengeId && (
                <Link
                  href={`/challenges/${run.challenge.slug}`}
                  className='px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700'
                >
                  Retry challenge
                </Link>
              )}
              <Link
                href='/leaderboard'
                className='px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600'
              >
                View leaderboard
              </Link>
            </div>
          </div>
        )}

        {/* Verified / success state */}
        {isVerified && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
            <div className='mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-3 py-1 text-xs font-medium'>
              <span>✓</span> Verified
            </div>
            <h1 className='mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Great work — your solution is verified
            </h1>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6'>
              <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>Time</p>
                <p className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  {run.elapsedMs !== null ? `${(run.elapsedMs / 1000).toFixed(2)}s` : 'N/A'}
                </p>
              </div>
              <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>Rank</p>
                <p className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  {rank !== null ? `#${rank}` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Tests */}
            {testOutput && (
              <section className='mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-5'>
                <h2 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  Test results
                </h2>
                <div className='space-y-2'>
                  {Object.entries(testOutput).map(([key, value]) => {
                    if (key === 'raw') {
                      return (
                        <div key={key} className='text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all'>
                          {String(value)}
                        </div>
                      );
                    }
                    const cat = value as { passed?: number; failed?: number };
                    const passed = cat.passed ?? 0;
                    const failed = cat.failed ?? 0;
                    const total = passed + failed;
                    return (
                      <div key={key} className='flex items-center justify-between text-sm'>
                        <span className='text-gray-600 dark:text-gray-400 capitalize'>
                          {key.replace(/[A-Z]/g, (m) => ` ${m}`).trim()}
                        </span>
                        <span className={`flex items-center gap-1.5 font-medium ${
                          failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {failed > 0 ? '✗' : '✓'} {passed}/{total} passed
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className='flex gap-3'>
              {run.challengeId && (
                <Link
                  href={`/challenges/${run.challenge.slug}`}
                  className='px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700'
                >
                  Try another challenge
                </Link>
              )}
              {attemptsRemaining != null && attemptsRemaining > 0 && run.challengeId && (
                <Link
                  href={`/challenges/${run.challenge.slug}`}
                  className='px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600'
                >
                  Retry challenge
                </Link>
              )}
              <Link
                href='/leaderboard'
                className='px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600'
              >
                View leaderboard
              </Link>
              <ShareButton runId={run.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
