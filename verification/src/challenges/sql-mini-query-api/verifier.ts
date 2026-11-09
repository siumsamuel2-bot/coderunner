import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { FetchOptions, HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * SQL Mini Query API challenge verifier.
 *
 * Track: SQL/Data (SPE-163 / SPE-107 week-6 cadence).
 * Contract (see specs/sql-mini-query-api.md): a same-origin aggregation API
 * under /api - POST /api/ingest replaces the store with { category, value }
 * rows; POST /api/query runs SQL-style aggregates (count/sum/avg/min/max)
 * with an optional category WHERE filter. Verified over HTTP with seeded
 * random rows, so a submission with hardcoded totals cannot pass.
 */

interface Row {
  category: string;
  value: number;
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

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export const sqlMiniQueryApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'sql-mini-query-api',
    name: 'SQL Mini Query API',
    description:
      'SQL-style aggregation API: ingest rows then run count/sum/avg/min/max queries with a category filter (SQL/Data track)',
    specPath: 'specs/sql-mini-query-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;

    // Seeded dataset: 3 categories x 4 rows of distinct-ish integers. The
    // harness computes every expected aggregate itself before asking.
    const categories = [
      `cat-${ctx.rand.token(6)}`,
      `cat-${ctx.rand.token(6)}`,
      `cat-${ctx.rand.token(6)}`
    ];
    const rows: Row[] = [];
    for (let i = 0; i < 12; i += 1) {
      rows.push({
        category: categories[i % 3] as string,
        value: ctx.rand.int(1, 1000)
      });
    }

    const rowsByCategory = (category: string): number[] =>
      rows.filter((row) => row.category === category).map((row) => row.value);
    const sum = (values: number[]): number =>
      values.reduce((total, value) => total + value, 0);
    const round2 = (value: number): number =>
      Math.round(value * 100) / 100;

    const post = async (path: string, body: unknown): Promise<HttpTrace> => {
      const options: FetchOptions = {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body)
      };
      return fetchTrace(apiUrl(base, path), options);
    };

    const query = async (
      op: string,
      category?: string
    ): Promise<HttpTrace> => {
      const body: Record<string, unknown> = { op };
      if (category !== undefined) body.category = category;
      return post('/api/query', body);
    };

    const expectResult = async (
      op: string,
      category: string | undefined,
      expected: number,
      tolerance: number,
      evidenceName: string
    ): Promise<void> => {
      const trace = await query(op, category);
      const label = `POST /api/query (op=${op}${category ? `, category=${category}` : ''})`;
      await ctx.evidence.saveJson(evidenceName, {
        op,
        category,
        expected,
        status: trace.status,
        bodyText: trace.bodyText
      });
      if (trace.status < 200 || trace.status > 299) {
        throw new CheckFailed(`${label} returned ${trace.status} ${trace.statusText}, expected 2xx`);
      }
      const body = asRecord(await jsonBody(trace, label));
      if (body === null) {
        throw new CheckFailed(`${label} did not return a JSON object`);
      }
      const result = asNumber(body.result);
      if (result === null) {
        throw new CheckFailed(`${label} result is not a number: ${JSON.stringify(body.result)}`);
      }
      if (Math.abs(result - expected) > tolerance) {
        throw new CheckFailed(
          `${label} returned ${result}, expected ${expected} (tolerance ${tolerance})`
        );
      }
    };

    const expect4xx = async (
      op: string,
      category: string | undefined,
      evidenceName: string
    ): Promise<void> => {
      const trace = await query(op, category);
      const label = `POST /api/query (op=${op}${category ? `, category=${category}` : ''})`;
      await ctx.evidence.saveJson(evidenceName, {
        op,
        category,
        status: trace.status,
        bodyText: trace.bodyText
      });
      if (trace.status < 400 || trace.status > 499) {
        throw new CheckFailed(`${label} returned ${trace.status}, expected 4xx`);
      }
    };

    const missingCategory = `missing-${ctx.rand.token(8)}`;
    const countCategory = categories[1] as string;
    const aggCategory = categories[2] as string;

    return [
      {
        id: 'q-root-loads',
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
        id: 'q-ingest-accepts',
        name: 'POST /api/ingest accepts 12 seeded rows and reports the count',
        severity: 'required',
        requires: ['q-root-loads'],
        run: async () => {
          const trace = await post('/api/ingest', { rows });
          await ctx.evidence.saveJson('02-ingest-trace.json', {
            rowCount: rows.length,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `POST /api/ingest returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'POST /api/ingest'));
          if (body === null) {
            throw new CheckFailed('POST /api/ingest did not return a JSON object');
          }
          const ingested = asNumber(body.ingested);
          if (ingested === null || ingested !== rows.length) {
            throw new CheckFailed(
              `POST /api/ingest reported ${JSON.stringify(body.ingested)}, expected ${rows.length}`
            );
          }
        }
      },
      {
        id: 'q-count-all',
        name: 'count over all rows returns the seeded row count',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expectResult('count', undefined, rows.length, 0, '03-count-all.json');
        }
      },
      {
        id: 'q-count-category',
        name: 'count with a category filter returns the per-category count',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expectResult(
            'count',
            countCategory,
            rowsByCategory(countCategory).length,
            0,
            '04-count-category.json'
          );
        }
      },
      {
        id: 'q-sum-all',
        name: 'sum over all rows returns the exact seeded total',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expectResult('sum', undefined, sum(rows.map((row) => row.value)), 0, '05-sum-all.json');
        }
      },
      {
        id: 'q-min-category',
        name: 'min with a category filter returns the per-category minimum',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expectResult(
            'min',
            aggCategory,
            Math.min(...rowsByCategory(aggCategory)),
            0,
            '06-min-category.json'
          );
        }
      },
      {
        id: 'q-max-category',
        name: 'max with a category filter returns the per-category maximum',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expectResult(
            'max',
            aggCategory,
            Math.max(...rowsByCategory(aggCategory)),
            0,
            '07-max-category.json'
          );
        }
      },
      {
        id: 'q-avg-category',
        name: 'avg with a category filter returns the mean (rounded to 2 decimals)',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          const values = rowsByCategory(aggCategory);
          await expectResult(
            'avg',
            aggCategory,
            round2(sum(values) / values.length),
            0.011,
            '08-avg-category.json'
          );
        }
      },
      {
        id: 'q-validation-op',
        name: 'Unknown op (and missing op) are rejected with 4xx',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expect4xx('median', undefined, '09-validation-median.json');
          const trace = await post('/api/query', { category: countCategory });
          await ctx.evidence.saveJson('10-validation-missing-op.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `POST /api/query without op returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 'q-empty-avg-4xx',
        name: 'avg over a category with no rows returns 4xx',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          await expect4xx('avg', missingCategory, '11-empty-avg.json');
        }
      },
      {
        id: 'q-validation-ingest',
        name: 'Ingest with a row missing value is rejected with 4xx',
        severity: 'required',
        requires: ['q-ingest-accepts'],
        run: async () => {
          const trace = await post('/api/ingest', {
            rows: [{ category: 'broken' }]
          });
          await ctx.evidence.saveJson('12-validation-ingest.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `POST /api/ingest with an invalid row returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 'q-json-content-type',
        name: 'Query responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['q-count-all'],
        run: async () => {
          const trace = await query('count');
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `POST /api/query content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 'q-reingest-replaces',
        name: 'Re-ingesting replaces the store (bonus)',
        severity: 'bonus',
        requires: ['q-count-all'],
        run: async () => {
          const fresh: Row[] = [
            { category: categories[0] as string, value: ctx.rand.int(1, 1000) },
            { category: categories[0] as string, value: ctx.rand.int(1, 1000) },
            { category: categories[0] as string, value: ctx.rand.int(1, 1000) }
          ];
          const ingest = await post('/api/ingest', { rows: fresh });
          if (ingest.status < 200 || ingest.status > 299) {
            throw new CheckFailed(
              `POST /api/ingest (re-ingest) returned ${ingest.status}, expected 2xx`
            );
          }
          const trace = await query('count');
          const body = asRecord(await jsonBody(trace, 'count after re-ingest'));
          const result = body === null ? null : asNumber(body.result);
          if (result !== fresh.length) {
            throw new CheckFailed(
              `count after re-ingest returned ${JSON.stringify(result)}, expected ${fresh.length}`
            );
          }
        }
      },
      {
        id: 'q-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
