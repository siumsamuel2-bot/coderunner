'use client';

import { useEffect, useState } from 'react';

import { activeRunDocumentTitle, elapsedLabel } from '@/lib/runs/timer';

/**
 * Server-anchored elapsed timer (SPE-133, SPE-127 §1.4).
 *
 * The anchor is the DB `startedAt` — the display is informational; the
 * authoritative number is the server-computed `elapsedMs` at submit.
 * Ticks pause while the tab is hidden and recompute from the anchor on
 * return (visibilitychange), so the label is always consistent with the
 * anchor. Tabular numbers keep digits from jittering.
 */
export function RunTimer({
  startedAtMs,
  challengeTitle,
}: {
  startedAtMs: number;
  challengeTitle: string;
}) {
  const [label, setLabel] = useState(() => elapsedLabel(startedAtMs, Date.now()));

  useEffect(() => {
    const update = () => setLabel(elapsedLabel(startedAtMs, Date.now()));
    update();

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval === null) {
        update();
        interval = setInterval(update, 1000);
      }
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [startedAtMs]);

  // The clock survives tab switching via the document title.
  useEffect(() => {
    const previous = document.title;
    document.title = activeRunDocumentTitle(label, challengeTitle);
    return () => {
      document.title = previous;
    };
  }, [label, challengeTitle]);

  return (
    <span
      aria-label='Elapsed time'
      className='font-mono text-lg font-semibold text-gray-900 dark:text-gray-100'
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {label}
    </span>
  );
}
