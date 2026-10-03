import Link from 'next/link';
import { trpc } from '@/utils/trpc';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  // Get top runs across all challenges (fastest verified times) via tRPC
  const { data: topRuns } = await trpc.runs.getLeaderboard.query();

  // Group runs by challenge for separate leaderboards
  const runsByChallenge: Record<string, any[]> = {};
  topRuns.forEach((run) => {
    const challengeSlug = run.challenge.slug;
    if (!runsByChallenge[challengeSlug]) {
      runsByChallenge[challengeSlug] = [];
    }
    runsByChallenge[challengeSlug].push(run);
  });

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Leaderboard
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-4xl mx-auto'>
          Fastest verified times for each challenge
        </p>
        
        {/* Tabs for different challenges */}
        <div className='mb-8'>
          <div className='flex flex-wrap -mb-px'>
            {[...new Set(topRuns.map(r => r.challenge.title))].map((challengeTitle, index) => (
              <Link
                key={index}
                href='#'
                className={mr-2 mb-2 px-4 py-2 rounded-t-lg text-sm font-medium 
                  
                }
              >
                {challengeTitle}
              </Link>
            ))}
          </div>
        </div>

        {/* Leaderboard for selected challenge (default to first challenge) */}
        {Object.keys(runsByChallenge).map((challengeSlug, index) => (
          <div
            key={challengeSlug}
            className={mb-12 }
          >
            <h2 className='mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100'>
              {runsByChallenge[challengeSlug][0]?.challenge.title} Leaderboard
            </h2>
            
            {runsByChallenge[challengeSlug].length > 0 ? (
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
                    {runsByChallenge[challengeSlug].map((run, idx) => (
                      <tr key={run.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                          {idx + 1}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap flex items-center space-x-3 text-sm font-medium text-gray-900 dark:text-gray-100'>
                          {run.user.image ? (
                            <img
                              src={run.user.image}
                              alt={${run.user.name}'s avatar}
                              className='h-8 w-8 rounded-full'
                            />
                          ) : (
                            <div className='h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                              {run.user.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span>{run.user.name || 'Anonymous'}</span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
                          {(run.elapsedMs / 1000).toFixed(2)}s
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                          {new Date(run.endedAt!).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
                No verified runs yet for this challenge
              </p>
            )}
          </div>
        ))}  
      </div>
    </div>
  );
}

