export default function ChallengesLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Challenges
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
          Build apps with AI and race against the clock on verified leaderboards
        </p>
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse'
            >
              <div className='flex items-center justify-between mb-3'>
                <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded' />
                <div className='h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded' />
              </div>
              <p className='mb-4 h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded' />
              <div className='flex flex-wrap gap-2 mb-5'>
                <div className='h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded' />
                <div className='h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded' />
                <div className='h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded' />
              </div>
              <div className='grid grid-cols-2 gap-3 mb-6'>
                <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3'>
                  <div className='h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2 uppercase tracking-wider text-[10px] text-gray-400' />
                  <div className='h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded' />
                </div>
                <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3'>
                  <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 uppercase tracking-wider text-[10px] text-gray-400' />
                  <div className='h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded' />
                </div>
              </div>
              <button className='w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'>
                <span className='h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded' />
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7l5 5m0 0l-5 5m5-5H6' />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
