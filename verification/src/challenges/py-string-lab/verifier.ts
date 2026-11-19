import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { fetchHtml } from '../../core/http.ts';
import { findButton, findTextInput, pageText } from '../../core/ui.ts';

/**
 * Python String Lab challenge verifier (SPE-109, week-2 Python track).
 *
 * Contract (see specs/py-string-lab.md): a text input plus buttons for
 * reverse, uppercase, lowercase, word count and palindrome; clicking an
 * operation appends the result to the page's visible text. All inputs are
 * randomized seeded strings. The harness never executes contestant code — it
 * only drives the live UI, so any Python web stack (Flask, FastAPI, Django)
 * satisfies the challenge as long as the contract holds.
 */

interface OpDef {
  readonly id: string;
  readonly patterns: readonly RegExp[];
}

const OPS: readonly OpDef[] = [
  { id: 'reverse', patterns: [/revers|backward|mirror|flip/i] },
  { id: 'upper', patterns: [/upper\s*case|toupper|^upper$|all\s*caps|shout/i] },
  { id: 'lower', patterns: [/lower\s*case|tolower|^lower$|small\s*letters/i] },
  { id: 'wordCount', patterns: [/count[^\n]*word|word[^\n]*count|^words?$|how many words/i] },
  { id: 'palindrome', patterns: [/palindrom/i] }
];

const OP_LABELS: Record<string, string> = {
  reverse: 'Reverse',
  upper: 'Uppercase',
  lower: 'Lowercase',
  wordCount: 'Word count',
  palindrome: 'Palindrome check'
};

interface LabState {
  page: Page | null;
  input: Locator | null;
  buttons: Partial<Record<string, Locator>>;
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

export const pyStringLabVerifier: ChallengeVerifier = {
  meta: {
    id: 'py-string-lab',
    name: 'Python String Lab',
    description:
      'Python-backed string playground: reverse / upper / lower / word count / palindrome on user-supplied text (SPE-109)',
    specPath: 'specs/py-string-lab.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: LabState = { page: null, input: null, buttons: {} };

    const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

    function randomWord(minLen = 4, maxLen = 10): string {
      const len = ctx.rand.int(minLen, maxLen);
      let out = '';
      for (let i = 0; i < len; i += 1) {
        out += LETTERS[ctx.rand.int(0, LETTERS.length - 1)];
      }
      return out;
    }

    /** Random word with at least one upper- and one lowercase letter. */
    function mixedCaseWord(): string {
      const base = randomWord(5, 9).split('');
      base[0] = base[0]!.toUpperCase();
      return base.join('');
    }

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

    /** Replace the input contents with the given text. */
    async function fillText(value: string): Promise<void> {
      const page = state.page;
      const input = state.input;
      if (page === null || input === null) {
        throw new CheckFailed('Missing page or input (earlier checks must pass first)');
      }
      await input.click();
      await input.selectText().catch(() => undefined);
      await page.keyboard.press('Delete').catch(() => undefined);
      await input.fill(value);
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
        id: 'str-page-loads',
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
        id: 'str-input-present',
        name: 'A visible, editable text input is present',
        severity: 'required',
        requires: ['str-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input = await findTextInput(page, {
            prefer: /string|text|phrase|sentence|word|input/i,
            kind: 'any'
          });
          if (input === null) {
            await ctx.session.screenshot(page, '02-no-input.png');
            throw new CheckFailed('No visible editable text input/textarea found');
          }
          state.input = input;
        }
      },
      {
        id: 'str-controls-present',
        name: 'All five operation buttons are discoverable',
        severity: 'required',
        requires: ['str-input-present'],
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
        id: 'str-reverse',
        name: 'Reverse produces the input string backwards',
        severity: 'required',
        requires: ['str-controls-present'],
        run: async () => {
          const word = randomWord();
          await fillText(word);
          const out = await runOp('reverse');
          const expected = word.split('').reverse().join('');
          if (!out.toLowerCase().includes(expected)) {
            throw new CheckFailed(
              `Reverse: expected "${expected}", new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'str-uppercase',
        name: 'Uppercase produces the input in ALL CAPS',
        severity: 'required',
        requires: ['str-controls-present'],
        run: async () => {
          const word = mixedCaseWord();
          await fillText(word);
          const out = await runOp('upper');
          const expected = word.toUpperCase();
          if (!out.includes(expected)) {
            throw new CheckFailed(
              `Uppercase: expected "${expected}", new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'str-lowercase',
        name: 'Lowercase produces the input in all lowercase',
        severity: 'required',
        requires: ['str-controls-present'],
        run: async () => {
          const word = mixedCaseWord();
          await fillText(word);
          const out = await runOp('lower');
          const expected = word.toLowerCase();
          if (!out.toLowerCase().includes(expected)) {
            throw new CheckFailed(
              `Lowercase: expected "${expected}", new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'str-word-count',
        name: 'Word count prints the number of words',
        severity: 'required',
        requires: ['str-controls-present'],
        run: async () => {
          const count = ctx.rand.int(2, 6);
          const phrase = Array.from({ length: count }, () => randomWord(3, 7)).join(' ');
          await fillText(phrase);
          const out = await runOp('wordCount');
          if (!new RegExp(`\\b${count}\\b`).test(out)) {
            throw new CheckFailed(
              `Word count: expected ${count}, new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'str-palindrome',
        name: 'Palindrome check reports a positive verdict for a palindrome',
        severity: 'required',
        requires: ['str-controls-present'],
        run: async () => {
          const half = randomWord(3, 5);
          const palindrome = half + half.split('').reverse().join('');
          await fillText(palindrome);
          const out = await runOp('palindrome');
          if (!/yes|true|palindrome|✓|\bis\b/i.test(out)) {
            throw new CheckFailed(
              `Palindrome: expected a positive verdict for "${palindrome}", new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'str-empty-input',
        name: 'Empty input does not crash the page (bonus)',
        severity: 'bonus',
        requires: ['str-controls-present'],
        run: async () => {
          await fillText('');
          await runOp('reverse');
          const page = state.page;
          if (page !== null) {
            await ctx.session.screenshot(page, '04-empty-input.png');
          }
        }
      },
      {
        id: 'str-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
