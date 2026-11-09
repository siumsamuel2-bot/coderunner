import type { Check } from '../../core/types.ts';
import { CheckFailed } from '../../core/types.ts';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import type { FetchOptions, HttpTrace } from '../../core/http.ts';
import { fetchTrace } from '../../core/http.ts';

/**
 * SQL Scores API challenge verifier.
 *
 * Track: SQL/Data (SPE-163 / SPE-107 week-6 cadence).
 * Contract (see specs/sql-scores-api.md): a same-origin scores API under
 * /api/scores - POST creates { player, score } records, GET lists them with
 * SQL-style WHERE (player, minScore) / ORDER BY (order, dir) / LIMIT, DELETE
 * removes by id. Every ordering/filter check is scoped to a run-unique
 * player so leftover records from earlier runs cannot pollute expectations.
 */

interface ScoreRecord {
  id: string;
  player: string;
  score: number;
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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Extracts { id, player, score } from a list entry, tolerating id absence. */
function readEntry(entry: unknown, label: string): Partial<ScoreRecord> {
  const record = asRecord(entry);
  if (record === null) {
    throw new CheckFailed(`${label}: list entry is not a JSON object`);
  }
  const id = asString(record.id) ?? (record.id !== undefined ? String(record.id) : '');
  const player = asString(record.player);
  const score = asNumber(record.score);
  return { id, player: player ?? undefined, score: score ?? undefined };
}

export const sqlScoresApiVerifier: ChallengeVerifier = {
  meta: {
    id: 'sql-scores-api',
    name: 'SQL Scores API',
    description:
      'SQL-style scores API: create records, then WHERE (player, minScore) / ORDER BY / LIMIT listings and DELETE by id (SQL/Data track)',
    specPath: 'specs/sql-scores-api.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const base = ctx.targetUrl;

    // All records in this run share one run-unique player so WHERE player
    // isolates our records from any leftovers of earlier runs.
    const player = `sql-${ctx.rand.token(8)}`;
    const seeded: { score: number }[] = [];
    while (seeded.length < 8) {
      const score = ctx.rand.int(100, 9900);
      if (seeded.some((entry) => entry.score === score)) continue;
      seeded.push({ score });
    }
    const scores = seeded.map((entry) => entry.score);
    const sortedDesc = [...scores].sort((a, b) => b - a);
    const sortedAsc = [...scores].sort((a, b) => a - b);
    // Threshold strictly between the minimum and maximum seeded scores, so
    // the filtered subset is guaranteed non-trivial (not all, not none).
    const threshold = ctx.rand.int(sortedAsc[1] as number, (sortedAsc[sortedAsc.length - 2] as number) - 1);
    const expectedFiltered = scores.filter((score) => score >= threshold);

    const created: string[] = [];

    const post = async (body: unknown): Promise<HttpTrace> => {
      const options: FetchOptions = {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body)
      };
      return fetchTrace(apiUrl(base, '/api/scores'), options);
    };

    const list = async (queryString?: string): Promise<HttpTrace> =>
      fetchTrace(apiUrl(base, `/api/scores${queryString ?? ''}`));

    const expectStatus = (label: string, trace: HttpTrace, min: number, max: number): void => {
      if (trace.status < min || trace.status > max) {
        throw new CheckFailed(`${label} returned ${trace.status} ${trace.statusText}, expected ${min}-${max}`);
      }
    };

    return [
      {
        id: 's-root-loads',
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
        id: 's-create-echoes',
        name: 'POST /api/scores creates records echoing id, player and score',
        severity: 'required',
        requires: ['s-root-loads'],
        run: async () => {
          for (let i = 0; i < seeded.length; i += 1) {
            const score = (seeded[i] as { score: number }).score;
            const trace = await post({ player, score });
            await ctx.evidence.saveJson(`02-create-${i}.json`, {
              player,
              score,
              status: trace.status,
              bodyText: trace.bodyText
            });
            expectStatus(`POST /api/scores (score=${score})`, trace, 200, 299);
            const body = asRecord(await jsonBody(trace, `POST /api/scores (score=${score})`));
            if (body === null) {
              throw new CheckFailed('POST /api/scores did not return a JSON object');
            }
            const id = asString(body.id) ?? (body.id !== undefined ? String(body.id) : '');
            if (id.trim() === '') {
              throw new CheckFailed('POST /api/scores response has no non-empty id');
            }
            if (asString(body.player) !== player) {
              throw new CheckFailed(
                `POST /api/scores echoed player ${JSON.stringify(body.player)}, expected ${JSON.stringify(player)}`
              );
            }
            const echoed = asNumber(body.score);
            if (echoed !== score) {
              throw new CheckFailed(
                `POST /api/scores echoed score ${JSON.stringify(body.score)}, expected ${score}`
              );
            }
            created.push(id);
          }
        }
      },
      {
        id: 's-list-contains',
        name: 'GET /api/scores contains every created record',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const trace = await list();
          expectStatus('GET /api/scores', trace, 200, 299);
          const body = await jsonBody(trace, 'GET /api/scores');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/scores did not return a JSON array');
          }
          const listedIds = new Set(
            body.map((entry) => readEntry(entry, 'GET /api/scores').id ?? '')
          );
          for (const id of created) {
            if (!listedIds.has(id)) {
              throw new CheckFailed(`created record ${id} is missing from GET /api/scores`);
            }
          }
        }
      },
      {
        id: 's-player-filter',
        name: 'GET /api/scores?player=<seeded> returns exactly the seeded records',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const trace = await list(`?player=${encodeURIComponent(player)}`);
          expectStatus('GET /api/scores?player=...', trace, 200, 299);
          const body = await jsonBody(trace, 'GET /api/scores?player');
          if (!Array.isArray(body)) {
            throw new CheckFailed('GET /api/scores?player did not return a JSON array');
          }
          if (body.length !== seeded.length) {
            throw new CheckFailed(
              `GET /api/scores?player returned ${body.length} records, expected ${seeded.length}`
            );
          }
          for (const entry of body) {
            const record = readEntry(entry, 'GET /api/scores?player');
            if (record.player !== player) {
              throw new CheckFailed(
                `GET /api/scores?player returned a record for player ${JSON.stringify(record.player)}`
              );
            }
          }
        }
      },
      {
        id: 's-top-k-desc',
        name: 'ORDER BY score DESC LIMIT 3 returns the seeded top-3 in order',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const trace = await list(
            `?player=${encodeURIComponent(player)}&order=score&dir=desc&limit=3`
          );
          expectStatus('GET /api/scores?order=score&dir=desc&limit=3', trace, 200, 299);
          const body = await jsonBody(trace, 'top-3 desc');
          if (!Array.isArray(body)) {
            throw new CheckFailed('top-3 listing did not return a JSON array');
          }
          if (body.length !== 3) {
            throw new CheckFailed(`top-3 listing returned ${body.length} records, expected 3`);
          }
          const listed = body.map((entry) => readEntry(entry, 'top-3 listing').score);
          for (let i = 0; i < 3; i += 1) {
            if (listed[i] !== sortedDesc[i]) {
              throw new CheckFailed(
                `top-3 position ${i} returned ${JSON.stringify(listed[i])}, expected ${sortedDesc[i]}`
              );
            }
          }
        }
      },
      {
        id: 's-minscore-filter',
        name: 'minScore WHERE filter returns exactly the qualifying records',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const trace = await list(
            `?player=${encodeURIComponent(player)}&minScore=${threshold}`
          );
          expectStatus(`GET /api/scores?minScore=${threshold}`, trace, 200, 299);
          const body = await jsonBody(trace, `GET /api/scores?minScore=${threshold}`);
          if (!Array.isArray(body)) {
            throw new CheckFailed('minScore listing did not return a JSON array');
          }
          const listed = body
            .map((entry) => readEntry(entry, 'minScore listing').score)
            .filter((score): score is number => typeof score === 'number');
          if (listed.length !== expectedFiltered.length) {
            throw new CheckFailed(
              `minScore=${threshold} returned ${listed.length} records, expected ${expectedFiltered.length}`
            );
          }
          for (const score of listed) {
            if (score < threshold) {
              throw new CheckFailed(
                `minScore=${threshold} listing contains a record with score ${score}`
              );
            }
          }
        }
      },
      {
        id: 's-asc-order',
        name: 'ORDER BY score ASC returns scores in ascending order',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const trace = await list(
            `?player=${encodeURIComponent(player)}&order=score&dir=asc`
          );
          expectStatus('GET /api/scores?order=score&dir=asc', trace, 200, 299);
          const body = await jsonBody(trace, 'ascending listing');
          if (!Array.isArray(body)) {
            throw new CheckFailed('ascending listing did not return a JSON array');
          }
          const listed = body.map((entry) => readEntry(entry, 'ascending listing').score);
          if (listed.length !== sortedAsc.length) {
            throw new CheckFailed(
              `ascending listing returned ${listed.length} records, expected ${sortedAsc.length}`
            );
          }
          for (let i = 0; i < listed.length; i += 1) {
            if (listed[i] !== sortedAsc[i]) {
              throw new CheckFailed(
                `ascending listing position ${i} returned ${JSON.stringify(listed[i])}, expected ${sortedAsc[i]}`
              );
            }
          }
        }
      },
      {
        id: 's-delete-removes',
        name: 'DELETE /api/scores/{id} removes the record from the listing',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const victim = created[0];
          if (victim === undefined) {
            throw new CheckFailed('no created record available to delete');
          }
          const del = await fetchTrace(apiUrl(base, `/api/scores/${encodeURIComponent(victim)}`), {
            method: 'DELETE'
          });
          await ctx.evidence.saveJson('03-delete-trace.json', {
            id: victim,
            status: del.status,
            bodyText: del.bodyText
          });
          expectStatus(`DELETE /api/scores/${victim}`, del, 200, 299);
          const trace = await list(`?player=${encodeURIComponent(player)}`);
          const body = await jsonBody(trace, 'listing after delete');
          if (!Array.isArray(body)) {
            throw new CheckFailed('listing after delete did not return a JSON array');
          }
          const listedIds = new Set(
            body.map((entry) => readEntry(entry, 'listing after delete').id ?? '')
          );
          if (listedIds.has(victim)) {
            throw new CheckFailed(`deleted record ${victim} is still present in the listing`);
          }
        }
      },
      {
        id: 's-delete-unknown-404',
        name: 'DELETE of an unknown id returns 404',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          const missing = `missing-${ctx.rand.token(10)}`;
          const del = await fetchTrace(apiUrl(base, `/api/scores/${encodeURIComponent(missing)}`), {
            method: 'DELETE'
          });
          await ctx.evidence.saveJson('04-delete-unknown.json', {
            id: missing,
            status: del.status
          });
          if (del.status !== 404) {
            throw new CheckFailed(
              `DELETE /api/scores/${missing} returned ${del.status}, expected 404`
            );
          }
        }
      },
      {
        id: 's-validation-limit',
        name: 'Invalid limit values are rejected with 4xx',
        severity: 'required',
        requires: ['s-create-echoes'],
        run: async () => {
          for (const limit of ['0', 'abc']) {
            const trace = await list(
              `?player=${encodeURIComponent(player)}&limit=${limit}`
            );
            await ctx.evidence.saveJson(`05-validation-limit-${limit}.json`, {
              limit,
              status: trace.status
            });
            if (trace.status < 400 || trace.status > 499) {
              throw new CheckFailed(
                `GET /api/scores?limit=${limit} returned ${trace.status}, expected 4xx`
              );
            }
          }
        }
      },
      {
        id: 's-validation-create',
        name: 'POST /api/scores without a score is rejected with 4xx',
        severity: 'required',
        requires: ['s-root-loads'],
        run: async () => {
          const trace = await post({ player: `broken-${ctx.rand.token(6)}` });
          await ctx.evidence.saveJson('06-validation-create.json', {
            status: trace.status,
            bodyText: trace.bodyText
          });
          if (trace.status < 400 || trace.status > 499) {
            throw new CheckFailed(
              `POST /api/scores without score returned ${trace.status}, expected 4xx`
            );
          }
        }
      },
      {
        id: 's-json-content-type',
        name: 'Listing responses are served as application/json (bonus)',
        severity: 'bonus',
        requires: ['s-list-contains'],
        run: async () => {
          const trace = await list(`?player=${encodeURIComponent(player)}`);
          const contentType = trace.contentType ?? '';
          if (!contentType.toLowerCase().includes('application/json')) {
            throw new CheckFailed(
              `GET /api/scores content-type was "${contentType || 'unknown'}", expected application/json`
            );
          }
        }
      },
      {
        id: 's-no-console-errors',
        name: 'No console errors while loading the base URL (bonus)',
        severity: 'bonus',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
