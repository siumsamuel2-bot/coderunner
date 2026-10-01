import type { Locator, Page } from 'playwright';
import { CheckFailed } from './types.ts';

/**
 * Shared UI discovery helpers. All discovery is contract-based: elements must
 * be findable via visible text, accessible name (aria-label), or standard
 * input roles. No app-specific selectors are ever used.
 */

export function normalize(text: string): string {
  return text.trim().toLowerCase().replaceAll(/\s+/g, ' ');
}

/** Finds the first visible+enabled button-ish element matching the pattern. */
export async function findButton(
  page: Page,
  pattern: RegExp
): Promise<Locator | null> {
  const candidates: Locator[] = [
    page.getByRole('button', { name: pattern }),
    page.locator('button', { hasText: pattern }),
    page.locator('input[type="button"], input[type="submit"]'),
    page.locator('[role="button"]', { hasText: pattern })
  ];
  for (const candidate of candidates) {
    const count = await candidate.count();
    for (let i = 0; i < count; i += 1) {
      const item = candidate.nth(i);
      if (await item.isVisible().catch(() => false)) {
        const disabled = await item.isDisabled().catch(() => false);
        if (!disabled) {
          return item;
        }
      }
    }
  }
  // input[value] fallback (values are not always the accessible name).
  const inputs = page.locator('input[type="button"], input[type="submit"]');
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i += 1) {
    const item = inputs.nth(i);
    const value = await item.getAttribute('value').catch(() => null);
    if (value !== null && pattern.test(value)) {
      if (await item.isVisible().catch(() => false)) {
        return item;
      }
    }
  }
  return null;
}

/** Finds the first visible link matching the pattern. */
export async function findLink(
  page: Page,
  pattern: RegExp
): Promise<Locator | null> {
  const candidates: Locator[] = [
    page.getByRole('link', { name: pattern }),
    page.locator('a', { hasText: pattern })
  ];
  for (const candidate of candidates) {
    const count = await candidate.count();
    for (let i = 0; i < count; i += 1) {
      const item = candidate.nth(i);
      if (await item.isVisible().catch(() => false)) {
        return item;
      }
    }
  }
  return null;
}

export interface TextInputHints {
  /** Prefer inputs whose placeholder/aria-label/name matches this pattern. */
  readonly prefer?: RegExp;
  /** Exclude inputs matching this pattern (e.g. email/password). */
  readonly exclude?: RegExp;
  /** Restrict to a specific kind. Default: text input or textarea. */
  readonly kind?: 'text' | 'textarea' | 'any';
}

/** Finds a visible, editable text input or textarea. */
export async function findTextInput(
  page: Page,
  hints: TextInputHints = {}
): Promise<Locator | null> {
  const kind = hints.kind ?? 'text';
  const selectors: string[] = [];
  if (kind === 'text' || kind === 'any') {
    selectors.push('input:not([type])', 'input[type="text"]', 'input[type="search"]');
  }
  if (kind === 'textarea' || kind === 'any') {
    selectors.push('textarea');
  }
  const all = page.locator(selectors.join(', '));
  const count = await all.count();
  const preferred: Locator[] = [];
  const fallback: Locator[] = [];
  for (let i = 0; i < count; i += 1) {
    const item = all.nth(i);
    if (!(await item.isVisible().catch(() => false))) {
      continue;
    }
    if (await item.isDisabled().catch(() => false)) {
      continue;
    }
    const readOnly = await item.getAttribute('readonly').catch(() => null);
    if (readOnly !== null) {
      continue;
    }
    const identity = [
      await item.getAttribute('placeholder').catch(() => null),
      await item.getAttribute('aria-label').catch(() => null),
      await item.getAttribute('name').catch(() => null),
      await item.getAttribute('id').catch(() => null)
    ]
      .filter((v): v is string => v !== null)
      .join(' ');
    if (hints.exclude && hints.exclude.test(identity)) {
      continue;
    }
    if (hints.prefer && hints.prefer.test(identity)) {
      preferred.push(item);
    } else {
      fallback.push(item);
    }
  }
  return preferred[0] ?? fallback[0] ?? null;
}

/** Body innerText of the page. */
export async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? '');
}

/**
 * Waits until new content appears in the page beyond the `base` snapshot and
 * beyond the exact user-message echo (the user text alone does not count as a
 * bot response; a reply that merely contains/embeds the user text does).
 */
export async function waitForNewText(
  page: Page,
  base: string,
  expectedUserText: string,
  timeoutMs: number
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await pageText(page);
    if (text !== base) {
      const additions: string[] = [];
      const baseLines = new Set(
        base
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      );
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (
          trimmed.length > 0 &&
          !baseLines.has(trimmed) &&
          trimmed !== expectedUserText
        ) {
          additions.push(trimmed);
        }
      }
      if (additions.length > 0) {
        return additions.join('\n');
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
}

/** Extracts the last number appearing in a display-like text. */
export function parseTrailingNumber(displayText: string): number | null {
  const text = displayText.trim();
  if (/^(error|undefined|nan|∞|infinity|not a number)$/i.test(text)) {
    return null;
  }
  const match = text
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*$/);
  if (match === null) {
    const any = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    return any === null ? null : Number(any[0]);
  }
  return Number(match[0]);
}

/** Asserts two numbers are equal within floating-point tolerance. */
export function expectNumbersEqual(
  actual: number | null,
  expected: number,
  label: string
): void {
  if (actual === null) {
    throw new CheckFailed(
      `${label}: could not read a numeric result from the display`
    );
  }
  const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-9);
  if (Math.abs(actual - expected) > tolerance) {
    throw new CheckFailed(
      `${label}: expected ${expected}, display showed ${actual}`
    );
  }
}
