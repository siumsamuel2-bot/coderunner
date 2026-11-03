import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCheckManifest } from '@/lib/check-manifest';

/**
 * Pipeline regression: every verification spec must parse into a usable check
 * manifest, and the week-4 APIs spec plus the week-5 Rust track specs must
 * carry exactly the checks the harness enforces (SPE-158 / SPE-159). Guards
 * against spec/verifier drift.
 */
const SPECS_DIR = path.join(process.cwd(), 'verification', 'specs');

function manifestFor(slug: string) {
  const file = path.join(SPECS_DIR, `${slug}.md`);
  return parseCheckManifest(
    readFileSync(file, 'utf8'),
    `verification/specs/${slug}.md`
  );
}

function requiredIds(slug: string): string[] {
  return manifestFor(slug)
    .checks.filter((c) => c.severity === 'required')
    .map((c) => c.id);
}

function bonusIds(slug: string): string[] {
  return manifestFor(slug)
    .checks.filter((c) => c.severity === 'bonus')
    .map((c) => c.id);
}

describe('verification specs (pipeline regression)', () => {
  const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith('.md'));

  it('has a spec file for every shipped track including APIs and the Rust category', () => {
    expect(files.length).toBeGreaterThanOrEqual(13);
    expect(files).toContain('book-library-api.md');
    expect(files).toContain('rust-fizzbuzz-api.md');
    expect(files).toContain('rust-kv-store-api.md');
    expect(files).toContain('rust-text-stats-api.md');
  });

  it.each(files)('%s parses to required checks with unique slug-style ids', (file) => {
    const manifest = parseCheckManifest(
      readFileSync(path.join(SPECS_DIR, file), 'utf8'),
      `verification/specs/${file}`
    );
    expect(manifest.checks.length).toBeGreaterThan(0);
    const required = manifest.checks.filter((c) => c.severity === 'required');
    expect(required.length).toBeGreaterThan(0);
    const ids = manifest.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-zA-Z0-9-]+$/);
    }
  });
});

describe('book-library-api spec (SPE-158)', () => {
  it('lists the required API contract checks in order', () => {
    expect(requiredIds('book-library-api')).toEqual([
      'book-root-loads',
      'book-list-json-array',
      'book-create',
      'book-read-by-id',
      'book-appears-in-list',
      'book-delete',
      'book-validation',
    ]);
  });

  it('lists the bonus checks separately from the verdict', () => {
    expect(bonusIds('book-library-api')).toEqual([
      'book-json-content-type',
      'book-distinct-ids',
      'book-no-console-errors',
    ]);
  });
});

describe('Rust track specs (SPE-159 week-5)', () => {
  it('rust-fizzbuzz-api carries the required and bonus checks the harness runs', () => {
    expect(requiredIds('rust-fizzbuzz-api')).toEqual([
      'fb-root-loads',
      'fb-fizz',
      'fb-buzz',
      'fb-fizzbuzz',
      'fb-plain-number',
      'fb-validation',
    ]);
    expect(bonusIds('rust-fizzbuzz-api')).toEqual([
      'fb-json-content-type',
      'fb-distinct-results',
      'fb-no-console-errors',
    ]);
  });

  it('rust-kv-store-api carries the required and bonus checks the harness runs', () => {
    expect(requiredIds('rust-kv-store-api')).toEqual([
      'kv-root-loads',
      'kv-put-creates',
      'kv-get-reads',
      'kv-get-unknown-404',
      'kv-list-contains',
      'kv-put-overwrites',
      'kv-delete-removes',
      'kv-validation',
    ]);
    expect(bonusIds('rust-kv-store-api')).toEqual([
      'kv-json-content-type',
      'kv-list-excludes-deleted',
      'kv-no-console-errors',
    ]);
  });

  it('rust-text-stats-api carries the required and bonus checks the harness runs', () => {
    expect(requiredIds('rust-text-stats-api')).toEqual([
      'stats-root-loads',
      'stats-post-counts',
      'stats-single-word',
      'stats-empty-text',
      'stats-validation',
    ]);
    expect(bonusIds('rust-text-stats-api')).toEqual([
      'stats-json-content-type',
      'stats-no-console-errors',
    ]);
  });
});

describe('seed <-> harness registry parity (SPE-159)', () => {
  /**
   * The verification worker resolves a challenge's verifier by its slug
   * (`verification/src/registry.ts`), so every challenge seeded in
   * `prisma/seed.ts` MUST have a registered verifier - otherwise verification
   * silently fails to find a check suite. This guards the new Rust track and
   * any future content drop without importing the Playwright harness.
   */
  it('every seeded challenge slug has a registered harness verifier', () => {
    const seed = readFileSync(
      path.join(process.cwd(), 'prisma', 'seed.ts'),
      'utf8'
    );
    const registry = readFileSync(
      path.join(process.cwd(), 'verification', 'src', 'registry.ts'),
      'utf8'
    );
    const slugs = [...seed.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
    const registered = new Set(
      [...registry.matchAll(/'([a-z0-9-]+)':\s*[A-Za-z]/g)].map((m) => m[1])
    );

    expect(slugs.length).toBeGreaterThanOrEqual(13);
    for (const slug of slugs) {
      expect(registered.has(slug)).toBe(true);
    }
  });
});
