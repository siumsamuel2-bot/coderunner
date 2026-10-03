import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import {
  expectNumbersEqual,
  findButton,
  normalize,
  parseTrailingNumber
} from '../../core/ui.ts';

/**
 * Calculator challenge verifier.
 *
 * Contract (see specs/calculator.md): the app must expose a display plus
 * clickable buttons for digits 0-9, + - (x or *) (÷ or /), =, clear, and a
 * decimal point, discoverable via visible text or aria-label. The display is
 * discovered dynamically: the element whose text changes when digits are
 * pressed. All arithmetic uses randomized seeded operands.
 */

const OP_PATTERNS = {
  add: [/^\+$/, /plus/i],
  sub: [/^[-−–]$/, /minus/i],
  mul: [/^[*×xX⨯·]$/, /multipl/i],
  div: [/^[÷/:]$/, /divide|division/i],
  eq: [/^=$/, /^equals?$/i],
  clear: [/^(ac|c|ce|clr|all clear|clear all|clear|reset)$/i],
  dot: [/^[.,]$/, /decimal|point/i]
} as const;

type OpKey = keyof typeof OP_PATTERNS;

interface ButtonSet {
  readonly digits: readonly Locator[];
  readonly ops: Readonly<Record<OpKey, Locator>>;
}

/** One display candidate discovered in the DOM (re-locatable). */
interface DisplayHandle {
  read(): Promise<string>;
}

class ElementDisplay implements DisplayHandle {
  private readonly locator: Locator;
  constructor(locator: Locator) {
    this.locator = locator;
  }
  async read(): Promise<string> {
    return await this.locator.innerText().catch(() => '');
  }
}

class ValueDisplay implements DisplayHandle {
  private readonly locator: Locator;
  constructor(locator: Locator) {
    this.locator = locator;
  }
  async read(): Promise<string> {
    return await this.locator.inputValue().catch(() => '');
  }
}

interface CalculatorState {
  page: Page | null;
  buttons: ButtonSet | null;
  display: DisplayHandle | null;
  reads: { label: string; expected: string; displayed: string }[];
}

async function findButtonMulti(
  page: Page,
  patterns: readonly RegExp[]
): Promise<Locator | null> {
  for (const pattern of patterns) {
    const button = await findButton(page, pattern);
    if (button !== null) {
      return button;
    }
  }
  return null;
}

/** Presses a token sequence: single digits, '.', or op keys (add/sub/...). */
async function press(
  page: Page,
  buttons: ButtonSet,
  tokens: readonly string[]
): Promise<void> {
  for (const token of tokens) {
    if (/^[0-9]$/.test(token)) {
      const digit = buttons.digits[Number(token)];
      if (digit === undefined) {
        throw new CheckFailed(`Digit button "${token}" not found`);
      }
      await digit.click();
    } else if (token === '.') {
      await buttons.ops.dot.click();
    } else if (token === ',') {
      await buttons.ops.dot.click();
    } else {
      const op = buttons.ops[token as OpKey];
      if (op === undefined) {
        throw new CheckFailed(`Operator button "${token}" not found`);
      }
      await op.click();
    }
    await page.waitForTimeout(60);
  }
}

/** Splits a number (possibly decimal) into pressable tokens. */
function numTokens(value: number | string): string[] {
  return String(value).split('');
}

/**
 * Finds the display: presses 1-2-3, tags every DOM element that then contains
 * "123" (and looks display-like) with a data attribute, confirms the best
 * candidate by pressing another digit, then clears. Returns a handle.
 */
