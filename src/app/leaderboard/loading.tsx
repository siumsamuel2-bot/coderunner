export default function LeaderboardLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Leaderboard
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-4xl mx-auto'>
          Fastest verified times for each challenge
        </p>
        <div className='space-y-10'>
          {[1, 2, 3].map((challengeIdx) => (
            <div key={challengeIdx} className='mb-12'>
              <h2 className='mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100'>
                <span className='h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded'></span>
              </h2>
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                  <thead className='bg-gray-50 dark:bg-gray-800'>
                    <tr>
                      {['Rank', 'User', 'Time', 'Submitted', 'Verification', 'Evidence'].map(
                        (label) => (
                          <th
                            key={label}
                            className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                          >
                            <span className='h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded'></span>
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
                    {[1, 2, 3, 4, 5].map((rowIdx) => (
                      <tr
                        key={rowIdx}
                        className='bg-gray-50 dark:bg-gray-700'
                      >
                        <td className='px-6 py-4'>
                          <span className='h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded'></span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded'></span>
                          <span className='h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-2 block'></span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded'></span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded'></span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded'></span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded'></span>
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
    </div>
  );
}
