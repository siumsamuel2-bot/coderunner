/**
 * HTTP-level check helpers. Node built-in fetch only; no browser involved.
 * Every request is timed and recorded as a serializable trace for evidence.
 */

export interface HttpTrace {
  readonly url: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly contentType: string | null;
  readonly headers: Record<string, string>;
  readonly bodyBytes: number;
  /** First 64 KiB of the body as text (binary-safe replacement chars). */
  readonly bodyText: string;
  readonly durationMs: number;
  readonly at: string;
}

export interface FetchOptions {
  readonly timeoutMs?: number;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  /** Max bytes of the body to keep in the trace (default 64 KiB). */
  readonly maxBodyBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 64 * 1024;

export async function fetchTrace(url: string, options: FetchOptions = {}): Promise<HttpTrace> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      redirect: 'follow',
      signal: controller.signal
    };
    if (options.headers !== undefined) {
      init.headers = options.headers;
    }
    if (options.body !== undefined) {
      init.body = options.body;
    }
    const response = await fetch(url, init);
    const buffer = new Uint8Array(await response.arrayBuffer());
    const sliced = buffer.subarray(0, options.maxBodyBytes ?? MAX_BODY_BYTES);
    let bodyText = '';
    if (sliced.byteLength > 0) {
      bodyText = new TextDecoder('utf-8', { fatal: false }).decode(sliced);
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      headers,
      bodyBytes: buffer.byteLength,
      bodyText,
      durationMs: Date.now() - started,
      at: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

export class HttpCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpCheckError';
  }
}

/** Fetches the page and asserts a successful (2xx) response. */
export async function fetchOk(url: string, options: FetchOptions = {}): Promise<HttpTrace> {
  const trace = await fetchTrace(url, options);
  if (trace.status < 200 || trace.status > 299) {
    throw new HttpCheckError(`GET ${url} returned ${trace.status} ${trace.statusText}`);
  }
  return trace;
}

/** Fetches the page and asserts a successful response with an HTML body. */
export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<HttpTrace> {
  const trace = await fetchOk(url, options);
  const contentType = trace.contentType ?? '';
  const looksHtml =
    contentType.includes('text/html') ||
    /^\s*<(?:!doctype|html|head|body)\b/i.test(trace.bodyText);
  if (!looksHtml) {
    throw new HttpCheckError(
      `GET ${url} did not return HTML (content-type: ${contentType || 'unknown'})`
    );
  }
  return trace;
}
