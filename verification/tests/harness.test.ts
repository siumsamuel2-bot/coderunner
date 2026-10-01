import { describe, expect, it } from 'vitest';
import { runChecks } from '../src/core/harness.ts';
import { CheckFailed } from '../src/core/types.ts';
import type { Check } from '../src/core/types.ts';

describe('runChecks', () => {
  it('runs checks in order and records pass results', async () => {
    const order: string[] = [];
    const checks: Check[] = [
      {
        id: 'a',
        name: 'A',
        severity: 'required',
        run: async () => {
          order.push('a');
        }
      },
      {
        id: 'b',
        name: 'B',
        severity: 'required',
        run: async () => {
          order.push('b');
        }
      }
    ];
    const results = await runChecks(checks);
    expect(order).toEqual(['a', 'b']);
    expect(results.map((r) => r.status)).toEqual(['pass', 'pass']);
    expect(results[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures CheckFailed messages and evidence', async () => {
    const results = await runChecks([
      {
        id: 'a',
        name: 'A',
        severity: 'required',
        run: async () => {
          throw new CheckFailed('boom', ['01-shot.png']);
        }
      }
    ]);
    expect(results[0]?.status).toBe('fail');
    expect(results[0]?.error).toBe('CheckFailed: boom');
    expect(results[0]?.evidence).toEqual(['01-shot.png']);
  });

  it('captures non-CheckFailed errors with their name', async () => {
    const results = await runChecks([
      {
        id: 'a',
        name: 'A',
        severity: 'bonus',
        run: async () => {
          throw new Error('plain');
        }
      }
    ]);
    expect(results[0]?.status).toBe('fail');
    expect(results[0]?.error).toBe('Error: plain');
    expect(results[0]?.evidence).toEqual([]);
  });

  it('skips checks whose required dependency failed', async () => {
    const executed: string[] = [];
    const checks: Check[] = [
      {
        id: 'a',
        name: 'A',
        severity: 'required',
        run: async () => {
          executed.push('a');
          throw new CheckFailed('a failed');
        }
      },
      {
        id: 'b',
        name: 'B',
        severity: 'required',
        requires: ['a'],
        run: async () => {
          executed.push('b');
        }
      },
      {
        id: 'c',
        name: 'C',
        severity: 'required',
        requires: ['b'],
        run: async () => {
          executed.push('c');
        }
      },
      {
        id: 'd',
        name: 'D',
        severity: 'bonus',
        run: async () => {
          executed.push('d');
        }
      }
    ];
    const results = await runChecks(checks);
    expect(executed).toEqual(['a', 'd']);
    expect(results.map((r) => r.status)).toEqual(['fail', 'skip', 'skip', 'pass']);
    expect(results[1]?.error).toContain('requires [a]');
  });

  it('runs a dependent check when the dependency passed', async () => {
    const results = await runChecks([
      {
        id: 'a',
        name: 'A',
        severity: 'required',
        run: async () => undefined
      },
      {
        id: 'b',
        name: 'B',
        severity: 'required',
        requires: ['a'],
        run: async () => undefined
      }
    ]);
    expect(results.map((r) => r.status)).toEqual(['pass', 'pass']);
  });

  it('keeps running after a failure (full evidence, no bail-out)', async () => {
    const executed: string[] = [];
    const results = await runChecks([
      {
        id: 'a',
        name: 'A',
        severity: 'required',
        run: async () => {
          executed.push('a');
          throw new CheckFailed('nope');
        }
      },
      {
        id: 'b',
        name: 'B',
        severity: 'required',
        run: async () => {
          executed.push('b');
        }
      }
    ]);
    expect(executed).toEqual(['a', 'b']);
    expect(results[1]?.status).toBe('pass');
  });
});
