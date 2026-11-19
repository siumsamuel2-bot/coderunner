import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { fetchHtml } from '../../core/http.ts';
import { findButton, findTextInput, pageText } from '../../core/ui.ts';

/**
 * Array Mastery challenge verifier.
 *
 * Contract (see specs/array-mastery.md): a TypeScript "array playground" with a
 * number-list text input and buttons for sort asc/desc, filter even/odd,
 * double (map), sum (reduce) and dedupe; clicking an operation appends the
 * resulting sequence to the page's visible text. All inputs are randomized
 * seeded arrays.
 */

interface OpDef {
  readonly id: string;
  readonly patterns: readonly RegExp[];
}

const OPS: readonly OpDef[] = [
  { id: 'sortAsc', patterns: [/sort[^\n]*asc|asc[^\n]*sort|^asc/i] },
  { id: 'sortDesc', patterns: [/sort[^\n]*desc|desc[^\n]*sort|^desc/i] },
  { id: 'filterEven', patterns: [/^filter[^\n]*even|even/i] },
  { id: 'filterOdd', patterns: [/^filter[^\n]*odd|odd/i] },
  { id: 'double', patterns: [/doubl|twice|[x*]\s*2\b/i] },
  { id: 'sum', patterns: [/^(sum|total|reduce)$/i, /sum|total/i] },
  { id: 'dedupe', patterns: [/dedup|unique|distinct|remove[^\n]*dup|no[^\n]*dup/i] }
];

const OP_LABELS: Record<string, string> = {
  sortAsc: 'Sort ascending',
  sortDesc: 'Sort descending',
  filterEven: 'Filter even',
  filterOdd: 'Filter odd',
  double: 'Double values',
  sum: 'Sum / reduce',
  dedupe: 'Deduplicate'
};

interface ArrayState {
  page: Page | null;
  input: Locator | null;
  buttons: Partial<Record<string, Locator>>;
}

/** Builds a regex matching the number sequence in order, any separators. */
function sequenceRegex(nums: readonly number[]): RegExp {
  const parts = nums.map((n) => {
    const abs = String(Math.abs(n));
    return n < 0 ? `\\b-?${abs}\\b` : `\\b${abs}\\b`;
  });
  return new RegExp(parts.join('[\\D]+'));
}

/** True when the text contains the sequence in order with arbitrary separators. */
function textContainsSequence(text: string, nums: readonly number[]): boolean {
  if (nums.length === 0) {
    return false;
  }
  return sequenceRegex(nums).test(text.replace(/,/g, ' ').replace(/\n/g, ' '));
}

/** Text added to the page between a snapshot and now (line-set diff). */
async function newTextSince(page: Page, base: string): Promise<string> {
  const baseLines = new Set(
    base.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  );
  const now = await pageText(page);
  const additions = now
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !baseLines.has(l));
  return additions.join('\n');
}

