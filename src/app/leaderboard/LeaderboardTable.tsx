'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';

type LeaderboardRun = {
  id: string;
  user: { id: string; name: string | null; image: string | null } | null;
  challenge: { slug: string; title: string };
  elapsedMs: number | null;
  endedAt: Date | null;
  verification: {
    id: string;
    status: string;
    testOutput: string | null;
    verifiedAt: Date | null;
  } | null;
  promptChain: unknown | null;
  toolLog: unknown | null;
};

type Medal = 'gold' | 'silver' | 'bronze';

function medalForRank(rank: number): Medal | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

function medalLabel(rank: number) {
  switch (rank) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return String(rank);
  }
}

type VerificationBadge = { label: string; variant: 'category' | 'verification'; value?: string };

function verificationBadge(run: LeaderboardRun): VerificationBadge {
  const v = run.verification;
  if (!v) return { label: 'N/A', variant: 'category' };
  return { label: v.status.charAt(0).toUpperCase() + v.status.slice(1), variant: 'verification', value: v.status };
}

function parseTestOutput(testOutput: string | null) {
  if (!testOutput) return null;
  try {
    const parsed = JSON.parse(testOutput);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return { raw: testOutput };
  } catch {
    return { raw: testOutput };
  }
}

export function LeaderboardTable({ runs, currentUserId }: { runs: LeaderboardRun[]; currentUserId: string | null }) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const userBestMs = useMemo(() => {
    if (!currentUserId) return null;
    const times = runs
      .filter((r) => r.user?.id === currentUserId && r.elapsedMs !== null)
      .map((r) => r.elapsedMs as number);
    return times.length > 0 ? Math.min(...times) : null;
  }, [runs, currentUserId]);

  return (
    <>
      <div className='overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700 sm:min-w-[700px]'>
        <thead className='bg-gray-50 dark:bg-gray-800'>
          <tr>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Rank
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              User
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Time
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Challenge
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Submitted
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Verification
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
              Evidence
            </th>
          </tr>
        </thead>
        <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
          {runs.map((run, idx) => {
            const rank = idx + 1;
            const medal = medalForRank(rank);
            const badge = verificationBadge(run);
            const isCurrentUser = !!currentUserId && run.user?.id === currentUserId;
            const isPersonalBest =
              isCurrentUser &&
              run.elapsedMs !== null &&
              userBestMs !== null &&
              run.elapsedMs === userBestMs;
            const rowClass = [
              'group',
              idx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-700' : '',
              isCurrentUser
                ? 'ring-2 ring-indigo-500/20 dark:ring-indigo-900/20 border border-indigo-500/30 dark:border-indigo-900/30'
                : '',
              medal ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <tr
                key={run.id}
                className={rowClass}
              >
                <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                  {medal ? (
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow-sm ${
                        medal === 'gold'
                          ? 'bg-yellow-300 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300'
                          : medal === 'silver'
                            ? 'bg-gray-300 text-gray-900 dark:bg-gray-700/20 dark:text-gray-300'
                            : 'bg-orange-300 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300'
                      }`}
                    >
                      {medalLabel(rank)}
                    </span>
                  ) : (
                    <span className='text-gray-500 dark:text-gray-400'>{rank}</span>
                  )}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
                  <span className='flex items-center space-x-3'>
                    {run.user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={run.user.image}
                        alt={`${run.user.name ?? 'user'}'s avatar`}
                        className='h-8 w-8 rounded-full'
                      />
                    ) : (
                      <span className='h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                        {run.user?.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className={isCurrentUser ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}>
                      {run.user?.name || 'Anonymous'}
                    </span>
                    {isCurrentUser && (
                      <span className='inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter'>
                        You
                      </span>
                    )}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono'>
                  {run.elapsedMs !== null
                    ? `${(run.elapsedMs / 1000).toFixed(2)}s`
                    : 'N/A'}
                  {isPersonalBest && (
                    <span className='ml-1 inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter'>
                      PB
                    </span>
                  )}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate max-w-[140px]'>
                  {run.challenge.title}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
                  {run.endedAt
                    ? new Date(run.endedAt).toLocaleDateString()
                    : '-'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <Badge variant={badge.variant} value={badge.value ?? badge.label} />
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <button
                    onClick={() => setOpenRunId(run.id)}
                    className='text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline hover:dark:hover:underline'
                  >
                    View evidence
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {openRunId && (
        <EvidenceDialog run={runs.find((r) => r.id === openRunId)!} onClose={() => setOpenRunId(null)} />
      )}
    </>
  );
}

function EvidenceDialog({ run, onClose }: { run: LeaderboardRun; onClose: () => void }) {
  const verification = run.verification;
  const testOutput = parseTestOutput(verification?.testOutput ?? null);

  return (
    <dialog
      className='fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6'
      onClose={onClose}
    >
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />
      <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            Run evidence
          </h2>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'>
            ✕
          </button>
        </div>
        <div className='flex-1 overflow-y-auto p-6 space-y-6'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>Status</p>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {verification ? verification.status.charAt(0).toUpperCase() + verification.status.slice(1) : 'N/A'}
              </p>
            </div>
            {verification?.verifiedAt && (
              <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
                <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>Verified at</p>
                <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                  {new Date(verification.verifiedAt).toLocaleString()}
                </p>
              </div>
            )}
            <div className='bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg sm:col-span-2'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400 uppercase'>Run</p>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                {run.challenge.title} &middot; {run.user?.name || 'Anonymous'}
              </p>
            </div>
          </div>

          {testOutput && (
            <section className='border border-gray-200 dark:border-gray-700 rounded-lg p-5'>
              <h3 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                <span className='w-1.5 h-1.5 rounded-full bg-indigo-600'></span> Test results
              </h3>
              <div className='space-y-2'>
                {Object.entries(testOutput).map(([key, value]) => {
                  if (key === 'raw') {
                    return (
                      <div key={key} className='text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all'>
                        {String(value)}
                      </div>
                    );
                  }
                  const cat = value as Record<string, unknown>;
                  const passed = (cat?.passed as number) ?? 0;
                  const failed = (cat?.failed as number) ?? 0;
                  const total = passed + failed;
                  return (
                    <div key={key} className='flex items-center justify-between text-sm'>
                      <span className='text-gray-600 dark:text-gray-400 capitalize'>{key.replace(/[A-Z]/g, m => ' ' + m).trim()}</span>
                      <span className={`font-medium ${failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {passed}/{total} passed
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className='border border-gray-200 dark:border-gray-700 rounded-lg p-5'>
            <h3 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
              <span className='w-1.5 h-1.5 rounded-full bg-indigo-600'></span> Anti-cheating
            </h3>
            <div className='text-sm text-gray-700 dark:text-gray-300 space-y-1'>
              <p>Verification attempts tracked via VerificationJob.</p>
              <p>
                {run.verification ? `Status: <span className='font-medium'>{run.verification.status}</span>` : 'No verification record.'}
              </p>
            </div>
          </section>

          {(run.promptChain || run.toolLog) && (
            <section className='border border-gray-200 dark:border-gray-700 rounded-lg p-5'>
              <h3 className='mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                <span className='w-1.5 h-1.5 rounded-full bg-indigo-600'></span> Session
              </h3>
              <div className='space-y-2 text-sm text-gray-700 dark:text-gray-300'>
                {run.promptChain ? (
                  <div>
                    <p className='font-medium mb-1'>Prompt chain provided.</p>
                    <pre className='bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs overflow-x-auto'>{JSON.stringify(run.promptChain, null, 2)}</pre>
                  </div>
                ) : null}
                {run.toolLog ? (
                  <div>
                    <p className='font-medium mb-1'>Tool log provided.</p>
                    <pre className='bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs overflow-x-auto'>{JSON.stringify(run.toolLog, null, 2)}</pre>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
        <div className='px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3'>
          <button onClick={onClose} className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md'>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
