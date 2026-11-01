import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCheckManifest } from '@/lib/check-manifest';

/**
 * Pipeline regression: every verification spec must parse into a usable check
 * manifest, and the week-4 APIs spec must carry exactly the checks the harness
 * enforces (SPE-158). Guards against spec/verifier drift.
 */
const SPECS_DIR = path.join(process.cwd(), 'verification', 'specs');

function manifestFor(slug: string) {
  const file = path.join(SPECS_DIR, `${slug}.md`);
  return parseCheckManifest(
    readFileSync(file, 'utf8'),
    `verification/specs/${slug}.md`
  );
}

describe('verification specs (pipeline regression)', () => {
  const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith('.md'));

  it('has a spec file for every shipped track including the APIs category', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files).toContain('book-library-api.md');
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
    const manifest = manifestFor('book-library-api');
    const required = manifest.checks
      .filter((c) => c.severity === 'required')
      .map((c) => c.id);
    expect(required).toEqual([
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
    const manifest = manifestFor('book-library-api');
    const bonus = manifest.checks
      .filter((c) => c.severity === 'bonus')
      .map((c) => c.id);
    expect(bonus).toEqual([
      'book-json-content-type',
      'book-distinct-ids',
      'book-no-console-errors',
    ]);
  });
});
