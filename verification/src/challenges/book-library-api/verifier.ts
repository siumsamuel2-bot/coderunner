import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';

/**
 * Book library API challenge verifier (SPE-158, `apis` category).
 *
 * Contract (see specs/book-library-api.md): the submission must expose a JSON
 * REST API under `/api/books` supporting create, list, search, read, update and
 * delete, with validation and correct status codes. Checks are HTTP-level only
 * (no browser); the created record's id is used to prove real persistence.
 */

interface ApiResponse {
  readonly status: number;
  readonly contentType: string | null;
  readonly text: string;
  readonly json: unknown;
}

async function request(
  url: string,
  init: { method?: string; body?: string; timeoutMs?: number } = {}
): Promise<ApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? 15_000
  );
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      redirect: 'follow',
      signal: controller.signal,
      ...(init.body === undefined
        ? {}
        : { body: init.body, headers: { 'content-type': 'application/json' } })
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      text,
      json
    };
  } finally {
    clearTimeout(timer);
  }
}

function asArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['books', 'items', 'data', 'results']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return null;
}

function idOf(value: unknown): string | null {
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['id', '_id', 'bookId']) {
      if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
        return record[key] as string;
      }
    }
  }
  return null;
}

export const bookLibraryApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'book-library-api',
    name: 'Book library API',
    description:
      'REST API for a book library: CRUD, search, validation, correct status codes (SPE-158)',
    specPath: 'specs/book-library-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl.replace(/\/+$/, '');
    const state: { createdId: string | null; title: string; author: string } = {
      createdId: null,
      title: `${ctx.rand.phrase()} Handbook`,
      author: ctx.rand.phrase()
    };

    const bookUrl = (id: string): string => `${base}/api/books/${id}`;

    return [
      {
        id: 'books-api-page-loads',
        name: 'Base URL responds',
        severity: 'required',
        run: async () => {
          const res = await request(base, { timeoutMs: ctx.defaultTimeoutMs });
          if (res.status >= 400) {
            throw new CheckFailed(`Base URL returned HTTP ${res.status}`);
          }
        }
      },
      {
        id: 'books-api-create',
        name: 'POST /api/books creates a book (201)',
        severity: 'required',
        requires: ['books-api-page-loads'],
        run: async () => {
          const res = await request(`${base}/api/books`, {
            method: 'POST',
            body: JSON.stringify({ title: state.title, author: state.author })
          });
          if (res.status < 200 || res.status > 299) {
            throw new CheckFailed(
              `POST /api/books returned ${res.status} (expected 2xx/201). Body: ${res.text.slice(0, 200)}`
            );
          }
          const id = idOf(res.json);
          if (id === null) {
            throw new CheckFailed(
              `POST /api/books did not return a JSON object with an id. Body: ${res.text.slice(0, 200)}`
            );
          }
          state.createdId = id;
        }
      },
      {
        id: 'books-api-list',
        name: 'GET /api/books lists the created book',
        severity: 'required',
        requires: ['books-api-create'],
        run: async () => {
          const res = await request(`${base}/api/books`);
          if (res.status !== 200) {
            throw new CheckFailed(`GET /api/books returned ${res.status} (expected 200)`);
          }
          const list = asArray(res.json);
          if (list === null) {
            throw new CheckFailed('GET /api/books did not return a JSON array');
          }
          const found = list.some((item) => {
            const id = idOf(item);
            const title =
              item !== null && typeof item === 'object'
                ? (item as Record<string, unknown>).title
                : null;
            return id === state.createdId || title === state.title;
          });
          if (!found) {
            throw new CheckFailed('Created book is not present in GET /api/books');
          }
        }
      },
      {
        id: 'books-api-read',
        name: 'GET /api/books/:id returns the created book',
        severity: 'required',
        requires: ['books-api-create'],
        run: async () => {
          const id = state.createdId;
          if (id === null) {
            throw new CheckFailed('No created id');
          }
          const res = await request(bookUrl(id));
          if (res.status !== 200) {
            throw new CheckFailed(`GET /api/books/${id} returned ${res.status}`);
          }
          if (!res.text.includes(state.title)) {
            throw new CheckFailed(
              `GET /api/books/${id} body does not contain the created title`
            );
          }
        }
      },
      {
        id: 'books-api-search',
        name: 'GET /api/books?q= filters results',
        severity: 'required',
        requires: ['books-api-create'],
        run: async () => {
          const query = encodeURIComponent(state.title.split(' ')[0] ?? state.title);
          const res = await request(`${base}/api/books?q=${query}`);
          if (res.status !== 200) {
            throw new CheckFailed(`GET /api/books?q= returned ${res.status}`);
          }
          const list = asArray(res.json);
          if (list === null) {
            throw new CheckFailed('Search did not return a JSON array');
          }
          const contains = list.some((item) =>
            JSON.stringify(item).includes(state.title)
          );
          if (!contains) {
            throw new CheckFailed('Search did not return the matching created book');
          }
        }
      },
      {
        id: 'books-api-validation',
        name: 'POST /api/books with an invalid body returns 4xx',
        severity: 'required',
        requires: ['books-api-page-loads'],
        run: async () => {
          const res = await request(`${base}/api/books`, {
            method: 'POST',
            body: JSON.stringify({ title: '' })
          });
          if (res.status < 400 || res.status > 499) {
            throw new CheckFailed(
              `Invalid POST returned ${res.status} (expected a 4xx validation error)`
            );
          }
        }
      },
      {
        id: 'books-api-update',
        name: 'PATCH /api/books/:id updates a field (bonus)',
        severity: 'bonus',
        requires: ['books-api-read'],
        run: async () => {
          const id = state.createdId;
          if (id === null) {
            throw new CheckFailed('No created id');
          }
          const updated = `${state.title} v2`;
          const res = await request(bookUrl(id), {
            method: 'PATCH',
            body: JSON.stringify({ title: updated })
          });
          if (res.status < 200 || res.status > 299) {
            throw new CheckFailed(`PATCH returned ${res.status}`);
          }
          const check = await request(bookUrl(id));
          if (!check.text.includes(updated)) {
            throw new CheckFailed('Update did not persist on read-back');
          }
        }
      },
      {
        id: 'books-api-delete',
        name: 'DELETE /api/books/:id removes the book',
        severity: 'required',
        requires: ['books-api-read'],
        run: async () => {
          const id = state.createdId;
          if (id === null) {
            throw new CheckFailed('No created id');
          }
          const res = await request(bookUrl(id), { method: 'DELETE' });
          if (res.status < 200 || res.status > 299) {
            throw new CheckFailed(`DELETE returned ${res.status} (expected 2xx)`);
          }
          const after = await request(bookUrl(id));
          if (after.status !== 404) {
            throw new CheckFailed(
              `GET after DELETE returned ${after.status} (expected 404)`
            );
          }
        }
      }
    ];
  }
};
