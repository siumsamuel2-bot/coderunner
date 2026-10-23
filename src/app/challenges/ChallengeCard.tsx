'use client';

import Link from 'next/link';

type ChallengeCardProps = {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  category: string;
  language: string;
  attemptCount: number;
  fastestTimeMs: number | null;
};

function formatTime(elapsedMs: number | null) {
  if (elapsedMs === null) return '—';
  return `${(elapsedMs / 1000).toFixed(2)}s`;
}

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

export function ChallengeCard({
  slug,
  title,
  description,
  difficulty,
  estimatedMinutes,
  category,
  language,
  attemptCount,
  fastestTimeMs,
}: ChallengeCardProps) {
  return (
    <Link
      href={`/challenges/${slug}`}
      className='group block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all'
    >
      <div className='p-6'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'>
            {title}
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${difficultyColor(difficulty)}`}
          >
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </span>
        </div>
        <p className='mb-4 text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed'>
          {description}
        </p>
        <div className='flex flex-wrap gap-2 mb-5'>
          <span
            className='px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          >
            {category}
          </span>
          <span
            className='px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          >
            {language}
          </span>
          <span
            className='px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          >
            {estimatedMinutes} min
          </span>
        </div>
        <div className='grid grid-cols-2 gap-3 mb-6'>
          <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3'>
            <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1'>
              Attempts
            </p>
            <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              {attemptCount}
            </p>
          </div>
          <div className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3'>
            <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1'>
              Fastest verified
            </p>
            <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              {formatTime(fastestTimeMs)}
            </p>
          </div>
        </div>
        <button
          className='w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 px-5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors'
        >
          Start Challenge
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7l5 5m0 0l-5 5m5-5H6' />
          </svg>
        </button>
      </div>
    </Link>
  );
}
