import { describe, expect, it } from 'vitest';

import {
  dedupeBestPerUser,
  groupByChallenge,
  pickBestResult,
  type LeaderboardRun,
} from '@/lib/leaderboard';

function run(overrides: Partial<LeaderboardRun> & { id: string }): LeaderboardRun {
  return {
    userId: 'u1',
    challengeId: 'c1',
    elapsedMs: 100_000,
    endedAt: new Date('2026-10-19T10:00:00Z'),
    user: { id: 'u1', name: 'Player', image: null },
    challenge: {
      id: 'c1',
      slug: 'calculator',
      title: 'Calculator',
      difficulty: 'easy',
    },
    ...overrides,
  };
}

describe('dedupeBestPerUser (SPE-135, dep D2)', () => {
  it('keeps only each player\'s fastest verified run per challenge', () => {
    const deduped = dedupeBestPerUser([
      run({ id: 'a', userId: 'u1', elapsedMs: 200_000 }),
      run({ id: 'b', userId: 'u1', elapsedMs: 90_000 }),
      run({ id: 'c', userId: 'u1', elapsedMs: 150_000 }),
      run({ id: 'd', userId: 'u2', elapsedMs: 120_000 }),
    ]);
    expect(deduped.map((r) => r.id).sort()).toEqual(['b', 'd']);
  });

  it('keeps separate bests per challenge', () => {
    const deduped = dedupeBestPerUser([
      run({ id: 'a', challengeId: 'c1', elapsedMs: 100_000 }),
      run({ id: 'b', challengeId: 'c2', elapsedMs: 300_000 }),
      run({ id: 'c', challengeId: 'c2', elapsedMs: 250_000 }),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  it('drops runs without elapsedMs', () => {
    const deduped = dedupeBestPerUser([
      run({ id: 'a', elapsedMs: null }),
      run({ id: 'b', elapsedMs: 50_000 }),
    ]);
    expect(deduped.map((r) => r.id)).toEqual(['b']);
  });

  it('breaks exact ties by earlier endedAt', () => {
    const deduped = dedupeBestPerUser([
      run({ id: 'later', elapsedMs: 100_000, endedAt: new Date('2026-10-19T12:00:00Z') }),
      run({ id: 'earlier', elapsedMs: 100_000, endedAt: new Date('2026-10-19T08:00:00Z') }),
    ]);
    expect(deduped.map((r) => r.id)).toEqual(['earlier']);
  });
});

describe('groupByChallenge (SPE-135 sections)', () => {
  it('groups by slug, sorts each section by time, caps at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      run({ id: `r${i}`, userId: `u${i}`, elapsedMs: i * 1000 })
    );
    const sections = groupByChallenge(many);
    expect(sections).toHaveLength(1);
    expect(sections[0].runs).toHaveLength(50);
    expect(sections[0].runs[0].elapsedMs).toBe(0);
  });

  it('orders sections by challenge title', () => {
    const sections = groupByChallenge([
      run({ id: 'a', challengeId: 'c2', challenge: { id: 'c2', slug: 'zeta', title: 'Zeta', difficulty: 'hard' } }),
      run({ id: 'b', challengeId: 'c1', challenge: { id: 'c1', slug: 'alpha', title: 'Alpha', difficulty: 'easy' } }),
    ]);
    expect(sections.map((s) => s.challenge.title)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('pickBestResult (SPE-135 YourRankStrip)', () => {
  const rankFor = (challengeId: string, elapsedMs: number) => {
    // c1: 100k -> rank 2; c2: 250k -> rank 7
    if (challengeId === 'c1') return elapsedMs <= 100_000 ? 2 : 9;
    return elapsedMs <= 250_000 ? 7 : 12;
  };

  it('picks the result with the lowest rank across challenges', () => {
    const best = pickBestResult(
      [
        { challengeId: 'c1', elapsedMs: 100_000 },
        { challengeId: 'c2', elapsedMs: 250_000 },
      ],
      rankFor
    );
    expect(best).toEqual({ challengeId: 'c1', elapsedMs: 100_000, rank: 2 });
  });

  it('uses the fastest run per challenge before ranking', () => {
    const best = pickBestResult(
      [
        { challengeId: 'c1', elapsedMs: 180_000 },
        { challengeId: 'c1', elapsedMs: 100_000 },
      ],
      rankFor
    );
    expect(best?.elapsedMs).toBe(100_000);
  });

  it('returns null with no runs', () => {
    expect(pickBestResult([], rankFor)).toBeNull();
  });
});
