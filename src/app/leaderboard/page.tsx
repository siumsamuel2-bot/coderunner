import Link from 'next/link';

import { serverTrpc } from '@/utils/trpc';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const topRuns = await serverTrpc.runs.getLeaderboard();

  // Group verified runs by challenge for separate leaderboards
  const runsByChallenge: Record<string, typeof topRuns> = {};
  for (const run of topRuns) {
    const slug = run.challenge.slug;
    if (!runsByChallenge[slug]) runsByChallenge[slug] = [];
    runsByChallenge[slug].push(run);
  }

  const slugs = Object.keys(runsByChallenge);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Leaderboard
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-4xl mx-auto'>
          Fastest verified times for each challenge
        </p>

        <div className='mb-8'>
          <div className='flex flex-wrap -mb-px'>
            {slugs.map((slug) => (
              <Link
                key={slug}
                href={`/challenges/${slug}`}
                className='mr-2 mb-2 px-4 py-2 rounded-t-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              >
                {runsByChallenge[slug][0]?.challenge.title}
              </Link>
            ))}
          </div>
        </div>

        {slugs.length === 0 && (
          <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
            No verified runs yet. Be the first on the board.
          </p>
        )}

        {slugs.map((slug) => (
          <div key={slug} className='mb-12'>
            <h2 className='mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100'>
              {runsByChallenge[slug][0]?.challenge.title} Leaderboard
            </h2>

            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                <thead className='bg-gray-50 dark:bg-gray-800'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      Rank
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      User
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      Time
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
                  {runsByChallenge[slug].map((run, idx) => (
                    <tr
                      key={run.id}
                      className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700' : ''}
                    >
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                        {idx + 1}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                        <span className='flex items-center space-x-3'>
                          {run.user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={run.user.image}
                              alt={`${run.user.name ?? 'user'}'s avatar`}
                              className='h-8 w-8 rounded-full'
                            />
                          ) : (
                            <span className='h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                              {run.user.name?.[0]?.toUpperCase()}
                            </span>
                          )}
                          <span>{run.user.name || 'Anonymous'}</span>
                        </span>
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                        {run.elapsedMs !== null
                          ? `${(run.elapsedMs / 1000).toFixed(2)}s`
                          : 'N/A'}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                        {run.endedAt
                          ? new Date(run.endedAt).toLocaleDateString()
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
