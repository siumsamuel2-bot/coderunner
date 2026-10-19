/**
 * Leaderboard data shaping (SPE-135, dep D2 from the SPE-127 spec §2.5).
 *
 * Pure functions over fetched verified runs so the tRPC procedure and the
 * unit tests share one source of truth.
 */

export interface LeaderboardRun {
  id: string;
  userId: string;
  challengeId: string;
  elapsedMs: number | null;
  endedAt: Date | null;
  user: { id: string; name: string | null; image: string | null };
  challenge: {
    id: string;
    slug: string;
    title: string;
    difficulty: string;
  };
}

/**
 * Best-per-user dedup (D2): keep only each player's fastest verified run
 * per challenge — one rank per player, no multi-row spam. Ties on
 * elapsedMs keep the earlier-ended run (deterministic).
 */
export function dedupeBestPerUser(runs: LeaderboardRun[]): LeaderboardRun[] {
  const best = new Map<string, LeaderboardRun>();
  for (const run of runs) {
    if (run.elapsedMs === null) continue;
    const key = `${run.challengeId}:${run.userId}`;
    const current = best.get(key);
    if (
      current === undefined ||
      run.elapsedMs < current.elapsedMs! ||
      (run.elapsedMs === current.elapsedMs &&
        (run.endedAt?.getTime() ?? 0) < (current.endedAt?.getTime() ?? 0))
    ) {
      best.set(key, run);
    }
  }
  return [...best.values()];
}

/** Per-challenge sections sorted by time asc, capped (§2.2). */
export function groupByChallenge(
  runs: LeaderboardRun[],
  cap = 50
): { slug: string; challenge: LeaderboardRun['challenge']; runs: LeaderboardRun[] }[] {
  const byChallenge = new Map<
    string,
    { challenge: LeaderboardRun['challenge']; runs: LeaderboardRun[] }
  >();
  for (const run of runs) {
    const entry = byChallenge.get(run.challenge.slug);
    if (entry) {
      entry.runs.push(run);
    } else {
      byChallenge.set(run.challenge.slug, {
        challenge: run.challenge,
        runs: [run],
      });
    }
  }
  return [...byChallenge.entries()]
    .map(([slug, { challenge, runs: challengeRuns }]) => ({
      slug,
      challenge,
      runs: challengeRuns
        .sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0))
        .slice(0, cap),
    }))
    .sort((a, b) => a.challenge.title.localeCompare(b.challenge.title));
}

/**
 * The signed-in viewer's best result across challenges (§2.4): their
 * fastest verified run per challenge, ranked by count of faster verified
 * runs; the strip shows the single best (lowest rank, ties by time).
 */
export function pickBestResult(
  userRuns: { challengeId: string; elapsedMs: number }[],
  rankFor: (challengeId: string, elapsedMs: number) => number
): { challengeId: string; elapsedMs: number; rank: number } | null {
  const bestPerChallenge = new Map<string, number>();
  for (const run of userRuns) {
    const current = bestPerChallenge.get(run.challengeId);
    if (current === undefined || run.elapsedMs < current) {
      bestPerChallenge.set(run.challengeId, run.elapsedMs);
    }
  }
  let best: { challengeId: string; elapsedMs: number; rank: number } | null =
    null;
  for (const [challengeId, elapsedMs] of bestPerChallenge) {
    const rank = rankFor(challengeId, elapsedMs);
    if (
      best === null ||
      rank < best.rank ||
      (rank === best.rank && elapsedMs < best.elapsedMs)
    ) {
      best = { challengeId, elapsedMs, rank };
    }
  }
  return best;
}
