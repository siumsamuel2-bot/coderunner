'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useVerificationUpdates } from '@/lib/verification/sse-hook';

/**
 * Live status for an in-flight run (SPE-127 §3.2): mirrors the SSE pill on
 * the results page and soft-refreshes the server components when a terminal
 * verdict lands, so the final verdict, checks, and rank appear without a
 * manual reload (regression guard for the SPE-105 Failed+Verifying bug).
 */
export function ResultStatusWatcher({ runId }: { runId: string }) {
  const router = useRouter();
  const { runStatus, loading, error } = useVerificationUpdates(runId);

  const status = runStatus?.status ?? null;

  useEffect(() => {
    if (status === 'verified' || status === 'failed') {
      router.refresh();
    }
  }, [status, router]);

  return (
    <span className='text-xs font-medium'>
      {loading && (
        <span className='text-blue-600 dark:text-blue-400 animate-pulse'>
          Connecting to live status...
        </span>
      )}
      {status === 'submitted' && (
        <span className='text-gray-600 dark:text-gray-400'>
          Submitted, waiting for verification to start...
        </span>
      )}
      {status === 'verifying' && (
        <span className='text-blue-600 dark:text-blue-400 animate-pulse'>
          Verifying your submission...
        </span>
      )}
      {status === 'verified' && (
        <span className='text-green-600 dark:text-green-400'>Verified ✓</span>
      )}
      {status === 'failed' && (
        <span className='text-red-600 dark:text-red-400'>Failed</span>
      )}
      {error && !status && (
        <span className='text-red-600 dark:text-red-400'>
          Live updates unavailable
        </span>
      )}
    </span>
  );
}
