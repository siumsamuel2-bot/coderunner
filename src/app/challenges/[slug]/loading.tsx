export default function ChallengeDetailLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
          <div className='h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8 animate-pulse'>
          <div className='h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4' />
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded' />
            <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded' />
          </div>
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <div className='h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2' />
            <div className='h-16 w-full bg-gray-200 dark:bg-gray-700 rounded' />
          </div>
          <div className='mt-6'>
            <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3 uppercase tracking-wider text-[10px] text-gray-400' />
            <div className='flex items-center gap-2'>
              <div className='h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full' />
              <div className='w-px h-2 bg-gray-200 dark:bg-gray-700' />
              <div className='h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full' />
              <div className='w-px h-2 bg-gray-200 dark:bg-gray-700' />
              <div className='h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full' />
              <div className='w-px h-2 bg-gray-200 dark:bg-gray-700' />
              <div className='h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full' />
            </div>
          </div>
          <div className='mt-6 flex flex-col sm:flex-row gap-4'>
            <div className='h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded' />
            <div className='h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded' />
          </div>
        </div>

        <div id='submit-run' className='mt-8'>
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 animate-pulse'>
            <div className='h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-6' />
            <div className='h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-4' />
            <div className='h-10 w-full bg-gray-200 dark:bg-gray-700 rounded mb-4' />
            <div className='h-8 w-full bg-gray-200 dark:bg-gray-700 rounded' />
          </div>
        </div>
      </div>
    </div>
  );
}
