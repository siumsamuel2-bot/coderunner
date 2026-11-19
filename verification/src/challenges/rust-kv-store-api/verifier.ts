import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { FetchOptions, HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * Rust Key-Value Store API challenge verifier.
 *
 * Track: Rust (new language track under the SPE-107 weekly cadence).
 * Contract (see specs/rust-kv-store-api.md): a same-origin JSON key-value API
 * under /api/kv supporting PUT create/overwrite, GET read, DELETE, list, 404
 * on unknown keys and 4xx validation on a missing value. Verified over HTTP
 * with seeded random keys and values, so a hardcoded store cannot pass.
 */

interface KvState {
  key: string;
  value: string;
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

/** Reads a string field, tolerating a missing id echo. */
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export const rustKvStoreApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'rust-kv-store-api',
    name: 'Rust Key-Value Store API',
    description:
      'Rust-backed JSON key-value store: put / get / delete / list keys over HTTP (Rust track)',
    specPath: 'specs/rust-kv-store-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;
    const state: KvState = {
      key: ctx.rand.token(10),
      value: ctx.rand.phrase()
    };
    const unknownKey = `missing-${ctx.rand.token(10)}`;

    const put = async (key: string, value: string): Promise<HttpTrace> => {
      const options: FetchOptions = {
        method: 'PUT',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ value })
      };
      return fetchTrace(apiUrl(base, `/api/kv/${encodeURIComponent(key)}`), options);
    };

    const get = async (key: string): Promise<HttpTrace> =>
      fetchTrace(apiUrl(base, `/api/kv/${encodeURIComponent(key)}`));

    return [
      {
        id: 'kv-root-loads',
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
        id: 'kv-put-creates',
        name: 'PUT /api/kv/{key} stores a value and echoes it',
        severity: 'required',
        requires: ['kv-root-loads'],
        run: async () => {
          const trace = await put(state.key, state.value);
          await ctx.evidence.saveJson('02-put-trace.json', {
            request: { key: state.key, value: state.value },
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `PUT /api/kv/${state.key} returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'PUT /api/kv'));
          if (body === null) {
            throw new CheckFailed('PUT /api/kv did not return a JSON object');
          }
          if (body.value !== state.value) {
            throw new CheckFailed(
              `PUT response value was ${JSON.stringify(body.value)}, expected ${JSON.stringify(state.value)}`
            );
          }
        }
      },
      {
        id: 'kv-get-reads',
        name: 'GET /api/kv/{key} returns the stored value',
        severity: 'required',
        requires: ['kv-put-creates'],
        run: async () => {
          const trace = await get(state.key);
          await ctx.evidence.saveJson('03-get-trace.json', {
            key: state.key,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `GET /api/kv/${state.key} returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'GET /api/kv/{key}'));
          if (body === null || asString(body.value) !== state.value) {
            throw new CheckFailed(
              `GET /api/kv/${state.key} did not return value ${JSON.stringify(state.value)}`
            );
          }
        }
      },
      {
        id: 'kv-get-unknown-404',
        name: 'GET of an unknown key returns 404',
        severity: 'required',
        requires: ['kv-root-loads'],
        run: async () => {
          const trace = await get(unknownKey);
          await ctx.evidence.saveJson('04-unknown-get-trace.json', {
            key: unknownKey,
            status: trace.status
          });
          if (trace.status !== 404) {
            throw new CheckFailed(
              `GET /api/kv/${unknownKey} returned ${trace.status}, expected 404`
            );
          }
        }
      },
      {
        id: 'kv-list-contains',
        name: 'GET /api/kv lists the stored key',
        severity: 'required',
        requires: ['kv-put-creates'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/kv'));
          await ctx.evidence.saveJson('05-list-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `GET /api/kv returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = await jsonBody(trace, 'GET /api/kv');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/kv did not return a JSON array');
          }
          const found = body.some((entry) => {
            if (typeof entry === 'string') {
              return entry === state.key;
            }
            const record = asRecord(entry);
            return record !== null && asString(record.key) === state.key;
          });
          if (!found) {
            throw new CheckFailed(`key "${state.key}" is not present in GET /api/kv`);
          }
        }
      },
      {
        id: 'kv-put-overwrites',
        name: 'PUT on an existing key overwrites the value',
        severity: 'required',
        requires: ['kv-get-reads'],
        run: async () => {
          const next = `${ctx.rand.phrase()} updated`;
          const trace = await put(state.key, next);
          await ctx.evidence.saveJson('06-overwrite-trace.json', {
            key: state.key,
            value: next,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `PUT (overwrite) /api/kv/${state.key} returned ${trace.status}, expected 2xx`
            );
          }
          const after = await get(state.key);
          const body = asRecord(await jsonBody(after, 'GET after overwrite'));
          if (body === null || asString(body.value) !== next) {
            throw new CheckFailed(
              `after overwrite GET returned ${JSON.stringify(body?.value)}, expected ${JSON.stringify(next)}`
            );
          }
          state.value = next;
        }
      },
      {
        id: 'kv-delete-removes',
        name: 'DELETE /api/kv/{key} removes the key (404 afterwards)',
        severity: 'required',
        requires: ['kv-put-creates'],
        run: async () => {
          const del = await fetchTrace(
            apiUrl(base, `/api/kv/${encodeURIComponent(state.key)}`),
            { method: 'DELETE' }
          );
          await ctx.evidence.saveJson('07-delete-trace.json', {
            key: state.key,
            status: del.status,
            bodyText: del.bodyText
          });
          if (del.status < 200 || del.status > 299) {
            throw new CheckFailed(
              `DELETE /api/kv/${state.key} returned ${del.status} ${del.statusText}, expected 2xx`
            );
          }
          const after = await get(state.key);
          await ctx.evidence.saveJson('08-deleted-get-trace.json', {
            key: state.key,
            status: after.status
          });
          if (after.status !== 404) {
            throw new CheckFailed(
              `GET /api/kv/${state.key} after delete returned ${after.status}, expected 404`
            );
          }
        }
      },
      {
        id: 'kv-validation',
        name: 'PUT without a value is rejected with 4xx',
        severity: 'required',
        requires: ['kv-root-loads'],
        run: async () => {
          const options: FetchOptions = {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
          };
          const trace = await fetchTrace(
            apiUrl(base, `/api/kv/${encodeURIComponent(ctx.rand.token(8))}`),
            options
          );
          await ctx.evidence.saveJson('09-validation-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `PUT /api/kv without a value returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 'kv-json-content-type',
        name: 'API responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['kv-list-contains'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/kv'));
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `GET /api/kv content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 'kv-list-excludes-deleted',
        name: 'List no longer contains the deleted key (bonus)',
        severity: 'bonus',
        requires: ['kv-delete-removes'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/kv'));
          const body = await jsonBody(trace, 'GET /api/kv');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/kv did not return a JSON array');
          }
          const stillThere = body.some((entry) => {
            if (typeof entry === 'string') {
              return entry === state.key;
            }
            const record = asRecord(entry);
            return record !== null && asString(record.key) === state.key;
          });
          if (stillThere) {
            throw new CheckFailed(
              `deleted key "${state.key}" is still present in GET /api/kv`
            );
          }
        }
      },
      {
        id: 'kv-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
