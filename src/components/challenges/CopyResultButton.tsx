'use client';

import { useState, useSyncExternalStore } from 'react';

import { formatDuration } from '@/lib/format';

// Clipboard capability never changes at runtime; an empty subscription
// makes this a stable hydration-safe read (server snapshot: unavailable).
const emptySubscribe = () => () => {};
const getClipboardSupported = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.writeText === 'function';
const getClipboardSupportedServer = () => false;

/**
 * Copy-result share button (SPE-127 §3.2). Verified runs only — the caller
 * decides that. Clipboard text is built from real backend values only.
 * Hidden entirely when the Clipboard API is unavailable (no degraded fake).
 */
export function CopyResultButton({
  challengeTitle,
  elapsedMs,
  rank,
}: {
  challengeTitle: string;
  elapsedMs: number;
  rank: number;
}) {
  const supported = useSyncExternalStore(
    emptySubscribe,
    getClipboardSupported,
    getClipboardSupportedServer
  );
  const [copied, setCopied] = useState(false);

  if (!supported) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Verified ✓ ${challengeTitle} in ${formatDuration(elapsedMs)} — ranked #${rank} on CodeRunner. Built with AI.`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write rejected (permissions) — stay silent, no fake success.
    }
  };

  return (
    <button
      type='button'
      onClick={handleCopy}
      className='flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
    >
      {copied ? 'Copied ✓' : 'Copy result'}
    </button>
  );
}
