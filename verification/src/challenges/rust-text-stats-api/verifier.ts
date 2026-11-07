import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * Rust Text Stats API challenge verifier.
 *
 * Track: Rust (new language track under the SPE-107 weekly cadence).
 * Contract (see specs/rust-text-stats-api.md): a same-origin JSON API at
 * POST /api/stats taking { "text": "..." } and returning numeric counts for
 * characters / words / lines. Counts are computed here for the same seeded
 * text, so a submission must actually analyze the input, not echo canned
 * numbers. Field names are matched case-insensitively with common aliases.
 */

/** Appends a path to the submission base URL without doubling slashes. */
function apiUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

async function jsonBody(trace: HttpTrace, label: string): Promise<unknown> {
  if (trace.bodyText.trim() === '') {
    throw new CheckFailed(`${label}: response body was empty`);
  }
  try {
    return JSON.parse(trace.bodyText);
  } catch {
    throw new CheckFailed(
      `${label}: response body was not valid JSON (got "${trace.bodyText.slice(0, 120)}")`
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads the first numeric field matching any alias from a JSON object.
 * Aliases make the contract resilient to naming (chars/characters, etc.).
 */
function readNumber(
  record: Record<string, unknown>,
  aliases: readonly string[]
): number | null {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    normalized.set(key.toLowerCase().replaceAll(/[^a-z0-9]/g, ''), value);
  }
  for (const alias of aliases) {
    const value = normalized.get(alias.toLowerCase().replaceAll(/[^a-z0-9]/g, ''));
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/** Counts characters (incl. whitespace), whitespace-separated words and lines. */
function counts(text: string): { characters: number; words: number; lines: number } {
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  const lines = text.split('\n').length;
  return { characters: text.length, words, lines };
}

export const rustTextStatsApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'rust-text-stats-api',
    name: 'Rust Text Stats API',
    description:
      'Rust-backed text statistics API: POST /api/stats returns character / word / line counts (Rust track)',
    specPath: 'specs/rust-text-stats-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;

    const post = async (text: string): Promise<HttpTrace> =>
      fetchTrace(apiUrl(base, '/api/stats'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ text })
      });

    // Seeded multi-line text: no trailing newline, single spaces between
    // words, so character/word/line counts are unambiguous.
    const lineCount = ctx.rand.int(2, 5);
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i += 1) {
      const wordCount = ctx.rand.int(2, 6);
      const words: string[] = [];
      for (let j = 0; j < wordCount; j += 1) {
        words.push(ctx.rand.pick(['alpha', 'bravo', 'charlie', 'delta', 'echo']));
      }
      lines.push(words.join(' '));
    }
    const sampleText = lines.join('\n');
    const sampleCounts = counts(sampleText);

    return [
      {
        id: 'stats-root-loads',
        name: 'Base URL loads (HTTP < 400)',
        severity: 'required',
        run: async () => {
          const trace = await fetchTrace(base);
          await ctx.evidence.saveJson('01-root-trace.json', trace);
          if (trace.status >= 400) {
            throw new CheckFailed(
              `GET ${base} returned ${trace.status} ${trace.statusText}, expected < 400`
            );
          }
          try {
            const page = await ctx.session.newPage();
            await page.goto(base, {
              waitUntil: 'domcontentloaded',
              timeout: ctx.defaultTimeoutMs
            });
            await page
              .waitForLoadState('networkidle', { timeout: 5_000 })
              .catch(() => undefined);
            await ctx.session.screenshot(page, '01-loaded.png');
          } catch {
            // Non-HTML roots are tolerated; the HTTP status is the source of truth.
          }
        }
      },
      {
        id: 'stats-post-counts',
        name: 'POST /api/stats returns correct counts for seeded text',
        severity: 'required',
        requires: ['stats-root-loads'],
        run: async () => {
          const trace = await post(sampleText);
          await ctx.evidence.saveJson('02-stats-trace.json', {
            request: { text: sampleText },
            expected: sampleCounts,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `POST /api/stats returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'POST /api/stats'));
          if (body === null) {
            throw new CheckFailed('POST /api/stats did not return a JSON object');
          }
          const characters = readNumber(body, ['characters', 'chars', 'length', 'characterCount']);
          const words = readNumber(body, ['words', 'wordCount']);
          const linesValue = readNumber(body, ['lines', 'lineCount']);
          if (characters !== sampleCounts.characters) {
            throw new CheckFailed(
              `characters was ${characters}, expected ${sampleCounts.characters}`
            );
          }
          if (words !== sampleCounts.words) {
            throw new CheckFailed(`words was ${words}, expected ${sampleCounts.words}`);
          }
          if (linesValue !== sampleCounts.lines) {
            throw new CheckFailed(`lines was ${linesValue}, expected ${sampleCounts.lines}`);
          }
        }
      },
      {
        id: 'stats-single-word',
        name: 'A single word reports 1 word on 1 line',
        severity: 'required',
        requires: ['stats-root-loads'],
        run: async () => {
          const text = ctx.rand.pick(['solo', 'quiet', 'amber']);
          const trace = await post(text);
          await ctx.evidence.saveJson('03-single-word-trace.json', {
            request: { text },
            status: trace.status,
            bodyText: trace.bodyText
          });
          const body = asRecord(await jsonBody(trace, 'POST /api/stats'));
          if (body === null) {
            throw new CheckFailed('POST /api/stats did not return a JSON object');
          }
          const words = readNumber(body, ['words', 'wordCount']);
          const linesValue = readNumber(body, ['lines', 'lineCount']);
          if (words !== 1 || linesValue !== 1) {
            throw new CheckFailed(
              `expected words=1 lines=1 for "${text}", got words=${words} lines=${linesValue}`
            );
          }
        }
      },
      {
        id: 'stats-empty-text',
        name: 'Empty text reports zero words',
        severity: 'required',
        requires: ['stats-root-loads'],
        run: async () => {
          const trace = await post('');
          await ctx.evidence.saveJson('04-empty-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            // Accept a 4xx "empty text" rejection as well as a 2xx zero report.
            if (trace.status >= 400 && trace.status <= 499) {
              return;
            }
            throw new CheckFailed(
              `POST /api/stats (empty) returned ${trace.status}, expected 2xx or 4xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'POST /api/stats (empty)'));
          if (body === null) {
            throw new CheckFailed('POST /api/stats (empty) did not return a JSON object');
          }
          const words = readNumber(body, ['words', 'wordCount']);
          if (words !== 0) {
            throw new CheckFailed(`empty text reported words=${words}, expected 0`);
          }
        }
      },
      {
        id: 'stats-validation',
        name: 'POST without a text field is rejected with 4xx',
        severity: 'required',
        requires: ['stats-root-loads'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/stats'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ notText: ctx.rand.phrase() })
          });
          await ctx.evidence.saveJson('05-validation-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `POST /api/stats without "text" returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 'stats-json-content-type',
        name: 'API responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['stats-post-counts'],
        run: async () => {
          const trace = await post('hello world');
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `POST /api/stats content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 'stats-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