async function discoverDisplay(
  page: Page,
  buttons: ButtonSet
): Promise<DisplayHandle> {
  await press(page, buttons, ['clear']);
  await press(page, buttons, ['1', '2', '3']);
  await page.waitForTimeout(150);

  const candidates = await page.evaluate((): {
    index: number; input: boolean; text: string; score: number;
  }[] => {
    const out: { index: number; input: boolean; text: string; score: number }[] = [];
    const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
    let index = 0;
    for (const el of all) {
      if (el.closest('button') !== null) {
        continue;
      }
      const isInput = el instanceof HTMLInputElement;
      const isTextarea = el instanceof HTMLTextAreaElement;
      if (!isInput && !isTextarea && el.children.length > 3) {
        continue;
      }
      if (el.offsetParent === null && !(el instanceof HTMLBodyElement)) {
        continue;
      }
      const text = isInput || isTextarea
        ? (el as HTMLInputElement).value
        : (el.textContent ?? '');
      if (!text.includes('123')) {
        continue;
      }
      if (text.length > 60) {
        continue;
      }
      const identity = `${el.id} ${el.className} ${el.getAttribute('aria-label') ?? ''}`;
      let score = 0;
      if (/display|screen|result|output/i.test(identity)) {
        score -= 10;
      }
      if (isInput || isTextarea) {
        score -= 5;
      }
      score += el.children.length;
      el.setAttribute('data-vf-display', String(index));
      out.push({ index, input: isInput || isTextarea, text: text.slice(0, 80), score });
      index += 1;
    }
    return out;
  });

  if (candidates.length === 0) {
    throw new CheckFailed(
      'No display element found: nothing on the page showed "123" after pressing 1 2 3'
    );
  }

  candidates.sort((a, b) => a.score - b.score);

  // Confirm the best candidate: pressing "4" must make it show "1234".
  await press(page, buttons, ['4']);
  await page.waitForTimeout(150);
  for (const candidate of candidates) {
    const locator = page.locator(`[data-vf-display="${candidate.index}"]`);
    if ((await locator.count()) === 0) {
      continue;
    }
    const handle = candidate.input
      ? new ValueDisplay(locator)
      : new ElementDisplay(locator);
    const text = await handle.read();
    if (text.includes('1234')) {
      await press(page, buttons, ['clear']);
      return handle;
    }
  }
  throw new CheckFailed(
    'Display element found for "123" but it did not update to "1234" when 4 was pressed'
  );
}

