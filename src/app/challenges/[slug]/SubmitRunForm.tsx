'use client';

import { useState } from 'react';

import { useVerificationUpdates } from '@/lib/verification/sse-hook';

export function SubmitRunForm({
  challengeId,
  userId,
}: {
  challengeId: string;
  userId: string | null;
}) {
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const { runStatus, loading: verificationLoading, error: verificationError } =
    useVerificationUpdates(runId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);
    setRunId(null);

    try {
      if (!userId) {
        window.location.href = '/auth/signin';
        return;
      }

      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, challengeId, solutionUrl: submittedUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit run');
      }

      const runData = await response.json();
      setRunId(runData.id);

      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: runData.id }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to start verification');
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
                  <span className='text-xs text-red-600 dark:text-red-400'>Failed</span>
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
