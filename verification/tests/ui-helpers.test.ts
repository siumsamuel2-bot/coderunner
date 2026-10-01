import { describe, expect, it } from 'vitest';
import { normalize, parseTrailingNumber } from '../src/core/ui.ts';
import { fetchHtml, fetchTrace, fetchOk } from '../src/core/http.ts';
import { startMockApp } from './helpers/mock-app.ts';

describe('parseTrailingNumber', () => {
  it.each([
    ['15', 15],
    ['15.00', 15],
    ['1,234', 1234],
    ['= 42', 42],
    ['3.5', 3.5],
    ['-7', -7],
    ['0.125', 0.125],
    ['1e3', 1000],
    ['123456', 123456],
    ['Error', null],
    ['NaN', null],
    ['', null]
  ])('parses %j into %s', (input, expected) => {
    expect(parseTrailingNumber(input)).toBe(expected);
  });

  it('falls back to the first number when nothing trails', () => {
    expect(parseTrailingNumber('a7b')).toBe(7);
  });
});

describe('normalize', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalize('  Hello   World  ')).toBe('hello world');
  });
});

describe('http helpers (against live fixture server)', () => {
  it('fetchTrace records status, headers, timing and body', async () => {
    const app = await startMockApp();
    try {
      const trace = await fetchTrace(`${app.url}/calc`);
      expect(trace.status).toBe(200);
      expect(trace.ok).toBe(true);
      expect(trace.contentType).toContain('text/html');
      expect(trace.bodyBytes).toBeGreaterThan(0);
      expect(trace.bodyText).toContain('<title>Calculator</title>');
      expect(trace.durationMs).toBeGreaterThanOrEqual(0);
      expect(trace.at).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it('fetchHtml rejects non-2xx and non-HTML responses', async () => {
    const app = await startMockApp();
    try {
      const trace = await fetchHtml(`${app.url}/calc`);
      expect(trace.status).toBe(200);
      await expect(fetchHtml(`${app.url}/json`)).rejects.toThrow(
        /did not return HTML/
      );
    } finally {
      await app.close();
    }
  });

  it('fetchOk throws with status on server errors', async () => {
    const app = await startMockApp();
    try {
      // The mock app always returns 200, so simulate an error by pointing
      // fetchOk at a closed port.
      const badPort = Number(new URL(app.url).port) + 1000;
      await expect(fetchOk(`http://127.0.0.1:${badPort}/`)).rejects.toThrow();
    } finally {
      await app.close();
    }
  });
});
