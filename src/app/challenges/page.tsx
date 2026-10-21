import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const challenges = await prisma.challenge.findMany({
    orderBy: {
      title: "asc",
    },
  });

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
          {challenges.length > 0 ? (
            challenges.map((challenge) => (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.slug}`}
                className="group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow transform hover:-translate-y-1">
                  <div className="p-6">
                    <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {challenge.title}
                    </h3>
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
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <svg className="mx-auto mb-4 h-10 w-10 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                No challenges available yet
              </p>
              <Link
                href="/leaderboard"
                className="inline-flex h-11 w-auto items-center justify-center gap-2 rounded-full border border-solid border-indigo-600 px-5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                View Leaderboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}