export const arrayMasteryVerifier: ChallengeVerifier = {
  meta: {
    id: 'array-mastery',
    name: 'Array Mastery',
    description:
      'TypeScript array playground: sort / filter / map / reduce / dedupe on a user-supplied list (SPE-108)',
    specPath: 'specs/array-mastery.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: ArrayState = { page: null, input: null, buttons: {} };

    async function openPage(): Promise<Page> {
      const page = await ctx.session.newPage();
      const response = await page.goto(ctx.targetUrl, {
        waitUntil: 'domcontentloaded'
      });
      if (response === null || response.status() >= 400) {
        throw new CheckFailed(
          `Target returned HTTP ${response === null ? 'unknown' : response.status()}`
        );
      }
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      state.page = page;
      return page;
    }

    /** Fresh random number list, set into the input. */
    async function fillRandomList(size = ctx.rand.int(8, 14)): Promise<number[]> {
      const page = state.page;
      const input = state.input;
      if (page === null || input === null) {
        throw new CheckFailed('Missing page or input (earlier checks must pass first)');
      }
      const nums = Array.from({ length: size }, () => ctx.rand.int(-50, 50));
      await input.click();
      await input.selectText().catch(() => undefined);
      await page.keyboard.press('Delete').catch(() => undefined);
      await input.fill(nums.join(', '));
      return nums;
    }

    /** Click an operation and return the newly added page text. */
    async function runOp(opId: string): Promise<string> {
      const page = state.page;
      const button = state.buttons[opId];
      if (page === null || button === undefined) {
        throw new CheckFailed(`Missing page or button for op "${opId}"`);
      }
      const before = await pageText(page);
      await button.click();
      await page.waitForTimeout(400);
      return await newTextSince(page, before);
    }

    return [
      {
        id: 'arr-page-loads',
        name: 'Page loads (HTTP < 400, HTML served)',
        severity: 'required',
        run: async () => {
          const trace = await fetchHtml(ctx.targetUrl);
          await ctx.evidence.saveJson('01-http-trace.json', trace);
          const page = await openPage();
          await ctx.session.screenshot(page, '01-loaded.png');
        }
      },
      {
        id: 'arr-input-present',
        name: 'A visible, editable list input is present',
        severity: 'required',
        requires: ['arr-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input = await findTextInput(page, {
            prefer: /array|number|list|value|input/i,
            kind: 'any'
          });
          if (input === null) {
            await ctx.session.screenshot(page, '02-no-input.png');
            throw new CheckFailed(
              'No visible editable text input/textarea found for the number list'
            );
          }
          state.input = input;
        }
      },
      {
        id: 'arr-controls-present',
        name: 'All seven operation buttons are discoverable',
        severity: 'required',
        requires: ['arr-input-present'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const missing: string[] = [];
          for (const op of OPS) {
            let found: Locator | null = null;
            for (const pattern of op.patterns) {
              found = await findButton(page, pattern);
              if (found !== null) {
                break;
              }
            }
            if (found === null) {
              missing.push(OP_LABELS[op.id] ?? op.id);
            } else {
              state.buttons[op.id] = found;
            }
          }
          if (missing.length > 0) {
            await ctx.session.screenshot(page, '03-missing-buttons.png');
            throw new CheckFailed(`Missing operation buttons: ${missing.join(', ')}`);
          }
        }
      },
      {
        id: 'arr-sort-asc',
        name: 'Sort ascending produces values in ascending order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          const out = await runOp('sortAsc');
          const expected = [...nums].sort((a, b) => a - b);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Sort asc: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-sort-desc',
        name: 'Sort descending produces values in descending order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          const out = await runOp('sortDesc');
          const expected = [...nums].sort((a, b) => b - a);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Sort desc: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-filter-even',
        name: 'Filter even yields only even values in input order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          // Guarantee at least one even and one odd value.
          nums[0] = ctx.rand.int(0, 25) * 2;
          nums[1] = ctx.rand.int(0, 25) * 2 + 1;
          const out = await runOp('filterEven');
          const expected = nums.filter((n) => n % 2 === 0);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Filter even: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-filter-odd',
        name: 'Filter odd yields only odd values in input order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          nums[0] = ctx.rand.int(0, 25) * 2 + 1;
          nums[1] = ctx.rand.int(0, 25) * 2;
          const out = await runOp('filterOdd');
          const expected = nums.filter((n) => n % 2 !== 0);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Filter odd: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-map-double',
        name: 'Double (map) yields every value multiplied by 2, in order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          const out = await runOp('double');
          const expected = nums.map((n) => n * 2);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Double: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-reduce-sum',
        name: 'Sum (reduce) yields the correct total',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          const out = await runOp('sum');
          const expected = nums.reduce((a, b) => a + b, 0);
          const re = expected < 0
            ? new RegExp(`\\b-?${Math.abs(expected)}\\b`)
            : new RegExp(`\\b${expected}\\b`);
          if (!re.test(out)) {
            throw new CheckFailed(
              `Sum: expected ${expected}, new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-dedupe',
        name: 'Deduplicate yields first occurrences only, in input order',
        severity: 'required',
        requires: ['arr-controls-present'],
        run: async () => {
          const nums = await fillRandomList();
          // Guarantee duplicates: shrink the value space harder.
          const tight = nums.map((n) => ((Math.abs(n) % 4) as number));
          const page = state.page;
          const input = state.input;
          if (page === null || input === null) {
            throw new CheckFailed('Missing page or input');
          }
          await input.click();
          await input.selectText().catch(() => undefined);
          await page.keyboard.press('Delete').catch(() => undefined);
          await input.fill(tight.join(', '));
          const out = await runOp('dedupe');
          const expected = tight.filter((n, i) => tight.indexOf(n) === i);
          if (!textContainsSequence(out, expected)) {
            throw new CheckFailed(
              `Dedupe: expected [${expected.join(', ')}], new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'arr-empty-input',
        name: 'Empty input does not crash the page (bonus)',
        severity: 'bonus',
        requires: ['arr-controls-present'],
        run: async () => {
          const page = state.page;
          const input = state.input;
          if (page === null || input === null) {
            throw new CheckFailed('Missing page or input');
          }
          await input.click();
          await input.selectText().catch(() => undefined);
          await page.keyboard.press('Delete').catch(() => undefined);
          await input.fill('');
          await runOp('sum');
          await ctx.session.screenshot(page, '04-empty-input.png');
        }
      },
      {
        id: 'arr-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
