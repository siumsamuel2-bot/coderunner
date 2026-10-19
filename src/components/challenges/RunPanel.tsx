'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { startedAtLabel } from '@/lib/runs/timer';

import { RunTimer } from './RunTimer';

export interface ActiveRunInfo {
  runId: string;
  status: string;
  startedAt: string;
  attempt: number;
}

export interface RunPanelProps {
  challengeId: string;
  slug: string;
  challengeTitle: string;
  signedIn: boolean;
  aiAllowed: boolean;
  /** The viewer's active run (in_progress/submitted/verifying), if any. */
  activeRun: ActiveRunInfo | null;
}

const cardClass =
  'rounded-xl bg-white shadow-sm p-6 dark:bg-gray-800';
const primaryButtonClass =
  'w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-black';

/**
 * RunPanel (SPE-133, from the SPE-127 spec §1.2-1.3): one component owning
 * the run lifecycle states on the challenge page.
 *
 *   A  Not started (signed out)   -> sign-in prompt
 *   B  Ready to start             -> Start button (server-anchored clock)
 *   C  Run active (in_progress)   -> elapsed timer + submit
 *   D  Resume (active run on load / 409) -> same view as C
 *   E  Submitted/verifying        -> hand off to the results page
 *
 * Only real backend state is rendered; timing is server-anchored
 * (elapsed count-up — no enforced limit exists, so no countdown).
 */
export function RunPanel({
  challengeId,
  slug,
  challengeTitle,
  signedIn,
  aiAllowed,
  activeRun: initialActiveRun,
}: RunPanelProps) {
  const router = useRouter();
  const [activeRun, setActiveRun] = useState<ActiveRunInfo | null>(
    initialActiveRun
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [solutionUrl, setSolutionUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- State A: signed out -------------------------------------------------
  if (!signedIn) {
    return (
      <div className={cardClass}>
        <h2 className='mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
          Sign in to start this challenge
        </h2>
        <p className='mb-4 text-sm text-gray-600 dark:text-gray-400'>
          Your run is timed server-side and tied to your account.
        </p>
        <a
          href={`/auth/signin?redirect_url=/challenges/${slug}`}
          className={primaryButtonClass}
        >
          Sign in to start
        </a>
      </div>
    );
  }

  // --- State E: submitted/verifying (owned by the verification pipeline) ---
  if (activeRun && activeRun.status !== 'in_progress') {
    return (
      <div className={cardClass}>
        <h2 className='mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
          Submission in verification
        </h2>
        <p className='mb-4 text-sm text-gray-600 dark:text-gray-400'>
          Your attempt #{activeRun.attempt} was submitted and is being
          verified. You can start a new attempt once it finishes.
        </p>
        <a
          href={`/challenges/${slug}/results/${activeRun.runId}`}
          className={primaryButtonClass}
        >
          View result
        </a>
      </div>
    );
  }

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch('/api/runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      if (response.ok) {
        const run = await response.json();
        setActiveRun({
          runId: run.id,
          status: run.status,
          startedAt: run.startedAt,
          attempt: run.attempt,
        });
      } else if (response.status === 409) {
        // An active run appeared (e.g. started in another tab). Re-render
        // from the server, which resolves the run into state C/D.
        await router.refresh();
      } else {
        throw new Error('Failed to start run');
      }
    } catch {
      setError('Failed to start run. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleAbandon = async () => {
    if (!activeRun) return;
    if (
      !window.confirm(
        'Abandon this run? It counts as an attempt and cannot be undone.'
      )
    ) {
      return;
    }
    setIsAbandoning(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${activeRun.runId}/abandon`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to abandon run');
      setActiveRun(null);
      // Refresh so server-rendered attempt counters reflect the abandon.
      router.refresh();
    } catch {
      setError('Failed to abandon run. Please try again.');
    } finally {
      setIsAbandoning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: activeRun.runId, solutionUrl }),
      });
      if (response.ok) {
        // The results page owns verifying/terminal states via SSE.
        router.push(`/challenges/${slug}/results/${activeRun.runId}`);
        return;
      }
      if (response.status === 409) {
        // Run no longer in_progress (race or already submitted).
        await router.refresh();
        return;
      }
      throw new Error('Failed to submit run');
    } catch {
      setError('Failed to submit run. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- States C/D: active run ---------------------------------------------
  if (activeRun) {
    return (
      <div className='rounded-xl bg-white shadow-sm p-6 ring-2 ring-indigo-500/40 dark:bg-gray-800'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400'>
              Run in progress
            </p>
            <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
              Attempt #{activeRun.attempt} · started{' '}
              {startedAtLabel(activeRun.startedAt)}
            </p>
          </div>
          <RunTimer
            startedAtMs={new Date(activeRun.startedAt).getTime()}
            challengeTitle={challengeTitle}
          />
        </div>

        <p className='mb-5 text-sm text-gray-600 dark:text-gray-400'>
          You can close this tab — the clock keeps running server-side. Come
          back to this page anytime.
        </p>

        {error && (
          <div className='mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label
              htmlFor='solution-url'
              className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'
            >
              Solution URL
            </label>
            <input
              type='url'
              id='solution-url'
              value={solutionUrl}
              onChange={(e) => setSolutionUrl(e.target.value)}
              required
              disabled={isSubmitting}
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
              placeholder='https://your-deployed-app.example.com'
            />
          </div>
          <button type='submit' disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? 'Submitting...' : 'Submit for verification'}
          </button>
          <p className='mt-2 text-xs text-gray-500 dark:text-gray-500'>
            Submitting ends the timer for this attempt. One submission per
            attempt. Your official time is computed server-side when you
            submit.
          </p>
        </form>

        <div className='mt-4 pt-3 border-t border-gray-100 dark:border-gray-700'>
          <button
            type='button'
            onClick={handleAbandon}
            disabled={isAbandoning}
            className='text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          >
            {isAbandoning ? 'Abandoning...' : 'Abandon run'}
          </button>
        </div>
      </div>
    );
  }

  // --- State B: ready to start ---------------------------------------------
  return (
    <div className={cardClass}>
      <h2 className='mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
        Start challenge
      </h2>
      <p className='mb-4 text-sm text-gray-600 dark:text-gray-400'>
        The clock starts when you click and stops when you submit your
        deployed URL. Deploying counts — commit early, deploy as soon as it
        works.
      </p>

      {error && (
        <div className='mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm'>
          {error}
        </div>
      )}

      <button
        type='button'
        onClick={handleStart}
        disabled={isStarting}
        className={primaryButtonClass}
      >
        {isStarting ? 'Starting...' : 'Start challenge'}
      </button>

      <p className='mt-3 text-xs text-gray-500 dark:text-gray-500'>
        Unlimited attempts. One active run at a time.
      </p>
      <p className='mt-1 text-xs text-gray-500 dark:text-gray-500'>
        {aiAllowed
          ? 'Use ChatGPT, Claude, Cursor, Copilot — or nothing. Your result is what matters.'
          : 'No AI tools for this challenge — your own skills only.'}
      </p>
    </div>
  );
}
