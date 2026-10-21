import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

import { SubmitRunForm } from './SubmitRunForm';
import { ChallengeTimer } from './ChallengeTimer';

export const dynamic = 'force-dynamic';

type JourneyStep = 'Entry' | 'Submit' | 'Verify' | 'Rank';

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
  const userId = session?.user?.id ?? null;

  let run: {
    id: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    elapsedMs: number | null;
    verification: { id: string; status: string; testOutput: string | null; verifiedAt: Date | null } | null;
    verificationJobs: { id: string; attempts: number; maxAttempts: number }[];
  } | null = null;

  if (userId) {
    run = await prisma.run.findFirst({
      where: { userId, challengeId: challenge.id },
      orderBy: { createdAt: 'desc' },
      include: {
        verification: true,
        verificationJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  const job = run?.verificationJobs[0];
  const attemptsRemaining =
    job && job.maxAttempts != null
      ? Math.max(0, job.maxAttempts - job.attempts)
      : null;

  let journeyActive: JourneyStep = 'Entry';
  let journeyCompleted: JourneyStep[] = [];
  if (run) {
    if (run.status === 'verified') {
      journeyActive = 'Rank';
      journeyCompleted = ['Entry', 'Submit', 'Verify'];
    } else if (run.status === 'verifying') {
      journeyActive = 'Verify';
      journeyCompleted = ['Entry', 'Submit'];
    } else if (run.status === 'submitted') {
      journeyActive = 'Submit';
      journeyCompleted = ['Entry'];
    } else if (run.status === 'failed') {
      journeyActive = 'Verify';
      journeyCompleted = ['Entry', 'Submit'];
    } else {
      journeyActive = 'Entry';
    }
  }

  let deadline: string | null = null;
  const inProgress =
    !!run &&
    !!run.startedAt &&
    (run.status === 'submitted' || run.status === 'verifying') &&
    !run.endedAt;

  if (inProgress && run && run.startedAt && challenge.estimatedMinutes != null) {
    deadline = new Date(
      run.startedAt.getTime() + challenge.estimatedMinutes * 60 * 1000,
    ).toISOString();
  }

  const steps: JourneyStep[] = ['Entry', 'Submit', 'Verify', 'Rank'];

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <Link
            href='/challenges'
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to challenges</span>
          </Link>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            {challenge.title}
          </h1>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>
            {challenge.description}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Difficulty
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {challenge.difficulty
                  ?.charAt(0)
                  .toUpperCase() + challenge.difficulty.slice(1)}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Estimated Time
              </p>
              <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                {challenge.estimatedMinutes} minutes
              </p>
            </div>
          </div>
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'>
              Acceptance Criteria
            </p>
            <p className='text-gray-700 dark:text-gray-300'>
              {challenge.acceptanceCriteria}
            </p>
          </div>

          {/* Journey indicator */}
          <div className='mt-6'>
            <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-3 tracking-wider'>
              Journey
            </p>
            <div className='flex items-center gap-2'>
              {steps.map((step, i) => {
                const completed = journeyCompleted.includes(step);
                const active = journeyActive === step;
                return (
                  <div
                    key={step}
                    className='flex items-center gap-2'
                  >
                    {i > 0 && (
                      <span className='w-px h-2 bg-gray-200 dark:bg-gray-700 flex-shrink-0' />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                        completed
                          ? 'bg-green-600 text-white'
                          : active
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/20'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {completed ? '✓' : String(i + 1)}
                    </div>
                    <span className={`text-xs font-medium ${
                      completed
                        ? 'text-green-600 dark:text-green-400'
                        : active
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timer / attempts / server-persist note */}
          {run && inProgress && (
            <div className='mt-6 flex flex-col sm:flex-row sm:items-center gap-4'>
              <ChallengeTimer deadline={deadline} />
              {attemptsRemaining != null && (
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Attempt{' '}
                  {job ? job.attempts : 0} of {job ? job.maxAttempts : 0}{' '}
                  ({attemptsRemaining} remaining)
                </span>
              )}
            </div>
          )}

          {run && inProgress && (
            <p className='mt-3 text-sm text-gray-500 dark:text-gray-400'>
              Your run is saved server-side — you can leave this page and come
              back later; progress persists.
            </p>
          )}

          {/* Error state */}
          {run?.status === 'failed' && run.verification && (
            <div className='mt-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md'>
              <p className='text-sm font-medium'>Verification failed</p>
              <p className='mt-1 text-sm'>{run.verification.testOutput || 'No reason provided.'}</p>
              <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                Edit your solution and resubmit using the form below.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!run && (
            <div className='mt-8 text-center py-12'>
              <p className='text-gray-600 dark:text-gray-400 text-lg mb-4'>
                You have not started this challenge yet.
              </p>
              <Link
                href='#submit-run'
                className='px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700'
              >
                Start your solution
              </Link>
              <p className='mt-4 text-xs text-gray-500 dark:text-gray-400'>
                Your run is saved server-side, so you can leave and come back
                later.
              </p>
            </div>
          )}
        </div>

        <div id='submit-run' className='mt-8'>
          <SubmitRunForm
            challengeId={challenge.id}
            userId={userId}
          />
        </div>
      </div>
    </div>
  );
}
