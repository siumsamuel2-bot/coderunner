import Link from "next/link";
import { getCaller } from "@/trpc/caller";

export const dynamic = "force-dynamic";

type LeaderboardEntry = {
  rank: number;
  userName: string;
  challengeSlug: string;
  challengeTitle: string;
  difficulty: string;
  elapsedMs: number;
};

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function toEntries(
  runs: Awaited<ReturnType<Awaited<ReturnType<typeof getCaller>>["runs"]["getLeaderboard"]>>
): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const run of runs) {
    const key = `${run.user.id}:${run.challenge.slug}`;
    const entry: LeaderboardEntry = {
      rank: 0,
      userName: run.user.name ?? "anonymous",
      challengeSlug: run.challenge.slug,
      challengeTitle: run.challenge.title,
      difficulty: run.challenge.difficulty,
      elapsedMs: run.elapsedMs ?? Number.MAX_SAFE_INTEGER,
    };
    const existing = best.get(key);
    if (!existing || entry.elapsedMs < existing.elapsedMs) best.set(key, entry);
  }
  return Array.from(best.values())
    .sort((a, b) => a.elapsedMs - b.elapsedMs)
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export default async function Leaderboard() {
  const caller = await getCaller();
  const entries = toEntries(await caller.runs.getLeaderboard());

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto w-full max-w-3xl flex-col px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Leaderboard
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Fastest verified completions, best run per runner per challenge.
          </p>
        </div>
        <div className="mt-10 w-full overflow-x-auto">
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No verified completions yet. Be the first to finish a challenge.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Runner</th>
                  <th className="px-4 py-3 font-medium">Challenge</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {entries.map((entry) => (
                  <tr
                    key={`${entry.rank}-${entry.challengeSlug}`}
                    className="hover:bg-white dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                      {entry.rank}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {entry.userName}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {entry.challengeTitle}
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {entry.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatElapsed(entry.elapsedMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-10 flex gap-4 text-sm font-medium">
          <Link
            href="/"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            Back to challenges
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 px-5 py-2.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 dark:text-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
