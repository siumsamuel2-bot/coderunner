import { describe, expect, it } from 'vitest';

import { capitalizeLabel, formatDuration } from '@/lib/format';

describe('formatDuration (SPE-131 card metrics)', () => {
  it('formats minutes:seconds under an hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(42_300)).toBe('0:42');
    expect(formatDuration(151_000)).toBe('2:31');
    expect(formatDuration(3_600_000 - 1)).toBe('59:59');
  });

  it('formats hours:minutes:seconds at or above an hour', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(4_098_000)).toBe('1:08:18');
  });

  it('keeps one decimal for sub-second runs', () => {
    expect(formatDuration(420)).toBe('0.4s');
    expect(formatDuration(999)).toBe('1.0s');
  });

  it('is defensive against invalid input', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('capitalizeLabel', () => {
  it('capitalizes category slugs for display', () => {
    expect(capitalizeLabel('full-stack')).toBe('Full-stack');
    expect(capitalizeLabel('ai')).toBe('Ai');
  });
});
