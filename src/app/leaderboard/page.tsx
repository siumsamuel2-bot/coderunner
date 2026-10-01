import Image from "next/image";

export default function Leaderboard() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert h-5 w-[100px]"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Leaderboard
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Top fastest challenge completions
          </p>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse border-border bg-white dark:bg-zinc-800">
              <thead>
                <tr className="border-b border-border dark:border-zinc-600">
                  <th className="left sm:left-left px-4 py-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Rank
                  </th>
                  <th className="left sm:left-left px-4 py-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    User
                  </th>
                  <th className="left sm:left-left px-4 py-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Challenge
                  </th>
                  <th className="left sm:left-left px-4 py-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-zinc-600">
                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-700">
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">1</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">user1</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">calculator</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">45s</td>
                </tr>
                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-700">
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">2</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">user2</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">todo-auth</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">52s</td>
                </tr>
                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-700">
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">3</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">user3</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">pdf-analyzer</td>
                  <td className="px-4 py-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">38s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Back Home
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            Login
          </a>
        </div>
      </main>
    </div>
  );
}