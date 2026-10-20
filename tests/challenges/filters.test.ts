import { describe, expect, it } from 'vitest';

import {
  applyFilters,
  countActiveFilters,
  difficultyRank,
  distinctValues,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseFiltersFromParams,
  serializeFiltersToParams,
  sortChallenges,
  type ChallengeListItem,
} from '@/lib/challenge-filters';

function item(overrides: Partial<ChallengeListItem>): ChallengeListItem {
  return {
    id: 'id',
    slug: 'slug',
    title: 'Title',
    description: 'Description',
    difficulty: 'easy',
    language: 'typescript',
    category: 'general',
    aiAllowed: true,
    estimatedMinutes: 15,
    attemptCount: 0,
    fastestVerifiedMs: null,
    ...overrides,
  };
}

const catalog: ChallengeListItem[] = [
  item({ id: '1', title: 'Calculator', difficulty: 'easy', language: 'typescript', category: 'algorithms', estimatedMinutes: 15, attemptCount: 12, fastestVerifiedMs: 151_000 }),
  item({ id: '2', title: 'Todo auth', difficulty: 'medium', language: 'typescript', category: 'full-stack', estimatedMinutes: 30, aiAllowed: false, attemptCount: 3 }),
  item({ id: '3', title: 'Chatbot', difficulty: 'easy', language: 'typescript', category: 'ai', estimatedMinutes: 20 }),
  item({ id: '4', title: 'String lab', difficulty: 'easy', language: 'python', category: 'algorithms', estimatedMinutes: 20, attemptCount: 7, fastestVerifiedMs: 95_000 }),
  item({ id: '5', title: 'Link shortener', description: 'Build a Python-backed link shortener with short links that redirect', difficulty: 'hard', language: 'python', category: 'backend', estimatedMinutes: 45 }),
];

