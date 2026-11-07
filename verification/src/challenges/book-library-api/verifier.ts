import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { FetchOptions, HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * Book Library REST API challenge verifier (SPE-158, week-4 `apis` category).
 *
 * Contract (see specs/book-library-api.md): a same-origin JSON API under
 * /api/books supporting GET list, POST create, GET by id and DELETE by id,
 * plus 4xx validation on a create without a title. Verified over HTTP with
 * seeded random titles/authors so hardcoded catalogs cannot pass.
 */

interface ApiState {
  bookId: string | null;
  title: string | null;
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

/** Normalizes an id field (string or number) to a non-empty string. */
function idToString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export const bookLibraryApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'book-library-api',
    name: 'Book Library REST API',
    description:
      'JSON REST API for a book library: list / create / read / delete books over HTTP (SPE-158)',
    specPath: 'specs/book-library-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;
    const state: ApiState = { bookId: null, title: null };

    const createBook = async (title: string, author: string): Promise<HttpTrace> => {
      const options: FetchOptions = {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ title, author })
      };
      return fetchTrace(apiUrl(base, '/api/books'), options);
    };

    return [
      {
        id: 'book-root-loads',
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
          // Capture the page (and any console errors) for the bonus check.
          // Non-HTML roots are tolerated: the HTTP status above is the source
          // of truth for this challenge.
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
            // Navigation failures do not fail this check.
          }
        }
      },
      {
        id: 'book-list-json-array',
        name: 'GET /api/books returns a JSON array',
        severity: 'required',
        requires: ['book-root-loads'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/books'));
          await ctx.evidence.saveJson('02-list-trace.json', trace);
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `GET /api/books returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = await jsonBody(trace, 'GET /api/books');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/books did not return a JSON array');
          }
        }
      },
      {
        id: 'book-create',
        name: 'POST /api/books creates a book and returns its id',
        severity: 'required',
        requires: ['book-root-loads'],
        run: async () => {
          const title = ctx.rand.phrase();
          const author = ctx.rand.phrase();
          const trace = await createBook(title, author);
          await ctx.evidence.saveJson('03-create-trace.json', {
            request: { title, author },
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `POST /api/books returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'POST /api/books'));
          if (body === null) {
            throw new CheckFailed('POST /api/books did not return a JSON object');
          }
          const id = idToString(body.id);
          if (id === null) {
            throw new CheckFailed('created book is missing a non-empty "id"');
          }
          if (body.title !== title) {
            throw new CheckFailed(
              `created book title was ${JSON.stringify(body.title)}, expected ${JSON.stringify(title)}`
            );
          }
          state.bookId = id;
          state.title = title;
        }
      },
      {
        id: 'book-read-by-id',
        name: 'GET /api/books/{id} returns the created book',
        severity: 'required',
        requires: ['book-create'],
        run: async () => {
          const id = state.bookId;
          const title = state.title;
          if (id === null || title === null) {
            throw new CheckFailed('no created book (book-create must pass first)');
          }
          const trace = await fetchTrace(
            apiUrl(base, `/api/books/${encodeURIComponent(id)}`)
          );
          await ctx.evidence.saveJson('04-read-trace.json', {
            id,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `GET /api/books/${id} returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, `GET /api/books/${id}`));
          if (body === null || idToString(body.id) !== id || body.title !== title) {
            throw new CheckFailed(
              `GET /api/books/${id} did not return the created book (id ${id}, title ${JSON.stringify(title)})`
            );
          }
        }
      },
      {
        id: 'book-appears-in-list',
        name: 'The created book is present in GET /api/books',
        severity: 'required',
        requires: ['book-create'],
        run: async () => {
          const id = state.bookId;
          const title = state.title;
          if (id === null || title === null) {
            throw new CheckFailed('no created book (book-create must pass first)');
          }
          const trace = await fetchTrace(apiUrl(base, '/api/books'));
          await ctx.evidence.saveJson('05-list-after-create.json', {
            id,
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `GET /api/books returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = await jsonBody(trace, 'GET /api/books');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/books did not return a JSON array');
          }
          const found = body.some((entry) => {
            const record = asRecord(entry);
            if (record === null) {
              return false;
            }
            return idToString(record.id) === id || record.title === title;
          });
          if (!found) {
            throw new CheckFailed(
              `created book (id ${id}, title ${JSON.stringify(title)}) not present in GET /api/books`
            );
          }
        }
      },
      {
        id: 'book-delete',
        name: 'DELETE /api/books/{id} removes the book (404 afterwards)',
        severity: 'required',
        requires: ['book-create'],
        run: async () => {
          const id = state.bookId;
          if (id === null) {
            throw new CheckFailed('no created book (book-create must pass first)');
          }
          const del = await fetchTrace(
            apiUrl(base, `/api/books/${encodeURIComponent(id)}`),
            { method: 'DELETE' }
          );
          await ctx.evidence.saveJson('06-delete-trace.json', {
            id,
            status: del.status,
            bodyText: del.bodyText
          });
          if (del.status < 200 || del.status > 299) {
            throw new CheckFailed(
              `DELETE /api/books/${id} returned ${del.status} ${del.statusText}, expected 2xx`
            );
          }
          const after = await fetchTrace(
            apiUrl(base, `/api/books/${encodeURIComponent(id)}`)
          );
          await ctx.evidence.saveJson('07-deleted-get-trace.json', {
            id,
            status: after.status
          });
          if (after.status !== 404) {
            throw new CheckFailed(
              `GET /api/books/${id} after delete returned ${after.status}, expected 404`
            );
          }
        }
      },
      {
        id: 'book-validation',
        name: 'POST /api/books without a title is rejected with 4xx',
        severity: 'required',
        requires: ['book-root-loads'],
        run: async () => {
          const options: FetchOptions = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ author: ctx.rand.phrase() })
          };
          const trace = await fetchTrace(apiUrl(base, '/api/books'), options);
          await ctx.evidence.saveJson('08-validation-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `POST /api/books without a title returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 'book-json-content-type',
        name: 'API responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['book-list-json-array'],
        run: async () => {
          const trace = await fetchTrace(apiUrl(base, '/api/books'));
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `GET /api/books content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 'book-distinct-ids',
        name: 'Creating two books yields distinct ids (bonus)',
        severity: 'bonus',
        requires: ['book-create'],
        run: async () => {
          const first = state.bookId;
          if (first === null) {
            throw new CheckFailed('no created book (book-create must pass first)');
          }
          const trace = await createBook(ctx.rand.phrase(), ctx.rand.phrase());
          await ctx.evidence.saveJson('09-second-create-trace.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 200 || trace.status > 299) {
            throw new CheckFailed(
              `second POST /api/books returned ${trace.status} ${trace.statusText}, expected 2xx`
            );
          }
          const body = asRecord(await jsonBody(trace, 'POST /api/books'));
          const second = body === null ? null : idToString(body.id);
          if (second === null) {
            throw new CheckFailed('second created book is missing a non-empty "id"');
          }
          if (second === first) {
            throw new CheckFailed(
              `second POST /api/books reused id ${first}; ids must be unique`
            );
          }
        }
      },
      {
        id: 'book-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
