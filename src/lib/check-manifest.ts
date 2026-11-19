/**
 * Check-manifest parsing (SPE-132, dep D5 from the SPE-127 spec §4.3).
 *
 * Parses the check tables from `verification/specs/<slug>.md` into a
 * JSON-serializable manifest so the challenge page can render the exact
 * checks the verification harness runs — same ids the results page shows.
 *
 * Spec table format (both sections optional, ids in backticks):
 *
 *   ## Required checks
 *   | id | passes when |
 *   |---|---|
 *   | `calc-add` | Random `a + b` (ints 1-99) shows `a+b` |
 *
 *   ## Bonus checks (do not affect the verdict)
 *   | id | passes when |
 *   | `calc-keyboard` | Typing `1+2` yields `3` |
 */

export type CheckSeverity = 'required' | 'bonus';

export interface ManifestCheck {
  id: string;
  severity: CheckSeverity;
  passesWhen: string;
}

export interface CheckManifest {
  checks: ManifestCheck[];
  source: string;
}

const SECTION_PATTERNS: { pattern: RegExp; severity: CheckSeverity }[] = [
  { pattern: /^##\s+Required checks.*$/i, severity: 'required' },
  { pattern: /^##\s+Bonus checks.*$/i, severity: 'bonus' },
];

function parseTableRows(lines: string[]): { id: string; passesWhen: string }[] {
  const rows: { id: string; passesWhen: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    // Skip header + separator rows.
    if (/^:?-{2,}:?$/.test(cells[0]) || /^id$/i.test(cells[0])) continue;
    const id = cells[0].replace(/`/g, '');
    if (!id) continue;
    rows.push({ id, passesWhen: cells[1] });
  }
  return rows;
}

/** Parse one verification spec's markdown content into a manifest. */
export function parseCheckManifest(
  content: string,
  source: string
): CheckManifest {
  const lines = content.split(/\r?\n/);
  const checks: ManifestCheck[] = [];

  let currentSeverity: CheckSeverity | null = null;
  let sectionLines: string[] = [];

  const flushSection = () => {
    if (currentSeverity === null) return;
    for (const { id, passesWhen } of parseTableRows(sectionLines)) {
      checks.push({ id, severity: currentSeverity, passesWhen });
    }
    sectionLines = [];
  };

  for (const line of lines) {
    const section = SECTION_PATTERNS.find((s) => s.pattern.test(line));
    if (section) {
      flushSection();
      currentSeverity = section.severity;
      continue;
    }
    if (currentSeverity !== null) {
      if (/^##\s/.test(line)) {
        // A different section started — flush.
        flushSection();
        currentSeverity = null;
      } else {
        sectionLines.push(line);
      }
    }
  }
  flushSection();

  return { checks, source };
}
