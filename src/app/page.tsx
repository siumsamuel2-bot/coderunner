import Link from "next/link";
import { getCaller } from "@/trpc/caller";

export const dynamic = "force-dynamic";

const difficultyStyles: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

type Challenge = {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
};

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      href={`/challenges/${challenge.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {challenge.title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            difficultyStyles[challenge.difficulty] ??
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {challenge.difficulty}
        </span>
      </div>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {challenge.description}
      </p>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
        ~{challenge.estimatedMinutes} min
      </p>
    </Link>
  );
}

export default async function Home() {
  const caller = await getCaller();
  const challenges = await caller.challenges.list();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto w-full max-w-3xl flex-col px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Coderunner
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Race the clock. Build software with AI. Every millisecond matters.
          </p>
        </div>
        <div className="mt-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Challenges
            </h2>
            <Link
              href="/leaderboard"
              className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
            >
              Leaderboard
            </Link>
          </div>
          {challenges.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No challenges yet. Run <code>npm run db:seed</code> to load the launch set.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.slug} challenge={challenge} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
