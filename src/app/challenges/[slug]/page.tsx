
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { useState } from 'react';
import { auth } from '@/auth';
import { useVerificationUpdates } from '@/lib/verification/sse-hook';

export const dynamic = 'force-dynamic';

export default async function ChallengeDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const challenge = await prisma.challenge.findUniqueOrThrow({
    where: { slug: params.slug },
  });

  const [submittedUrl, setSubmittedUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
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
      const session = await auth();
      
      if (!session?.user?.id) {
        // Redirect to sign in if not authenticated
        window.location.href = '/auth/signin';
        return;
      }

      // Submit the run to our API
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          challengeId: challenge.id,
          solutionUrl: submittedUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit run');
      }

      const runData = await response.json();
      
      // Store the run ID for verification tracking
      setRunId(runData.id);
      
      // Trigger verification
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId: runData.id,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to start verification');
      }

      setSubmitSuccess(true);
      setSubmittedUrl(''); // Clear the form
    } catch (error) {
      console.error('Error submitting run:', error);
      setSubmitError('Failed to submit run. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <Link
            href='/challenges'
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to challenges</span>
          </Link>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            {challenge.title}
          </h1>
        </div>
        
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>
            {challenge.description}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Difficulty
              </p>
              <p className='text-base font-semibold'>
                {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-1'>
                Estimated Time
              </p>
              <p className='text-base font-semibold'>
                {challenge.estimatedMinutes} minutes
              </p>
            </div>
          </div>
          <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'>
              Acceptance Criteria
            </p>
            <p className='text-gray-700 dark:text-gray-300'>
              {challenge.acceptanceCriteria}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
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
          
          {runId && !submitSuccess && (
            <div className='mb-4 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 px-4 py-3 rounded-md'>
              <div className='flex items-center space-x-3'>
                <div className='flex items-center space-x-2'>
                  <svg className='w-5 h-5 text-indigo-500 dark:text-indigo-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M4 7v10c0 2.21 1.79 4 4 4h4c2.21 0 4-1.79 4-4V7' />
                  </svg>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                    Verification Status:
                  </span>
                </div>
                {verificationLoading && (
                  <span className='text-xs text-indigo-500 dark:text-indigo-400 animate-pulse'>
                    Verifying...
                  </span>
                )}
                        Verified! {runStatus.elapsedMs ? $({{(runStatus.elapsedMs as number) / 1000).toFixed(2)}s) : ''}
                  <>
                    {runStatus.status === 'verified' && (
                      <span className='text-xs text-green-600 dark:text-green-400'>
                        Verified! {runStatus.elapsedMs ? $({{(runStatus.elapsedMs as number) / 1000).toFixed(2)}s) : ''}
                      </span>
                    )}
                    {runStatus.status === 'failed' && (
                      <span className='text-xs text-red-600 dark:text-red-400'>
                        Failed
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
              className={w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 }
              placeholder='https://your-solution.vercel.app'
            />
          </div>
          <button
            type='submit'
            disabled={isSubmitting}
            className={w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 }
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}

