import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

import { SubmitRunForm } from './SubmitRunForm';

export const dynamic = 'force-dynamic';

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
                {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
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
        </div>

        <SubmitRunForm
          challengeId={challenge.id}
          userId={session?.user?.id ?? null}
        />
      </div>
    </div>
  );
}
