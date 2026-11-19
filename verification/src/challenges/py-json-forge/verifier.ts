import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { fetchHtml } from '../../core/http.ts';
import { findButton, findTextInput, pageText } from '../../core/ui.ts';

/**
 * Python JSON Forge challenge verifier (SPE-109, week-2 Python track).
 *
 * Contract (see specs/py-json-forge.md): a textarea for JSON plus buttons for
 * prettify, minify and sort-keys; clicking an operation appends the result to
 * the page's visible text; invalid JSON must surface a friendly error message.
 * All inputs are randomized seeded JSON documents.
 */

interface OpDef {
  readonly id: string;
  readonly patterns: readonly RegExp[];
}

const OPS: readonly OpDef[] = [
  { id: 'prettify', patterns: [/prett|beautif|format|indent|pretty/i] },
  { id: 'minify', patterns: [/minif|compact|compress|strip/i] },
  { id: 'sortKeys', patterns: [/sort[^\n]*key|key[^\n]*sort|order[^\n]*key|a[^\n]*z/i] }
];

const OP_LABELS: Record<string, string> = {
  prettify: 'Prettify / format',
  minify: 'Minify / compact',
  sortKeys: 'Sort keys'
};

interface ForgeState {
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

export const pyJsonForgeVerifier: ChallengeVerifier = {
  meta: {
    id: 'py-json-forge',
    name: 'Python JSON Forge',
    description:
      'Python-backed JSON workbench: prettify / minify / sort-keys on user-supplied JSON (SPE-109)',
    specPath: 'specs/py-json-forge.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: ForgeState = { page: null, input: null, buttons: {} };

    /** Small random JSON document with three single-word keys. */
    function randomDocument(): { obj: Record<string, unknown>; keys: string[] } {
      const pool = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
      const keys: string[] = [];
      while (keys.length < 3) {
        const k = ctx.rand.pick(pool);
        if (!keys.includes(k)) {
          keys.push(k);
        }
      }
      const obj: Record<string, unknown> = {};
      for (const k of keys) {
        obj[k] = ctx.rand.int(1, 999);
      }
      return { obj, keys };
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

    async function fillJson(value: string): Promise<void> {
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
        id: 'json-page-loads',
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
        id: 'json-input-present',
        name: 'A visible, editable JSON textarea/input is present',
        severity: 'required',
        requires: ['json-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input = await findTextInput(page, {
            prefer: /json|data|input|paste|payload|document/i,
            kind: 'any'
          });
          if (input === null) {
            await ctx.session.screenshot(page, '02-no-input.png');
            throw new CheckFailed('No visible editable text input/textarea found for the JSON');
          }
          state.input = input;
        }
      },
      {
        id: 'json-controls-present',
        name: 'Prettify, minify and sort-keys buttons are discoverable',
        severity: 'required',
        requires: ['json-input-present'],
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
        id: 'json-prettify',
        name: 'Prettify indents the JSON (key followed by whitespace before the value)',
        severity: 'required',
        requires: ['json-controls-present'],
        run: async () => {
          const { obj, keys } = randomDocument();
          await fillJson(JSON.stringify(obj));
          const out = await runOp('prettify');
          const compact = new RegExp(`"${keys[0]}":${String(obj[keys[0]!])}`);
          const spacious = new RegExp(`"${keys[0]}":\\s+${String(obj[keys[0]!])}`);
          if (compact.test(out) && !spacious.test(out)) {
            throw new CheckFailed(
              `Prettify: output still compact, new text was "${out.slice(0, 200)}"`
            );
          }
          for (const key of keys) {
            if (!out.includes(`"${key}"`)) {
              throw new CheckFailed(
                `Prettify: key "${key}" missing from output, new text was "${out.slice(0, 200)}"`
              );
            }
          }
        }
      },
      {
        id: 'json-minify',
        name: 'Minify compacts the JSON (no spaces between tokens)',
        severity: 'required',
        requires: ['json-controls-present'],
        run: async () => {
          const { obj, keys } = randomDocument();
          await fillJson(JSON.stringify(obj, null, 2));
          const out = await runOp('minify');
          const needle =
            `"${keys[0]}":${String(obj[keys[0]!])},"${keys[1]}":${String(obj[keys[1]!])}`;
          if (!out.replace(/\s+/g, '').includes(needle.replace(/\s+/g, ''))) {
            throw new CheckFailed(
              `Minify: expected compact JSON containing ${needle}, new text was "${out.slice(0, 200)}"`
            );
          }
          if (/\n\s{2,}"/.test(out)) {
            throw new CheckFailed(
              `Minify: output still looks indented, new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'json-sort-keys',
        name: 'Sort keys orders object keys alphabetically',
        severity: 'required',
        requires: ['json-controls-present'],
        run: async () => {
          const { obj, keys } = randomDocument();
          const sorted = [...keys].sort();
          await fillJson(JSON.stringify(obj));
          const out = await runOp('sortKeys');
          const first = out.indexOf(`"${sorted[0]!}"`);
          const second = out.indexOf(`"${sorted[1]!}"`);
          const third = out.indexOf(`"${sorted[2]!}"`);
          if (first === -1 || second === -1 || third === -1) {
            throw new CheckFailed(
              `Sort keys: keys missing from output, new text was "${out.slice(0, 200)}"`
            );
          }
          if (!(first < second && second < third)) {
            throw new CheckFailed(
              `Sort keys: expected order ${sorted.join(', ')}, new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'json-invalid-input',
        name: 'Invalid JSON produces a friendly error message',
        severity: 'required',
        requires: ['json-controls-present'],
        run: async () => {
          await fillJson('this is not json {');
          const out = await runOp('prettify');
          if (!/error|invalid|not\s+valid|failed|unexpected|cannot|unable/i.test(out)) {
            const page = state.page;
            if (page !== null) {
              await ctx.session.screenshot(page, '04-invalid-json.png');
            }
            throw new CheckFailed(
              `Invalid JSON: no friendly error surfaced, new text was "${out.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'json-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
