import { describe, expect, it } from 'vitest';

import { parseCheckManifest } from '@/lib/check-manifest';

const CALCULATOR_SPEC = `# Verification spec: Calculator

## What "working" means
Some prose.

## The contract (discovery rules)
More prose.

## Required checks
| id | passes when |
|---|---|
| \`calc-page-loads\` | Target URL returns HTTP < 400 |
| \`calc-buttons-present\` | All 15 button classes above are discoverable |
| \`calc-add\` | Random \`a + b\` (ints 1-99) shows \`a+b\` |

## Bonus checks (do not affect the verdict)
| id | passes when |
|---|---|
| \`calc-keyboard\` | Typing \`1+2\` on the keyboard + \`Enter\` yields \`3\` |

## Result parsing
Prose after the tables.
`;

describe('parseCheckManifest (SPE-132, dep D5)', () => {
  it('parses required and bonus check tables with ids and descriptions', () => {
    const manifest = parseCheckManifest(
      CALCULATOR_SPEC,
      'verification/specs/calculator.md'
    );
    expect(manifest.source).toBe('verification/specs/calculator.md');
    expect(manifest.checks).toHaveLength(4);

    expect(manifest.checks[0]).toEqual({
      id: 'calc-page-loads',
      severity: 'required',
      passesWhen: 'Target URL returns HTTP < 400',
    });
    const bonus = manifest.checks.filter((c) => c.severity === 'bonus');
    expect(bonus).toEqual([
      {
        id: 'calc-keyboard',
        severity: 'bonus',
        passesWhen: 'Typing `1+2` on the keyboard + `Enter` yields `3`',
      },
    ]);
  });

  it('keeps prose sections out of the check list', () => {
    const manifest = parseCheckManifest(CALCULATOR_SPEC, 'x');
    const ids = manifest.checks.map((c) => c.id);
    expect(ids).not.toContain('working');
    // Every id looks like a kebab-case check id.
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('returns an empty manifest when no check sections exist', () => {
    const manifest = parseCheckManifest(
      '# Spec\n\nJust prose, no tables.\n',
      'x'
    );
    expect(manifest.checks).toEqual([]);
  });

  it('handles a required-only spec (no bonus section)', () => {
    const manifest = parseCheckManifest(
      '## Required checks\n| id | passes when |\n|---|---|\n| `only-one` | Passes |\n',
      'x'
    );
    expect(manifest.checks).toEqual([
      { id: 'only-one', severity: 'required', passesWhen: 'Passes' },
    ]);
  });
});
