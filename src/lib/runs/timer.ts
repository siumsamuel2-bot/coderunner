/**
 * Run timer helpers (SPE-133, from the SPE-127 spec §1.4).
 *
 * The timer is server-anchored: it derives from the DB `startedAt`
 * returned by the run API — never from a client-side start timestamp.
 * Mode is `elapsed` (count-up) only: with no enforced `timeLimitMinutes`,
 * a countdown would imply a hard limit that does not exist (honesty
 * rule: never show a countdown before the backend enforces expiry).
 */

import { formatDuration } from '@/lib/format';

/** Elapsed display label, clamped at 0:00 for clock skew (startedAt in future). */
export function elapsedLabel(startedAtMs: number, nowMs: number): string {
  return formatDuration(Math.max(0, nowMs - startedAtMs));
}

/** Document title while a run is active, so the clock survives tab switches. */
export function activeRunDocumentTitle(label: string, challengeTitle: string): string {
  return `⏱ ${label} · ${challengeTitle}`;
}

/** Compact UTC start-time label for the active-run card (SPE-127 §1.3). */
export function startedAtLabel(startedAtIso: string): string {
  const date = new Date(startedAtIso);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
  return `${time} UTC`;
}
