/**
 * Seeded pseudo-random generator (mulberry32) with helpers for generating
 * reproducible test vectors. Same seed => same vectors => reproducible runs.
 */
export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    const s = seed >>> 0;
    this.seed = s;
    // Avoid the degenerate zero state.
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`rng.int: max (${max}) < min (${min})`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Picks a random element. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('rng.pick: empty list');
    }
    const idx = this.int(0, items.length - 1);
    return items[idx] as T;
  }

  /** Random decimal string with 2 fraction digits, e.g. "3.75". Binary-exact (multiple of 0.25). */
  decimal(min: number, max: number): string {
    const steps = Math.round((max - min) * 4);
    const value = min + this.int(0, steps) / 4;
    return value.toFixed(2);
  }

  /** Random digit string of the given length (first digit 1-9). */
  digits(length: number): string {
    let out = String(this.int(1, 9));
    for (let i = 1; i < length; i += 1) {
      out += String(this.int(0, 9));
    }
    return out;
  }

  /** Random identifier-safe token. */
  token(length: number): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[this.int(0, alphabet.length - 1)];
    }
    return out;
  }

  /** Random human-looking phrase used for todo/chat test vectors. */
  phrase(): string {
    const adjectives = [
      'fluent', 'brave', 'quiet', 'rapid', 'solar', 'lunar', 'amber',
      'crimson', 'vivid', 'sturdy', 'mellow', 'brisk'
    ];
    const nouns = [
      'otter', 'falcon', 'cascade', 'meadow', 'summit', 'harbor',
      'lantern', 'cinder', 'willow', 'comet', 'prairie', 'ridge'
    ];
    return `${this.pick(adjectives)} ${this.pick(nouns)} ${this.int(100, 999)}`;
  }

  /** Verification-scoped email address. */
  email(prefix: string): string {
    return `${prefix}-${this.token(8)}@runner-verification.test`;
  }

  /** Verification-scoped password. */
  password(): string {
    return `Vf-${this.token(10)}`;
  }
}

/** Generates a fresh random seed (used when the caller does not pin one). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
