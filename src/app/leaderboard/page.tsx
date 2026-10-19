import Link from 'next/link';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import { serverTrpc } from '@/utils/trpc';
import { auth } from '@/auth';
import { formatDuration } from '@/lib/format';
import {
  dedupeBestPerUser,
  groupByChallenge,
  type LeaderboardRun,
} from '@/lib/leaderboard';

import {
  VerificationNotice,
  VerificationTrustLine,
} from '@/components/challenges/VerificationNotice';
import { LeaderboardNav } from '@/components/challenges/LeaderboardNav';
import { EmptyState } from '@/components/challenges/EmptyState';
import { DifficultyBadge } from '@/components/challenges/DifficultyBadge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Global speedrun leaderboard - fastest verified AI app-building times across all challenges.',
};

const RANK_BADGE_CLASSES: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  2: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        aria-label={`Rank ${rank}`}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${RANK_BADGE_CLASSES[rank]}`}
      >
        {rank}
      </span>
    );
  }
  return <span className='text-sm text-gray-700 dark:text-gray-300'>#{rank}</span>;
}

function SubmittedCell({ endedAt }: { endedAt: Date | null }) {
  if (!endedAt) return <span>—</span>;
  const date = new Date(endedAt);
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
  return (
    <span title={date.toISOString()} className='text-sm text-gray-600 dark:text-gray-400'>
      {label}
    </span>
  );
}

/**
 * Leaderboard (SPE-135, from the SPE-127 spec §2). One rank per player
 * (best-per-user dedup, dep D2), per-challenge anchored sections, top-3
 * medal badges, current-user highlight, YourRankStrip. Only real backend
 * metrics: no score column (scoring v1, dep D3, not implemented — the
 * column is absent, not dashed).
 */
export default async function LeaderboardPage() {
  const [session, verifiedRuns] = await Promise.all([
    auth(),
    serverTrpc.runs.getLeaderboard(),
  ]);

  const currentUserId = session?.user?.id ?? null;

  const sections = groupByChallenge(
    dedupeBestPerUser(verifiedRuns as LeaderboardRun[])
  );

  // YourRankStrip (§2.4): the viewer's best result across challenges.
  // Fastest verified run per challenge, ranked by count of faster verified
  // runs (same method as the results page); the strip shows the single
  // best (lowest rank, ties by time).
  let bestResult: {
    challengeSlug: string;
    challengeTitle: string;
    elapsedMs: number;
    rank: number;
  } | null = null;
  if (currentUserId) {
    const myVerifiedRuns = await prisma.run.findMany({
      where: {
        userId: currentUserId,
        status: 'verified',
        elapsedMs: { not: null },
      },
      select: {
        challengeId: true,
        elapsedMs: true,
        challenge: { select: { slug: true, title: true } },
      },
    });
    const bestPerChallenge = new Map<
      string,
      { elapsedMs: number; slug: string; title: string }
    >();
    for (const r of myVerifiedRuns) {
      const elapsedMs = r.elapsedMs as number;
      const current = bestPerChallenge.get(r.challengeId);
      if (!current || elapsedMs < current.elapsedMs) {
        bestPerChallenge.set(r.challengeId, {
          elapsedMs,
          slug: r.challenge.slug,
          title: r.challenge.title,
        });
      }
    }
    for (const [challengeId, info] of bestPerChallenge) {
      const faster = await prisma.run.count({
        where: {
          challengeId,
          status: 'verified',
          elapsedMs: { lt: info.elapsedMs },
        },
      });
      const rank = faster + 1;
      if (
        bestResult === null ||
        rank < bestResult.rank ||
        (rank === bestResult.rank && info.elapsedMs < bestResult.elapsedMs)
      ) {
        bestResult = {
          challengeSlug: info.slug,
          challengeTitle: info.title,
          elapsedMs: info.elapsedMs,
          rank,
        };
      }
    }
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-4 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Leaderboard
        </h1>
        <p className='mb-3 text-center text-gray-600 dark:text-gray-400 max-w-4xl mx-auto'>
          Fastest verified times for each challenge — one rank per player.
        </p>
        <div className='mb-8 flex justify-center'>
          <VerificationTrustLine href='#how-verification-works' />
        </div>

        {bestResult && (
          <div className='mx-auto mb-8 max-w-xl rounded-xl border border-indigo-200 bg-white p-4 text-center shadow-sm dark:border-indigo-800 dark:bg-gray-800'>
            <p className='text-sm text-gray-700 dark:text-gray-300'>
              Your best:{' '}
              <span className='font-semibold text-indigo-600 dark:text-indigo-400'>
                #{bestResult.rank}
              </span>{' '}
              on {bestResult.challengeTitle} ·{' '}
              <span className='font-semibold'>
                {formatDuration(bestResult.elapsedMs)}
              </span>{' '}
              <Link
                href={`/challenges/${bestResult.challengeSlug}`}
                className='ml-2 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300'
              >
                View →
              </Link>
            </p>
          </div>
        )}

        {sections.length === 0 ? (
          <EmptyState variant='no-verified-runs' />
        ) : (
          <>
            <LeaderboardNav
              sections={sections.map(({ slug, challenge }) => ({
                slug,
                title: challenge.title,
              }))}
            />

            {sections.map(({ slug, challenge, runs }) => (
              <section key={slug} id={slug} className='mb-12 scroll-mt-6'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    <h2 className='text-2xl font-semibold text-gray-900 dark:text-gray-100'>
                      {challenge.title} Leaderboard
                    </h2>
                    <DifficultyBadge difficulty={challenge.difficulty} />
                  </div>
                  <Link
                    href={`/challenges/${slug}`}
                    className='text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
                  >
                    View challenge →
                  </Link>
                </div>

                <div className='overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700'>
                  <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
                    <thead className='bg-gray-50 dark:bg-gray-800'>
                      <tr>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          Rank
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          Player
                        </th>
                        <th
                          scope='col'
                          aria-sort='ascending'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          Time
                        </th>
                        <th
                          scope='col'
                          className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
                        >
                          Submitted
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800'>
                      {runs.map((run, idx) => {
                        const isMe = currentUserId === run.user.id;
                        return (
                          <tr
                            key={run.id}
                            className={`${
                              idx % 2 === 1
                                ? 'bg-gray-50 dark:bg-gray-700/50'
                                : ''
                            } ${
                              isMe
                                ? 'bg-indigo-50 dark:bg-indigo-950/40'
                                : ''
                            } hover:bg-gray-50 dark:hover:bg-gray-700/50`}
                          >
                            <td className='px-6 py-4 whitespace-nowrap'>
                              <RankCell rank={idx + 1} />
                            </td>
                            <td className='px-6 py-4 whitespace-nowrap'>
                              <span className='flex items-center gap-2'>
                                {run.user.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={run.user.image}
                                    alt={`${run.user.name ?? 'user'}'s avatar`}
                                    className='h-7 w-7 rounded-full'
                                  />
                                ) : (
                                  <span className='flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200'>
                                    {run.user.name?.[0]?.toUpperCase() ?? '?'}
                                  </span>
                                )}
                                <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {run.user.name || 'Anonymous'}
                                </span>
                                <span
                                  role='img'
                                  aria-label='Verified run'
                                  title='Verified run'
                                  className='inline-flex'
                                >
                                  <svg
                                    aria-hidden='true'
                                    className='h-4 w-4 text-green-600 dark:text-green-400'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                  >
                                    <path
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      strokeWidth='2'
                                      d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                                    />
                                  </svg>
                                </span>
                                {isMe && (
                                  <span className='rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-indigo-500'>
                                    You
                                  </span>
                                )}
                              </span>
                            </td>
                            <td
                              title={
                                run.elapsedMs !== null
                                  ? `${run.elapsedMs} ms`
                                  : undefined
                              }
                              className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {run.elapsedMs !== null
                                ? formatDuration(run.elapsedMs)
                                : '—'}
                            </td>
                            <td className='px-6 py-4 whitespace-nowrap'>
                              <SubmittedCell endedAt={run.endedAt} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}

        {/* Full transparency notice (SPE-139): target of the trust line
            anchor; every row on these boards is verified by construction. */}
        <div className='mx-auto mt-12 max-w-3xl'>
          <VerificationNotice id='how-verification-works' />
        </div>
      </div>
    </div>
  );
}
