'use client';

import { useState } from 'react';

export function ShareButton({ runId }: { runId: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/runs/${runId}/result` : '';

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — fall back to no-op
    }
  };

  return (
    <button
      onClick={handleCopy}
      className='px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
    >
      {copied ? 'Copied!' : 'Share result'}
    </button>
  );
}
