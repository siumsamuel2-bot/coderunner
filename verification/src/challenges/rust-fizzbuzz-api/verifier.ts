import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * Rust FizzBuzz API challenge verifier.
 *
 * Track: Rust (new language track under the SPE-107 weekly cadence).
 * Contract (see specs/rust-fizzbuzz-api.md): a same-origin JSON API at
 * GET /api/fizzbuzz/{n} returning { "n": <int>, "result": <string> } where the
 * result follows the FizzBuzz rules, with 4xx for non-positive / non-integer
 * input. Verified over HTTP with seeded inputs so a hardcoded table cannot pass.
 */

interface FizzbuzzBody {
  result: string;
}

/** Appends a path to the submission base URL without doubling slashes. */
function apiUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

/** Parses a trace body as JSON, failing the check with a readable message. */
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

/** Normalizes the response into { result } accepting string or numeric result. */
function readResult(body: unknown, label: string): FizzbuzzBody {
  if (typeof body === 'string') {
    return { result: body };
  }
  const record = asRecord(body);
  if (record === null || !('result' in record)) {
    throw new CheckFailed(`${label}: expected a JSON object with a "result" field`);
  }
  const result = record.result;
  if (typeof result === 'string') {
    return { result };
  }
  if (typeof result === 'number' && Number.isFinite(result)) {
    return { result: String(result) };
  }
  throw new CheckFailed(`${label}: "result" must be a string or number`);
}

export const rustFizzbuzzApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'rust-fizzbuzz-api',
    name: 'Rust FizzBuzz API',
    description:
      'Rust-backed FizzBuzz JSON API: GET /api/fizzbuzz/{n} (Rust track)',
    specPath: 'specs/rust-fizzbuzz-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;

    // Deterministic-but-seeded cases: one plain number that is neither a
    // multiple of 3 nor 5, so a submission must actually compute the answer.
    let plain = ctx.rand.int(1, 100);
    for (let i = 0; i < 100 && (plain % 3 === 0 || plain % 5 === 0); i += 1) {
      plain = ctx.rand.int(1, 100);
    }
    if (plain % 3 === 0 || plain % 5 === 0) {
      plain = 98; // 98 is not divisible by 3 or 5; guarantees a plain case.
    }

    const get = async (n: number | string): Promise<HttpTrace> =>
      fetchTrace(apiUrl(base, `/api/fizzbuzz/${encodeURIComponent(String(n))}`));

    const expectResult = async (
      n: number | string,
      expected: string,
      evidenceName: string
    ): Promise<void> => {
      const trace = await get(n);
      await ctx.evidence.saveJson(evidenceName, {
        n,
        expected,
        status: trace.status,
        bodyText: trace.bodyText
      });
      if (trace.status < 200 || trace.status > 299) {
        throw new CheckFailed(
          `GET /api/fizzbuzz/${n} returned ${trace.status} ${trace.statusText}, expected 2xx`
        );
      }
      const { result } = readResult(
        await jsonBody(trace, `GET /api/fizzbuzz/${n}`),
        `GET /api/fizzbuzz/${n}`
      );
      if (result !== expected) {
        throw new CheckFailed(
          `GET /api/fizzbuzz/${n} returned ${JSON.stringify(result)}, expected ${JSON.stringify(expected)}`
        );
      }
    };

    return [
      {
        id: 'fb-root-loads',
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
        id: 'fb-fizz',
        name: 'Multiples of 3 return "Fizz"',
        severity: 'required',
        requires: ['fb-root-loads'],
        run: async () => {
          await expectResult(3, 'Fizz', '02-fizz-3.json');
          await expectResult(9, 'Fizz', '03-fizz-9.json');
        }
      },
      {
        id: 'fb-buzz',
        name: 'Multiples of 5 return "Buzz"',
        severity: 'required',
        requires: ['fb-root-loads'],
        run: async () => {
          await expectResult(5, 'Buzz', '04-buzz-5.json');
          await expectResult(25, 'Buzz', '05-buzz-25.json');
        }
      },
      {
        id: 'fb-fizzbuzz',
        name: 'Multiples of 15 return "FizzBuzz"',
        severity: 'required',
        requires: ['fb-root-loads'],
        run: async () => {
          await expectResult(15, 'FizzBuzz', '06-fizzbuzz-15.json');
          await expectResult(30, 'FizzBuzz', '07-fizzbuzz-30.json');
        }
      },
      {
        id: 'fb-plain-number',
        name: 'Other numbers return the number itself',
        severity: 'required',
        requires: ['fb-root-loads'],
        run: async () => {
          await expectResult(7, '7', '08-plain-7.json');
          await expectResult(plain, String(plain), '09-plain-seeded.json');
          await expectResult(1, '1', '10-plain-1.json');
        }
      },
      {
        id: 'fb-validation',
        name: 'Non-positive / non-integer input is rejected with 4xx',
        severity: 'required',
        requires: ['fb-root-loads'],
        run: async () => {
          for (const bad of ['0', '-3', 'abc']) {
            const trace = await get(bad);
            await ctx.evidence.saveJson(`11-validation-${bad}.json`, {
              n: bad,
              status: trace.status,
              bodyText: trace.bodyText
            });
            if (trace.status < 400 || trace.status > 499) {
              throw new CheckFailed(
                `GET /api/fizzbuzz/${bad} returned ${trace.status}, expected 4xx`
              );
            }
          }
        }
      },
      {
        id: 'fb-json-content-type',
        name: 'API responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['fb-fizz'],
        run: async () => {
          const trace = await get(3);
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `GET /api/fizzbuzz/3 content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 'fb-distinct-results',
        name: 'Fizz, Buzz and FizzBuzz are distinct outputs (bonus)',
        severity: 'bonus',
        requires: ['fb-fizz', 'fb-buzz', 'fb-fizzbuzz'],
        run: async () => {
          const values: string[] = [];
          for (const n of [3, 5, 15]) {
            const trace = await get(n);
            const { result } = readResult(
              await jsonBody(trace, `GET /api/fizzbuzz/${n}`),
              `GET /api/fizzbuzz/${n}`
            );
            values.push(result);
          }
          if (new Set(values).size !== 3) {
            throw new CheckFailed(
              `Fizz/Buzz/FizzBuzz outputs are not distinct: ${JSON.stringify(values)}`
            );
          }
        }
      },
      {
        id: 'fb-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