describe('difficultyRank (SPE-126 sort-bug fix)', () => {
  it('orders by rank, not alphabetical string', () => {
    expect(difficultyRank('easy')).toBeLessThan(difficultyRank('medium'));
    expect(difficultyRank('medium')).toBeLessThan(difficultyRank('hard'));
    expect(difficultyRank('mystery')).toBe(3);
  });

  it('sortChallenges orders easy -> medium -> hard then by title', () => {
    const sorted = sortChallenges([
      item({ id: 'hard', difficulty: 'hard', title: 'Z' }),
      item({ id: 'medium2', difficulty: 'medium', title: 'B' }),
      item({ id: 'easy2', difficulty: 'easy', title: 'Y' }),
      item({ id: 'medium1', difficulty: 'medium', title: 'A' }),
      item({ id: 'easy1', difficulty: 'easy', title: 'A' }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual([
      'easy1',
      'easy2',
      'medium1',
      'medium2',
      'hard',
    ]);
  });
});

describe('applyFilters', () => {
  it('returns everything with default (empty) filters', () => {
    expect(applyFilters(catalog, EMPTY_FILTERS)).toHaveLength(5);
  });

  it('ANDs across groups and ORs within a group', () => {
    const filters = {
      ...EMPTY_FILTERS,
      languages: ['typescript', 'python'],
      difficulties: ['easy', 'medium'],
    };
    const result = applyFilters(catalog, filters);
    expect(result.map((c) => c.id).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('filters by category', () => {
    const result = applyFilters(catalog, { ...EMPTY_FILTERS, categories: ['algorithms'] });
    expect(result.map((c) => c.id).sort()).toEqual(['1', '4']);
  });

  it('filters by AI allowance', () => {
    const allowed = applyFilters(catalog, { ...EMPTY_FILTERS, ai: 'allowed' });
    expect(allowed.map((c) => c.id)).not.toContain('2');
    const noAi = applyFilters(catalog, { ...EMPTY_FILTERS, ai: 'none' });
    expect(noAi.map((c) => c.id)).toEqual(['2']);
  });

  it('filters by time bucket on estimatedMinutes', () => {
    expect(applyFilters(catalog, { ...EMPTY_FILTERS, time: 'le15' }).map((c) => c.id)).toEqual(['1']);
    expect(applyFilters(catalog, { ...EMPTY_FILTERS, time: 'le30' }).map((c) => c.id).sort()).toEqual(['1', '2', '3', '4']);
    expect(applyFilters(catalog, { ...EMPTY_FILTERS, time: 'gt60' })).toHaveLength(0);
  });

  it('combines all filter groups', () => {
    const result = applyFilters(catalog, {
      languages: ['python'],
      categories: ['algorithms'],
      difficulties: ['easy'],
      ai: 'allowed',
      time: 'le30',
      search: '',
    });
    expect(result.map((c) => c.id)).toEqual(['4']);
  });

  it('search matches title and description case-insensitively (SPE-138)', () => {
    const byTitle = applyFilters(catalog, { ...EMPTY_FILTERS, search: 'chat' });
    expect(byTitle.map((c) => c.id)).toEqual(['3']);
    const byDescription = applyFilters(catalog, {
      ...EMPTY_FILTERS,
      search: 'SHORT LINK',
    });
    expect(byDescription.map((c) => c.id)).toEqual(['5']);
    const noMatch = applyFilters(catalog, { ...EMPTY_FILTERS, search: 'blockchain' });
    expect(noMatch).toHaveLength(0);
    // Whitespace-only search is a no-op.
    expect(applyFilters(catalog, { ...EMPTY_FILTERS, search: '   ' })).toHaveLength(5);
  });

  it('search combines with other filter groups (AND)', () => {
    const result = applyFilters(catalog, {
      ...EMPTY_FILTERS,
      languages: ['typescript'],
      search: 'todo',
    });
    expect(result.map((c) => c.id)).toEqual(['2']);
  });
});

describe('URL param roundtrip (SPE-126 §2.2 #5)', () => {
  it('serializes and restores the exact filter state', () => {
    const state = {
      languages: ['typescript', 'python'],
      categories: ['ai', 'data'],
      difficulties: ['easy', 'hard'],
      ai: 'allowed' as const,
      time: 'le30' as const,
      search: 'auth',
    };
    const query = serializeFiltersToParams(state);
    // URLSearchParams percent-encodes the list commas; both forms parse back
    // to the identical state.
    expect(query).toBe(
      'language=typescript%2Cpython&category=ai%2Cdata&difficulty=easy%2Chard&ai=allowed&time=le30&q=auth'
    );
    expect(parseFiltersFromParams(new URLSearchParams(query))).toEqual(state);
  });

  it('roundtrips a search-only state', () => {
    const state = { ...EMPTY_FILTERS, search: 'calculator' };
    const query = serializeFiltersToParams(state);
    expect(query).toBe('q=calculator');
    expect(parseFiltersFromParams(new URLSearchParams(query))).toEqual(state);
  });

  it('parses an empty query to defaults', () => {
    expect(parseFiltersFromParams(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
  });

  it('drops invalid difficulty/time/ai values from crafted URLs', () => {
    const state = parseFiltersFromParams(
      new URLSearchParams('difficulty=impossible&time=whenever&ai=hack&language=rust')
    );
    expect(state.difficulties).toEqual([]);
    expect(state.time).toBeNull();
    expect(state.ai).toBeNull();
    // language/category are free-form (distinct values come from the DB),
    // but a value that matches nothing simply filters everything out.
    expect(state.languages).toEqual(['rust']);
  });
});

describe('active-filter bookkeeping (SPE-126 §2.2 #6)', () => {
  it('counts each active group correctly', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    const state = { ...EMPTY_FILTERS, categories: ['ai', 'data'], ai: 'none' as const };
    expect(countActiveFilters(state)).toBe(3);
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('counts an active search as one filter (SPE-138)', () => {
    const state = { ...EMPTY_FILTERS, search: 'auth' };
    expect(countActiveFilters(state)).toBe(1);
    expect(hasActiveFilters(state)).toBe(true);
    expect(countActiveFilters({ ...state, search: '   ' })).toBe(0);
    expect(hasActiveFilters({ ...state, search: '   ' })).toBe(false);
  });
});

describe('distinctValues', () => {
  it('returns sorted distinct display values', () => {
    expect(distinctValues(catalog, 'language')).toEqual(['python', 'typescript']);
    expect(distinctValues(catalog, 'category')).toEqual([
      'ai',
      'algorithms',
      'backend',
      'full-stack',
    ]);
  });
});
