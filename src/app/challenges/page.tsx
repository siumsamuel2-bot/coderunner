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
          {challenges.map((challenge) => (
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
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}