import { describe, expect, it } from 'vitest';

import { activeRunDocumentTitle, elapsedLabel } from '@/lib/runs/timer';

describe('run timer (SPE-133, server-anchored elapsed mode)', () => {
  it('counts up from the server startedAt anchor', () => {
    const startedAt = 1_000_000;
    expect(elapsedLabel(startedAt, startedAt + 0)).toBe('0:00');
    expect(elapsedLabel(startedAt, startedAt + 42_300)).toBe('0:42');
    expect(elapsedLabel(startedAt, startedAt + 754_000)).toBe('12:34');
    expect(elapsedLabel(startedAt, startedAt + 3_600_000)).toBe('1:00:00');
  });

  it('clamps at 0:00 when startedAt is in the future (client clock skew)', () => {
    expect(elapsedLabel(2_000_000, 1_000_000)).toBe('0:00');
  });

  it('builds the document title so the clock survives tab switching', () => {
    expect(activeRunDocumentTitle('12:34', 'Calculator')).toBe(
      '⏱ 12:34 · Calculator'
    );
  });
});
