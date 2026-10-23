'use client';

import { useMemo, useState } from 'react';

import { ChallengeCard } from './ChallengeCard';

type ChallengeWithStats = {
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

type FilterState = {
  language: string;
  difficulty: string;
  category: string;
  timeLimit: string;
};

export function ChallengesList({
  challenges,
}: {
  challenges: ChallengeWithStats[];
}) {
  const [filter, setFilter] = useState<FilterState>({
    language: 'All',
    difficulty: 'All',
    category: 'All',
    timeLimit: 'All',
  });

  const languages = useMemo(
    () => ['All', ...Array.from(new Set(challenges.map((c) => c.language)))],
    [challenges]
  );
  const difficulties = useMemo(
    () => ['All', ...Array.from(new Set(challenges.map((c) => c.difficulty)))],
    [challenges]
  );
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(challenges.map((c) => c.category)))],
    [challenges]
  );

  const timeOptions = ['All', '≤15 min', '≤30 min', '≤45 min'];

  const filtered = useMemo(() => {
    return challenges.filter((c) => {
      if (filter.language !== 'All' && c.language !== filter.language)
        return false;
      if (filter.difficulty !== 'All' && c.difficulty !== filter.difficulty)
        return false;
      if (filter.category !== 'All' && c.category !== filter.category)
        return false;
      if (filter.timeLimit !== 'All') {
        const limit = Number(filter.timeLimit.replace('≤', '').replace(' min', ''));
        if (c.estimatedMinutes > limit) return false;
      }
      return true;
    });
  }, [challenges, filter]);

  const filterBadge = (label: string, value: string, options: string[]) => (
    <div key={value} className='flex items-center gap-2'>
      <span className='text-xs font-medium text-gray-500 dark:text-gray-400'>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) =>
          setFilter((prev) => ({ ...prev, [label.toLowerCase()]: e.target.value }))
        }
        className='text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none'
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      {filtered.length === 0 && challenges.length > 0 ? (
        <div className='col-span-full text-center py-16'>
          <p className='text-gray-500 dark:text-gray-400 text-lg mb-4'>
            No challenges match your filters
          </p>
          <button
            onClick={() =>
              setFilter({
                language: 'All',
                difficulty: 'All',
                category: 'All',
                timeLimit: 'All',
              })
            }
            className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-solid border-indigo-600 px-5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {filtered.map((challenge) => (
            <ChallengeCard key={challenge.slug} {...challenge} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div className='mt-10 flex flex-wrap gap-3 items-center'>
          <span className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
            Filters
          </span>
          {filterBadge('Language', filter.language, languages)}
          {filterBadge('Difficulty', filter.difficulty, difficulties)}
          {filterBadge('Category', filter.category, categories)}
          {filterBadge('Time limit', filter.timeLimit, timeOptions)}
        </div>
      )}
    </div>
  );
}
