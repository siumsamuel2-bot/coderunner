import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rand.ts';

describe('Rng (seeded test vectors)', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.int(0, 1000));
    const seqB = Array.from({ length: 20 }, () => b.int(0, 1000));
    expect(seqA).not.toEqual(seqB);
  });

  it('handles the zero seed without degenerating', () => {
    const rng = new Rng(0);
    const values = Array.from({ length: 10 }, () => rng.next());
    expect(values.some((v) => v !== values[0])).toBe(true);
  });

  it('stays within [0,1) and respects int bounds', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const int = rng.int(3, 7);
      expect(int).toBeGreaterThanOrEqual(3);
      expect(int).toBeLessThanOrEqual(7);
    }
  });

  it('throws on inverted int bounds and empty pick', () => {
    const rng = new Rng(7);
    expect(() => rng.int(5, 1)).toThrow();
    expect(() => rng.pick([])).toThrow();
  });

  it('generates binary-exact decimals (multiples of 0.25)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 50; i += 1) {
      const value = Number(rng.decimal(1, 9));
      expect(value * 4).toBe(Math.round(value * 4));
    }
  });

  it('generates well-formed emails, passwords and phrases', () => {
    const rng = new Rng(3);
    const email = rng.email('runner-a');
    expect(email).toMatch(/^runner-a-[a-z0-9]{8}@runner-verification\.test$/);
    expect(rng.password()).toMatch(/^Vf-[a-z0-9]{10}$/);
    expect(rng.phrase()).toMatch(/^[a-z]+ [a-z]+ \d{3}$/);
    expect(rng.digits(3)).toMatch(/^[1-9][0-9]{2}$/);
  });
});
