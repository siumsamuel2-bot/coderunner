import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatTime(ms: number | null): string {
  return ms === null ? "N/A" : `${(ms / 1000).toFixed(2)}s`;
}

export default async function ChallengesPage() {
  const [challenges, allRuns] = await Promise.all([
    prisma.challenge.findMany({
      orderBy: {
        title: "asc",
      },
    }),
    prisma.run.findMany({
      select: {
        challengeId: true,
        status: true,
        elapsedMs: true,
      },
    }),
  ]);

  const runsByChallenge = new Map<string, typeof allRuns>();
  for (const run of allRuns) {
    const list = runsByChallenge.get(run.challengeId) ?? [];
    list.push(run);
    runsByChallenge.set(run.challengeId, list);
  }

  function challengeStats(challengeId: string) {
    const runs = runsByChallenge.get(challengeId) ?? [];
    const attempts = runs.length;
    const verified = runs.filter(
      (r) => r.status === "verified" && r.elapsedMs !== null
    );
    const best = verified.length
      ? Math.min(...verified.map((r) => r.elapsedMs!))
      : null;
    return { attempts, best };
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-center text-gray-900 dark:text-gray-100">
          Coderunner Challenges
        </h1>
        <p className="mb-12 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Build apps with AI and race against the clock on verified leaderboards
        </p>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => {
            const { attempts, best } = challengeStats(challenge.id);
            return (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.slug}`}
                className="group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow transform hover:-translate-y-1">
                  <div className="p-6">
                    <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {challenge.title}
                    </h2>
                    <p className="mb-4 text-gray-600 dark:text-gray-400 line-clamp-3">
                      {challenge.description}
                    </p>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"/>
                        </svg>
                        <span className="font-medium">{challenge.estimatedMinutes} min</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium">
                        {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Attempts</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{attempts}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Best verified</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(best)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}