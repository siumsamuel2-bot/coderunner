import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

import { SubmitRunForm } from './SubmitRunForm';
import { ChallengeTimer } from './ChallengeTimer';

export const dynamic = 'force-dynamic';

type JourneyStep = 'Entry' | 'Submit' | 'Verify' | 'Rank';

type TestSpecCheck = {
  id: string;
  type: string;
  [key: string]: unknown;
};

type TestSpec = {
  checks?: TestSpecCheck[];
};

function difficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
    case 'hard':
      return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function parseRequirements(acceptanceCriteria: string): string[] {
  return acceptanceCriteria
    .split(/(?:\.|,|;)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

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

  const testSpec: TestSpec | null = (challenge as unknown as { testSpec?: TestSpec }).testSpec ?? null;
  const requirements = parseRequirements(challenge.acceptanceCriteria);

  const steps: JourneyStep[] = ['Entry', 'Submit', 'Verify', 'Rank'];

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10'>
          <Link
            href='/challenges'
            className='inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to challenges</span>
          </Link>
          <div className='flex items-center gap-3 flex-wrap'>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${difficultyColor(challenge.difficulty)}`}
            >
              {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
            </span>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
              {challenge.category}
            </span>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
              {challenge.language}
            </span>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
              {challenge.estimatedMinutes} min
            </span>
          </div>
        </div>

        <h1 className='mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight'>
          {challenge.title}
        </h1>

        {/* What you\'ll build */}
        <section className='mb-10'>
          <h2 className='mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100'>
            What you&#39;ll build
          </h2>
          <p className='text-lg text-gray-600 dark:text-gray-400 leading-relaxed'>
            {challenge.description}
          </p>
        </section>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {/* Challenge info card */}
          <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
              <div>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1'>
                  Difficulty
                </p>
                <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                  {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1'>
                  Category
                </p>
                <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                  {challenge.category}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1'>
                  Language
                </p>
                <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                  {challenge.language}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1'>
                  Time Limit
                </p>
                <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                  {challenge.estimatedMinutes} minutes
                </p>
              </div>
            </div>
          </div>

          {/* Requirements checklist */}
          <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider'>
                Requirements
              </h2>
              <span className='text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded'>
                {requirements.length} criteria
              </span>
            </div>
            <ul className='space-y-3'>
              {requirements.map((req, i) => (
                <li key={i} className='flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed'>
                  <span className='mt-0.5 shrink-0 text-gray-400 dark:text-gray-500'>
                    ❐
                  </span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Examples */}
          {testSpec?.checks?.length && (
            <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
              <h2 className='mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider'>
                Examples
              </h2>
              <p className='mb-3 text-sm text-gray-600 dark:text-gray-400'>
                Automated test cases your solution will be checked against:
              </p>
              <ul className='space-y-2 text-sm'>
                {testSpec.checks.map((check) => (
                  <li key={check.id} className='flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700/50'>
                    <span className='mt-0.5 shrink-0 text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded'>
                      {check.id}
                    </span>
                    <span className='text-gray-700 dark:text-gray-300 leading-relaxed'>
                      {check.type.charAt(0).toUpperCase() + check.type.slice(1)} test
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluation */}
          <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
            <h2 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider'>
              Evaluation
            </h2>
            <p className='text-sm text-gray-700 dark:text-gray-300 leading-relaxed'>
              Your submission is verified automatically against the test cases above.
              A run is marked <strong className='text-gray-900 dark:text-gray-100'>verified</strong> only when all checks pass.
              Verified runs are ranked by completion time on the challenge leaderboard.
            </p>
          </div>

          {/* Journey indicator */}
          <div className='p-6 border-t border-gray-200 dark:border-gray-700'>
            <div className='flex items-center gap-4 mb-4'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0'>
                Journey
              </p>
              <div className='flex-1 flex items-center gap-2'>
                {steps.map((step, i) => {
                  const completed = journeyCompleted.includes(step);
                  const active = journeyActive === step;
                  return (
                    <div key={step} className='flex items-center gap-2'>
                      {i > 0 && (
                        <div className='w-px h-2 bg-gray-200 dark:bg-gray-700 shrink-0' />
                      )}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
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

            {/* Timer / attempts / persist note */}
            {run && inProgress && deadline && (
              <div className='mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <ChallengeTimer deadline={deadline} />
                {attemptsRemaining != null && (
                  <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                    Attempt{' '}
                    {job ? job.attempts : 0} of {job ? job.maxAttempts : 0}{' '}
                    ({attemptsRemaining} remaining)
                  </span>
                )}
              </div>
            )}
            {run && inProgress && deadline && (
              <p className='mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed'>
                Your run is saved server-side — leave this page and come back
                later; progress persists.
              </p>
            )}
          </div>

          {/* Error state */}
          {run?.status === 'failed' && run.verification && (
            <div className='p-6 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'>
              <p className='text-sm font-medium text-red-600 dark:text-red-400 mb-1'>
                Verification failed
              </p>
              <p className='text-sm text-gray-700 dark:text-gray-300 mb-3'>
                {run.verification.testOutput || 'No reason provided.'}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                Edit your solution and resubmit using the form below.
              </p>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!run && (
          <div className='mt-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-10 text-center'>
            <svg className='mx-auto mb-6 h-12 w-12 text-gray-400 dark:text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
            </svg>
            <h2 className='mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100'>
              You haven&apos;t started this challenge yet.
            </h2>
            <p className='mb-8 text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-sm mx-auto'>
              Start your solution to begin the timer. Your run is saved
              server-side, so you can leave and come back later.
            </p>
            <Link
              href='#submit-run'
              className='inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 px-6 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors'
            >
              Start Challenge
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7l5 5m0 0l-5 5m5-5H6' />
              </svg>
            </Link>
          </div>
        )}

        {/* Submission form */}
        <div id='submit-run' className='mt-10'>
          <SubmitRunForm
            challengeId={challenge.id}
            userId={userId}
          />
        </div>
      </div>
    </div>
  );
}
