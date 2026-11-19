import { describe, expect, it } from 'vitest';

import {
  ACTIVE_RUN_STATUSES,
  RUN_STATUSES,
  canAbandon,
  nextAttemptNumber,
} from '@/lib/runs/lifecycle';

describe('run lifecycle (SPE-128)', () => {
  it('exposes the full status set including the new terminal `abandoned`', () => {
    expect(RUN_STATUSES).toContain('abandoned');
    expect(RUN_STATUSES).toContain('in_progress');
  });

  it('only allows abandoning an in_progress run', () => {
    expect(canAbandon('in_progress')).toBe(true);
    expect(canAbandon('submitted')).toBe(false);
    expect(canAbandon('verifying')).toBe(false);
    expect(canAbandon('verified')).toBe(false);
    expect(canAbandon('failed')).toBe(false);
    expect(canAbandon('abandoned')).toBe(false);
    expect(canAbandon('nonsense')).toBe(false);
  });

  it('abandoned runs do not block a new start (not in ACTIVE_RUN_STATUSES)', () => {
    expect(ACTIVE_RUN_STATUSES).not.toContain('abandoned');
    expect(ACTIVE_RUN_STATUSES).toEqual(
      expect.arrayContaining(['in_progress', 'submitted', 'verifying'])
    );
  });

  it('abandoned runs consume an attempt slot (nextAttemptNumber counts them)', () => {
    // 3 prior runs for the user/challenge, one of them abandoned -> next is 4.
    expect(nextAttemptNumber(3)).toBe(4);
    expect(nextAttemptNumber(0)).toBe(1);
  });
});
