'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  AI_FILTER_OPTIONS,
  applyFilters,
  countActiveFilters,
  distinctValues,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseFiltersFromParams,
  serializeFiltersToParams,
  sortChallenges,
  TIME_BUCKETS,
  type ChallengeListItem,
  type FilterState,
} from '@/lib/challenge-filters';
import { capitalizeLabel } from '@/lib/format';

import { ChallengeCard } from './ChallengeCard';
import { EmptyState } from './EmptyState';

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  python: 'Python',
};

const chipBase =
  'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
const chipSelected = 'bg-indigo-600 text-white dark:bg-indigo-500';
const chipUnselected =
  'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={`${chipBase} ${selected ? chipSelected : chipUnselected}`}
    >
      {label}
    </button>
  );
}

/**
 * Client-side challenge browser (SPE-131, SPE-126 filter spec §2): filter
 * bar + language sections + cards. Receives the full server-fetched list;
 * no API change. Active filters sync to URL query params.
 */
export function ChallengeBrowser({
  challenges,
}: {
  challenges: ChallengeListItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(new URLSearchParams(searchParams.toString()))
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateFilters = (next: FilterState) => {
    setFilters(next);
    const query = serializeFiltersToParams(next);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  };

  const toggleValue = (key: 'languages' | 'categories' | 'difficulties', value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilters({ ...filters, [key]: next });
  };

  const clearAll = () => updateFilters(EMPTY_FILTERS);

  const activeCount = countActiveFilters(filters);
  const anyActive = hasActiveFilters(filters);

  const languages = useMemo(
    () => distinctValues(challenges, 'language'),
    [challenges]
  );
  const categories = useMemo(
    () => distinctValues(challenges, 'category'),
    [challenges]
  );

  const visible = useMemo(
    () => sortChallenges(applyFilters(challenges, filters)),
    [challenges, filters]
  );

  const sections = useMemo(() => {
    const byLanguage = new Map<string, ChallengeListItem[]>();
    for (const challenge of visible) {
      const list = byLanguage.get(challenge.language) ?? [];
      list.push(challenge);
      byLanguage.set(challenge.language, list);
    }
    return [...byLanguage.entries()].sort(([a], [b]) =>
      (LANGUAGE_LABELS[a] ?? capitalizeLabel(a)).localeCompare(
        LANGUAGE_LABELS[b] ?? capitalizeLabel(b)
      )
    );
  }, [visible]);

  if (challenges.length === 0) {
    return <EmptyState variant='no-catalog' />;
  }

  const filterControls = (
    <div className='space-y-3'>
      <div>
        <label
          htmlFor='challenge-search'
          className='mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'
        >
          Search
        </label>
        <input
          id='challenge-search'
          type='search'
          value={filters.search}
          onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
          placeholder='Search name or description'
          aria-label='Search challenges by name or description'
          className='w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:placeholder-gray-500 sm:max-w-sm'
        />
      </div>
      <div>
        <p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          Language
        </p>
        <div className='flex flex-wrap gap-2'>
          {languages.map((language) => (
            <Chip
              key={language}
              label={LANGUAGE_LABELS[language] ?? capitalizeLabel(language)}
              selected={filters.languages.includes(language)}
              onClick={() => toggleValue('languages', language)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          Category
        </p>
        <div className='flex flex-wrap gap-2'>
          {categories.map((category) => (
            <Chip
              key={category}
              label={capitalizeLabel(category)}
              selected={filters.categories.includes(category)}
              onClick={() => toggleValue('categories', category)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          Difficulty
        </p>
        <div className='flex flex-wrap gap-2'>
          {['easy', 'medium', 'hard'].map((difficulty) => (
            <Chip
              key={difficulty}
              label={capitalizeLabel(difficulty)}
              selected={filters.difficulties.includes(difficulty)}
              onClick={() => toggleValue('difficulties', difficulty)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          AI
        </p>
        <div className='flex flex-wrap gap-2'>
          <Chip
            label='All'
            selected={filters.ai === null}
            onClick={() => updateFilters({ ...filters, ai: null })}
          />
          {AI_FILTER_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={filters.ai === option.value}
              onClick={() => updateFilters({ ...filters, ai: option.value })}
            />
          ))}
        </div>
      </div>
      <div>
        <p className='mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          Time
        </p>
        <select
          aria-label='Filter by estimated time'
          value={filters.time ?? ''}
          onChange={(e) =>
            updateFilters({
              ...filters,
              time: (e.target.value || null) as FilterState['time'],
            })
          }
          className='rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
        >
          <option value=''>Any</option>
          {TIME_BUCKETS.map((bucket) => (
            <option key={bucket.value} value={bucket.value}>
              {bucket.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <section aria-label='Challenge filters and results'>
      {/* Mobile: collapsed disclosure. Desktop: always-visible sticky bar. */}
      <div className='lg:sticky lg:top-4 lg:z-10 lg:bg-zinc-50 lg:dark:bg-black'>
        <div className='mb-4 border-b border-gray-200 pb-4 dark:border-gray-800'>
          <div className='flex items-center justify-between'>
            <button
              type='button'
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className='inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 lg:pointer-events-none lg:border-none lg:bg-transparent lg:px-0 lg:dark:bg-transparent'
            >
              <svg
                aria-hidden='true'
                className='h-4 w-4 lg:hidden'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M3 4h18M6 12h12m-6 8h6'
                />
              </svg>
              Filters
              {activeCount > 0 && (
                <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white'>
                  {activeCount}
                </span>
              )}
            </button>
            {anyActive && (
              <button
                type='button'
                onClick={clearAll}
                className='text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
              >
                Clear all
              </button>
            )}
          </div>
          <div className={`${filtersOpen ? 'block' : 'hidden'} pt-4 lg:block lg:pt-3`}>
            {filterControls}
          </div>
        </div>
      </div>

      <p aria-live='polite' className='mb-6 text-sm text-gray-600 dark:text-gray-400'>
        {anyActive || visible.length !== challenges.length
          ? `Showing ${visible.length} of ${challenges.length} challenges`
          : `${challenges.length} challenges`}
      </p>

      <div
        className={isPending ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}
      >
        {visible.length === 0 ? (
          <EmptyState variant='no-results' onClearFilters={clearAll} />
        ) : (
          sections.map(([language, list]) => (
            <section key={language} className='mb-12'>
              <h2 className='mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100'>
                {LANGUAGE_LABELS[language] ?? capitalizeLabel(language)} track
              </h2>
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {list.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
