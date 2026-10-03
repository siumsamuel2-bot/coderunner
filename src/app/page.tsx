import Link from 'next/link';

import { serverTrpc } from '@/utils/trpc';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const challenges = await serverTrpc.challenges.list();

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      <div className='px-4 py-12 sm:px-6 lg:px-8'>
        <h1 className='mb-6 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner
        </h1>
        <p className='mb-8 text-center text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
          Build apps with AI and race against the clock on verified leaderboards
        </p>

        <div className='mb-12'>
          <h2 className='mb-4 text-2xl font-semibold text-center text-gray-900 dark:text-gray-100'>
            Available Challenges
          </h2>
          {challenges.length > 0 ? (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {challenges.map((challenge) => (
                <Link
                  key={challenge.id}
                  href={`/challenges/${challenge.slug}`}
                  className='bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300'
                >
                  <div className='px-6 py-4'>
                    <h3 className='mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
                      {challenge.title}
                    </h3>
                    <p className='mb-2 text-sm text-gray-600 dark:text-gray-400'>
                      {challenge.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
              No challenges available yet
            </p>
          )}
        </div>

        <div className='flex justify-center space-x-4'>
          <Link
            href='/leaderboard'
            className='flex h-12 w-full items-center justify-center gap-2 rounded-full border border-solid border-indigo-600 px-5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 md:w-[200px]'
          >
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
