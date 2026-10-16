'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { useVerificationUpdates } from '@/lib/verification/sse-hook';

export function SubmitRunForm({
  challengeId,
  userId,
}: {
  challengeId: string;
  userId: string | null;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [displayElapsedMs, setDisplayElapsedMs] = useState<number>(0);
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { runStatus, error: verificationError } = useVerificationUpdates(runId);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setDisplayElapsedMs(Date.now() - startedAt.getTime());
    }, 1000);
    setTimeout(() => {
      setDisplayElapsedMs(Date.now() - startedAt.getTime());
    }, 0);
    return () => clearInterval(id);
  }, [startedAt]);

  const isFinal =
    runStatus?.status === 'verified' ||
    runStatus?.status === 'failed';

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  const router = useRouter();

  const handleStart = async () => {
    setSubmitError(null);
    setRunId(null);
    setStartedAt(null);
    setAttempts(0);

    if (!userId) {
      router.push('/sign-in');
      return;
    }

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', challengeId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start challenge');
      }

      const run = await response.json();
      setRunId(run.id);
      setStartedAt(new Date(run.startedAt));
      setAttempts(run.attempts ?? 0);
    } catch (error) {
      console.error('Error starting run:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to start challenge'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!runId) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', runId, solutionUrl: submittedUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to submit run');
      }

      const run = await response.json();
      setAttempts(run.attempts ?? attempts + 1);
    } catch (error) {
      console.error('Error submitting run:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to submit run. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel = () => {
    if (!runStatus) return null;
    switch (runStatus.status) {
      case 'in_progress':
        return <span className='text-xs text-blue-600 dark:text-blue-400'>In progress</span>;
      case 'submitted':
        return <span className='text-xs text-blue-600 dark:text-blue-400'>Submitted, awaiting verification</span>;
      case 'verifying':
        return <span className='text-xs text-yellow-600 dark:text-yellow-400 animate-pulse'>Verifying...</span>;
      case 'verified':
        return (
          <span className='text-xs text-green-600 dark:text-green-400 font-medium'>
            Verified in {formatTime(runStatus.elapsedMs ?? displayElapsedMs)}
          </span>
        );
      case 'failed':
        return <span className='text-xs text-red-600 dark:text-red-400 font-medium'>Failed verification</span>;
      default:
        return <span className='text-xs text-gray-600 dark:text-gray-400'>{runStatus.status}</span>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4'>
      {runId ? (
        <>
          <h2 className='mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100'>
            Challenge Running
          </h2>
          <p className='mb-4 text-gray-600 dark:text-gray-400'>
            The clock is running. Build your app, then submit your solution URL.
          </p>

          <div className='mb-4 flex items-center space-x-2 text-sm font-medium'>
            <span className='text-gray-500 dark:text-gray-400'>Time</span>
            <span className='text-indigo-600 dark:text-indigo-400 tabular-nums'>
              {isFinal && runStatus?.elapsedMs !== null
                ? formatTime(runStatus.elapsedMs)
                : formatTime(Math.max(0, displayElapsedMs))}
            </span>
            <span className='ml-2 px-2 py-0.5 rounded text-xs border'>
              Attempt {attempts + 1}
            </span>
          </div>

          {submitError && (
            <div className='mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md'>
              {submitError}
            </div>
          )}

          {!isFinal && (
            <>
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
                  value={submittedUrl}
                  onChange={(e) => setSubmittedUrl(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='https://your-deployed-app.example.com'
                />
              </div>
              {statusLabel()}
              <button
                type='submit'
                disabled={isSubmitting || !submittedUrl}
                className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50'
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </>
          )}

          {isFinal && (
            <Link href={`/challenges/${challengeId}/results/${runId}`}>
              {statusLabel()}
            </Link>
          )}
          {verificationError && (
            <span className='text-xs text-red-600 dark:text-red-400'>
              Error: {verificationError}
            </span>
          )}
        </>
      ) : (
        <>
          <h2 className='mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100'>
            Start the Challenge
          </h2>
          <p className='mb-4 text-gray-600 dark:text-gray-400'>
            Get a timed run. Build your app and submit the URL when ready.
          </p>

          {submitError && (
            <div className='mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md'>
              {submitError}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={isSubmitting}
            className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50'
          >
            {isSubmitting ? 'Starting...' : 'Start Challenge'}
          </button>
        </>
      )}
    </form>
  );
}
