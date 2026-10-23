import { prisma } from '@/lib/prisma';

import { ChallengesList } from './ChallengesList';

export const dynamic = 'force-dynamic';

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

export default async function ChallengesPage() {
  const challengesRaw = await prisma.challenge.findMany({
    orderBy: { title: 'asc' },
    include: {
      _count: { select: { runs: true } },
      runs: {
        where: { status: 'verified', elapsedMs: { not: null } },
        orderBy: { elapsedMs: 'asc' },
        take: 1,
        select: { elapsedMs: true },
      },
    },
  });

  const challenges: ChallengeWithStats[] = challengesRaw.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    category: c.category,
    language: c.language,
    attemptCount: c._count.runs,
    fastestTimeMs: c.runs[0]?.elapsedMs ?? null,
  }));

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Coderunner Challenges
        </h1>
        <p className='mb-12 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
          Build apps with AI and race against the clock on verified leaderboards
        </p>

        {challenges.length > 0 ? (
          <ChallengesList challenges={challenges} />
        ) : (
          <div className='col-span-full text-center py-16'>
            <svg className='mx-auto mb-4 h-10 w-10 text-gray-400 dark:text-gray-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
            </svg>
            <p className='text-gray-500 dark:text-gray-400 text-lg mb-4'>
              No challenges available yet
            </p>
            <a
              href='/leaderboard'
              className='inline-flex h-11 w-auto items-center justify-center gap-2 rounded-full border border-solid border-indigo-600 px-5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2'
            >
              View Leaderboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
