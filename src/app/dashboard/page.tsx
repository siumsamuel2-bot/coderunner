import { redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { auth, signOut } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const userRuns = await prisma.run.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      challenge: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      verification: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalRuns = userRuns.length;
  const verifiedRuns = userRuns.filter((run) => run.status === 'verified').length;
  const verifiedTimes = userRuns
    .filter((run) => run.status === 'verified' && run.elapsedMs !== null)
    .map((run) => run.elapsedMs as number);
  const bestTime = verifiedTimes.length > 0 ? Math.min(...verifiedTimes) : null;

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            Dashboard
          </h1>
          <div className='flex items-center space-x-4'>
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={`${session.user.name ?? 'user'}'s avatar`}
                className='h-10 w-10 rounded-full'
              />
            ) : (
              <div className='h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                {session.user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className='space-y-2'>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {session.user.name}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {session.user.email}
              </p>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button
                type='submit'
                className='px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg'
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <div className='grid gap-6'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
              <h3 className='mb-2 text-sm font-medium text-gray-500 dark:text-gray-400'>
                Total Runs
              </h3>
              <p className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
                {totalRuns}
              </p>
            </div>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
              <h3 className='mb-2 text-sm font-medium text-gray-500 dark:text-gray-400'>
                Verified Runs
              </h3>
              <p className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
                {verifiedRuns}
              </p>
            </div>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
              <h3 className='mb-2 text-sm font-medium text-gray-500 dark:text-gray-400'>
                Best Time
              </h3>
              <p className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
                {bestTime === null ? 'N/A' : `${(bestTime / 1000).toFixed(2)}s`}
              </p>
            </div>
          </div>

          <div className='col-span-3'>
            <h2 className='mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100'>
              Recent Runs
            </h2>

            {userRuns.length > 0 ? (
              <div className='space-y-4'>
                {userRuns.map((run) => (
                  <div
                    key={run.id}
                    className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3'>
                        <div className='w-10 h-10 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center'>
                          {run.challenge.title.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className='mb-1 text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {run.challenge.title}
                          </p>
                          <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Submitted {new Date(run.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className='text-right space-x-3'>
                        {run.verification?.status === 'failed' ? (
                          <>
                            <p className='text-xs text-red-600 dark:text-red-400'>
                              Failed
                            </p>
                            <p className='mt-1 text-xs text-red-600 dark:text-red-400'>
                              Verification failed
                            </p>
                          </>
                        ) : run.status === 'verified' && run.elapsedMs !== null ? (
                          <>
                            <p className='text-sm font-semibold text-indigo-600'>
                              {(run.elapsedMs / 1000).toFixed(2)}s
                            </p>
                            <p className='text-xs text-green-600 dark:text-green-400'>
                              Verified
                            </p>
                          </>
                        ) : run.status === 'verifying' ? (
                          <p className='text-xs text-yellow-600 dark:text-yellow-400 animate-pulse'>
                            Verifying...
                          </p>
                        ) : run.status === 'submitted' ? (
                          <p className='text-xs text-blue-600 dark:text-blue-400'>
                            Waiting for verification
                          </p>
                        ) : (
                          <p className='text-xs text-red-600 dark:text-red-400'>
                            Failed
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
                You haven&apos;t submitted any runs yet.{' '}
                <Link href='/challenges' className='text-indigo-600 hover:text-indigo-500'>
                  Start a challenge
                </Link>{' '}
                to get started!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
