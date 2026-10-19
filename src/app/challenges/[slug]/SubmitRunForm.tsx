'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useVerificationUpdates } from '@/lib/verification/sse-hook';

type ActiveRunConflict = {
  runId: string;
  status: string;
};

export function SubmitRunForm({
  challengeId,
}: {
  challengeId: string;
}) {
  const router = useRouter();
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [activeRunConflict, setActiveRunConflict] =
    useState<ActiveRunConflict | null>(null);
  const [isAbandoning, setIsAbandoning] = useState(false);

  const { runStatus, loading: verificationLoading, error: verificationError } =
    useVerificationUpdates(runId);

  const handleAbandon = async () => {
    if (!activeRunConflict) return;
    if (
      !window.confirm(
        'Abandon this run? It counts as an attempt and cannot be undone.'
      )
    ) {
      return;
    }
    setIsAbandoning(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/runs/${activeRunConflict.runId}/abandon`,
        { method: 'POST' }
      );
      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to abandon run');
      }
      setActiveRunConflict(null);
    } catch (error) {
      console.error('Error abandoning run:', error);
      setSubmitError('Failed to abandon run. Please try again.');
    } finally {
      setIsAbandoning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);
    setRunId(null);
    setActiveRunConflict(null);

    try {
      // Step 1: server-side run start — records startedAt, enforces one
      // active run per user per challenge (SPE-119). 401 = unauthenticated.
      const startResponse = await fetch('/api/runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });

      if (startResponse.status === 401) {
        router.push('/auth/signin');
        return;
      }

      if (startResponse.status === 409) {
        // Active run exists (SPE-119). For an in_progress run the UI offers
        // the abandon path (SPE-128); submitted/verifying runs belong to the
        // verification pipeline and cannot be abandoned.
        const conflict = await startResponse.json();
        setActiveRunConflict({
          runId: conflict.runId,
          status: conflict.status,
        });
        setIsSubmitting(false);
        return;
      }

      if (!startResponse.ok) {
        throw new Error('Failed to start run');
      }

      const startedRun = await startResponse.json();
      setRunId(startedRun.id);

      // Step 2: server-side submit — computes elapsedMs from DB timestamps,
      // transitions to `submitted`, queues verification.
      const submitResponse = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: startedRun.id, solutionUrl: submittedUrl }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit run');
      }

      setSubmitSuccess(true);
      setSubmittedUrl('');
    } catch (error) {
      console.error('Error submitting run:', error);
      setSubmitError('Failed to submit run. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'
    >
      <h2 className='mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100'>
        Submit Your Solution
      </h2>
      <p className='mb-6 text-gray-600 dark:text-gray-400'>
        Share the URL where your solution is hosted (Vercel, Netlify, etc.)
      </p>

      {activeRunConflict && (
        <div className='mb-4 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-4 py-3 rounded-md'>
          {activeRunConflict.status === 'in_progress' ? (
            <>
              <p className='text-sm text-gray-900 dark:text-gray-100'>
                You have a run in progress for this challenge. The clock has
                been running server-side since it started — it stays active
                until you submit or abandon it.
              </p>
              <button
                type='button'
                onClick={handleAbandon}
                disabled={isAbandoning}
                className='mt-2 text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50'
              >
                {isAbandoning ? 'Abandoning...' : 'Abandon run'}
              </button>
            </>
          ) : (
            <p className='text-sm text-gray-900 dark:text-gray-100'>
              Your previous submission ({activeRunConflict.status}) is still in
              verification. You can start a new attempt once it finishes.
            </p>
          )}
        </div>
      )}

      {submitError && (
        <div className='mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md'>
          {submitError}
        </div>
      )}

      {submitSuccess && runId && (
        <div className='mb-4 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md'>
          Submission successful! Verification is in progress.
        </div>
      )}

      {runId && (
        <div className='mb-4 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-4 py-3 rounded-md'>
          <div className='flex items-center space-x-3'>
            <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              Verification Status:
            </span>
            {verificationLoading && (
              <span className='text-xs text-indigo-500 dark:text-indigo-400 animate-pulse'>
                Verifying...
              </span>
            )}
            {runStatus && (
              <>
                {runStatus.status === 'verified' && (
                  <span className='text-xs text-green-600 dark:text-green-400'>
                    Verified!{' '}
                    {runStatus.elapsedMs !== null
                      ? `${(runStatus.elapsedMs / 1000).toFixed(2)}s`
                      : ''}
                  </span>
                )}
                {runStatus.status === 'failed' && (
                  <span className='text-xs text-red-600 dark:text-red-400'>
                    Failed{runStatus.failureReason ? `: ${runStatus.failureReason}` : ''}
                  </span>
                )}
                {runStatus.status === 'verifying' && (
                  <span className='text-xs text-yellow-600 dark:text-yellow-400'>
                    Verifying...
                  </span>
                )}
                {runStatus.status === 'submitted' && (
                  <span className='text-xs text-gray-600 dark:text-gray-400'>
                    Submitted, waiting for verification to start...
                  </span>
                )}
              </>
            )}
            {verificationError && (
              <span className='text-xs text-red-600 dark:text-red-400 ml-2'>
                Error: {verificationError}
              </span>
            )}
          </div>
        </div>
      )}

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
      <button
        type='submit'
        disabled={isSubmitting}
        className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50'
      >
        {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
      </button>
    </form>
  );
}