export const calculatorVerifier: ChallengeVerifier = {
  meta: {
    id: 'calculator',
    name: 'Calculator',
    description:
      'Working calculator with +,-,x,/ clear and decimal support (SPE-55 challenge 1)',
    specPath: 'specs/calculator.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: CalculatorState = {
      page: null,
      buttons: null,
      display: null,
      reads: []
    };

    async function record(
      label: string,
      expected: string,
      display: DisplayHandle
    ): Promise<void> {
      const displayed = await display.read();
      state.reads.push({ label, expected, displayed });
    }

    return [
      {
        id: 'calc-page-loads',
        name: 'Calculator page loads',
        severity: 'required',
        run: async () => {
          const page = await ctx.session.newPage();
          state.page = page;
          const response = await page.goto(ctx.targetUrl, {
            waitUntil: 'domcontentloaded'
          });
          if (response === null || response.status() >= 400) {
            throw new CheckFailed(
              `Target returned HTTP ${response === null ? 'unknown' : response.status()}`
            );
          }
          await page.waitForLoadState('networkidle').catch(() => undefined);
          await ctx.session.screenshot(page, '01-loaded.png');
        }
      },
      {
        id: 'calc-buttons-present',
        name: 'All required buttons are discoverable (0-9, + - x / = C .)',
        severity: 'required',
        requires: ['calc-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const digits: Locator[] = [];
          for (let d = 0; d <= 9; d += 1) {
            const button = await findButtonMulti(page, [
              new RegExp(`^${d}$`),
              new RegExp(`^key[- _]?${d}$`, 'i'),
              new RegExp(`^${d}\\b`)
            ]);
            if (button === null) {
              throw new CheckFailed(`Digit button "${d}" not found`);
            }
            digits.push(button);
          }
          const ops = {} as Record<OpKey, Locator>;
          const opNames: Record<OpKey, string> = {
            add: '+',
            sub: '-',
            mul: 'multiply',
            div: 'divide',
            eq: 'equals',
            clear: 'clear',
            dot: 'decimal point'
          };
          for (const key of Object.keys(OP_PATTERNS) as OpKey[]) {
            const button = await findButtonMulti(page, OP_PATTERNS[key]);
            if (button === null) {
              throw new CheckFailed(`Operator button "${opNames[key]}" not found`);
            }
            ops[key] = button;
          }
          state.buttons = { digits, ops };
        }
      },
      {
        id: 'calc-display-updates',
        name: 'Display updates when digits are pressed',
        severity: 'required',
        requires: ['calc-buttons-present'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const buttons = state.buttons;
          if (buttons === null) {
            throw new CheckFailed('No buttons');
          }
          state.display = await discoverDisplay(page, buttons);
          await ctx.session.screenshot(page, '02-display-found.png');
        }
      },
      {
        id: 'calc-add',
        name: 'Addition produces the correct result',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.int(1, 99);
          const b = ctx.rand.int(1, 99);
          await press(page, buttons, ['clear', ...numTokens(a), 'add', ...numTokens(b), 'eq']);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, a + b, `Addition ${a}+${b}`);
          await record(`${a}+${b}`, String(a + b), display);
        }
      },
      {
        id: 'calc-sub',
        name: 'Subtraction produces the correct result',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.int(10, 99);
          const b = ctx.rand.int(1, a);
          await press(page, buttons, ['clear', ...numTokens(a), 'sub', ...numTokens(b), 'eq']);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, a - b, `Subtraction ${a}-${b}`);
          await record(`${a}-${b}`, String(a - b), display);
        }
      },
      {
        id: 'calc-mul',
        name: 'Multiplication produces the correct result',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.int(2, 99);
          const b = ctx.rand.int(2, 9);
          await press(page, buttons, ['clear', ...numTokens(a), 'mul', ...numTokens(b), 'eq']);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, a * b, `Multiplication ${a}*${b}`);
          await record(`${a}*${b}`, String(a * b), display);
        }
      },
      {
        id: 'calc-div',
        name: 'Division produces the correct result (integer and decimal)',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.int(10, 99);
          const b = ctx.rand.pick([2, 4, 5, 8]);
          await press(page, buttons, ['clear', ...numTokens(a), 'div', ...numTokens(b), 'eq']);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, a / b, `Division ${a}/${b}`);
          await record(`${a}/${b}`, String(a / b), display);

          const c = ctx.rand.pick([7, 9, 11, 13]);
          await press(page, buttons, ['clear', ...numTokens(c), 'div', '2', 'eq']);
          const shownDecimal = parseTrailingNumber(await display.read());
          expectNumbersEqual(shownDecimal, c / 2, `Decimal division ${c}/2`);
          await record(`${c}/2`, String(c / 2), display);
        }
      },
      {
        id: 'calc-decimal',
        name: 'Decimal number entry works',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.decimal(1, 9);
          const b = ctx.rand.decimal(1, 9);
          await press(page, buttons, ['clear', ...numTokens(a), 'add', ...numTokens(b), 'eq']);
          const expected = Number(a) + Number(b);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, expected, `Decimal ${a}+${b}`);
          await record(`${a}+${b}`, String(expected), display);
        }
      },
      {
        id: 'calc-chained',
        name: 'Chained operations (a + b - c) work without pressing = in between',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          const a = ctx.rand.int(10, 60);
          const b = ctx.rand.int(1, 30);
          const c = ctx.rand.int(0, b);
          await press(page, buttons, [
            'clear', ...numTokens(a), 'add', ...numTokens(b), 'sub', ...numTokens(c), 'eq'
          ]);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, a + b - c, `Chained ${a}+${b}-${c}`);
          await record(`${a}+${b}-${c}`, String(a + b - c), display);
        }
      },
      {
        id: 'calc-clear',
        name: 'Clear (AC/C) resets the display',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          await press(page, buttons, ['clear']);
          await press(page, buttons, ['5', '8']);
          await press(page, buttons, ['clear']);
          const text = normalize(await display.read());
          if (!/^(|0|0\.?0*|ac|c|ce)$/.test(text)) {
            throw new CheckFailed(`Display did not reset after clear: "${text}"`);
          }
        }
      },
      {
        id: 'calc-div-zero',
        name: 'Division by zero does not crash the app',
        severity: 'required',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, buttons, display } = state;
          if (page === null || buttons === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          await press(page, buttons, ['clear']);
          await press(page, buttons, ['5', 'div', '0', 'eq']);
          await page.waitForTimeout(200);
          await ctx.session.screenshot(page, '03-div-zero.png');
          // The app must remain responsive: a follow-up calculation works.
          await press(page, buttons, ['clear']);
          await press(page, buttons, ['2', 'add', '2', 'eq']);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, 4, 'Post-error recovery 2+2');
        }
      },
      {
        id: 'calc-keyboard',
        name: 'Keyboard input works (1+2 via typing + Enter)',
        severity: 'bonus',
        requires: ['calc-display-updates'],
        run: async () => {
          const { page, display } = state;
          if (page === null || display === null) {
            throw new CheckFailed('Missing state');
          }
          await page.keyboard.type('1+2', { delay: 40 });
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);
          const shown = parseTrailingNumber(await display.read());
          expectNumbersEqual(shown, 3, 'Keyboard 1+2');
        }
      },
      {
        id: 'calc-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          await ctx.evidence.saveJson('04-display-readings.json', state.reads);
          const page = state.page;
          if (page !== null) {
            await ctx.session.screenshot(page, '05-final.png');
          }
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
