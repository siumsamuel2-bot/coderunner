/**
 * Challenge list filtering (SPE-131, per the SPE-126 filter spec §2).
 *
 * Pure functions — no React, no Prisma — so the client filter component and
 * the unit tests share one source of truth. Filtering is client-side over
 * the server-fetched list (catalog is small; no new API).
 */

import { capitalizeLabel } from '@/lib/format';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type TimeBucket = 'le15' | 'le30' | 'le60' | 'gt60';
export type AiFilter = 'allowed' | 'none';

export interface ChallengeListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  language: string;
  category: string;
  aiAllowed: boolean;
  estimatedMinutes: number;
  attemptCount: number;
  fastestVerifiedMs: number | null;
}

export interface FilterState {
  languages: string[];
  categories: string[];
  difficulties: string[];
  ai: AiFilter | null;
  time: TimeBucket | null;
}

export const EMPTY_FILTERS: FilterState = {
  languages: [],
  categories: [],
  difficulties: [],
  ai: null,
  time: null,
};

/** Difficulty sort rank (SPE-126 §1.1 fixes the alphabetical-sort bug). */
export function difficultyRank(difficulty: string): number {
  switch (difficulty) {
    case 'easy':
      return 0;
    case 'medium':
      return 1;
    case 'hard':
      return 2;
    default:
      return 3;
  }
}

export const TIME_BUCKETS: { value: TimeBucket; label: string }[] = [
  { value: 'le15', label: 'Under 15 min' },
  { value: 'le30', label: 'Under 30 min' },
  { value: 'le60', label: 'Under 60 min' },
  { value: 'gt60', label: '60+ min' },
];

export function timeBucketLabel(bucket: TimeBucket): string {
  return TIME_BUCKETS.find((b) => b.value === bucket)?.label ?? 'Any';
}

function matchesTimeBucket(minutes: number, bucket: TimeBucket): boolean {
  switch (bucket) {
    case 'le15':
      return minutes <= 15;
    case 'le30':
      return minutes <= 30;
    case 'le60':
      return minutes <= 60;
    case 'gt60':
      return minutes > 60;
  }
}

/** True when no filter is active (controls render their default state). */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.languages.length > 0 ||
    filters.categories.length > 0 ||
    filters.difficulties.length > 0 ||
    filters.ai !== null ||
    filters.time !== null
  );
}

export function countActiveFilters(filters: FilterState): number {
  let count =
    filters.languages.length +
    filters.categories.length +
    filters.difficulties.length;
  if (filters.ai !== null) count += 1;
  if (filters.time !== null) count += 1;
  return count;
}

/**
 * Apply filters to the full list. Categories/difficulties/languages are
 * multi-select (OR within a group, AND across groups). Empty group = no
 * constraint.
 */
export function applyFilters(
  challenges: ChallengeListItem[],
  filters: FilterState
): ChallengeListItem[] {
  return challenges.filter((challenge) => {
    if (
      filters.languages.length > 0 &&
      !filters.languages.includes(challenge.language)
    ) {
      return false;
    }
    if (
      filters.categories.length > 0 &&
      !filters.categories.includes(challenge.category)
    ) {
      return false;
    }
    if (
      filters.difficulties.length > 0 &&
      !filters.difficulties.includes(challenge.difficulty)
    ) {
      return false;
    }
    if (filters.ai === 'allowed' && !challenge.aiAllowed) return false;
    if (filters.ai === 'none' && challenge.aiAllowed) return false;
    if (
      filters.time !== null &&
      !matchesTimeBucket(challenge.estimatedMinutes, filters.time)
    ) {
      return false;
    }
    return true;
  });
}

/** Difficulty rank then title (SPE-126 §1.3 acceptance #3). */
export function sortChallenges(
  challenges: ChallengeListItem[]
): ChallengeListItem[] {
  return [...challenges].sort((a, b) => {
    const rankDiff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
    if (rankDiff !== 0) return rankDiff;
    return a.title.localeCompare(b.title);
  });
}

/** Distinct values in display order for chip rows. */
export function distinctValues(
  challenges: ChallengeListItem[],
  key: 'language' | 'category'
): string[] {
  return [...new Set(challenges.map((c) => c[key]))].sort((a, b) =>
    capitalizeLabel(a).localeCompare(capitalizeLabel(b))
  );
}

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const VALID_TIME_BUCKETS = ['le15', 'le30', 'le60', 'gt60'];

/**
 * Hydrate filter state from URL search params (SPE-126 §2.2 #5).
 * Unknown values are dropped so crafted URLs can't inject nonsense.
 */
export function parseFiltersFromParams(
  params: URLSearchParams
): FilterState {
  const list = (name: string, valid?: string[]): string[] => {
    const raw = params.get(name);
    if (!raw) return [];
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return valid ? values.filter((v) => valid.includes(v)) : values;
  };

  const aiRaw = params.get('ai');
  const ai = aiRaw === 'allowed' || aiRaw === 'none' ? aiRaw : null;
  const timeRaw = params.get('time');
  const time =
    timeRaw && VALID_TIME_BUCKETS.includes(timeRaw)
      ? (timeRaw as TimeBucket)
      : null;

  return {
    languages: list('language'),
    categories: list('category'),
    difficulties: list('difficulty', VALID_DIFFICULTIES),
    ai,
    time,
  };
}

/** Serialize filter state to URL query params (shareable/back-button-safe). */
export function serializeFiltersToParams(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.languages.length > 0) {
    params.set('language', filters.languages.join(','));
  }
  if (filters.categories.length > 0) {
    params.set('category', filters.categories.join(','));
  }
  if (filters.difficulties.length > 0) {
    params.set('difficulty', filters.difficulties.join(','));
  }
  if (filters.ai) params.set('ai', filters.ai);
  if (filters.time) params.set('time', filters.time);
  return params.toString();
}

export const AI_FILTER_OPTIONS: { value: AiFilter; label: string }[] = [
  { value: 'allowed', label: 'AI allowed' },
  { value: 'none', label: 'No AI' },
];
