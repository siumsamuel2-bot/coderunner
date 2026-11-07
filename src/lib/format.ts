/**
 * Shared formatting helpers (SPE-126/SPE-131).
 */

/**
 * Human duration for leaderboard/card display: `M:SS` under an hour,
 * `H:MM:SS` above. Sub-second runs keep one decimal (`0:42.3`).
 * Millisecond precision is carried in `title` attributes by callers.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = ms / 1000;
  if (totalSeconds < 1) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Capitalize a free-form label for display (`full-stack` -> `Full-stack`). */
export function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
