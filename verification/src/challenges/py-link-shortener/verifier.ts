import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { fetchHtml } from '../../core/http.ts';
import { findButton, findTextInput, pageText } from '../../core/ui.ts';

/**
 * Python Link Shortener challenge verifier (SPE-109, week-2 Python track).
 *
 * Contract (see specs/py-link-shortener.md): a URL input plus a shorten
 * button; each submission adds a visible short link pointing back at the
 * submission's own origin; fetching the short URL returns an HTTP 3xx
 * redirect whose Location header is the original long URL. Previously created
 * links remain listed.
 */

interface ShortenerState {
  page: Page | null;
  input: Locator | null;
  shortenButton: Locator | null;
  /** Absolute short URLs discovered on the page so far. */
  shortUrls: string[];
}

/** All absolute same-origin hrefs currently on the page. */
async function collectSameOriginLinks(page: Page, origin: string): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => a.getAttribute('href') ?? '')
  );
  const out: string[] = [];
  for (const href of hrefs) {
    try {
      const absolute = new URL(href, origin);
      if (absolute.origin === origin && absolute.pathname.length > 1) {
        out.push(absolute.toString());
      }
    } catch {
      // ignore malformed hrefs
    }
  }
  return out;
}

/** Text added to the page between a snapshot and now (line-set diff). */
async function newTextSince(page: Page, base: string): Promise<string> {
  const baseLines = new Set(
    base.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  );
  const now = await pageText(page);
  const additions = now
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !baseLines.has(l));
  return additions.join('\n');
}

export const pyLinkShortenerVerifier: ChallengeVerifier = {
  meta: {
    id: 'py-link-shortener',
    name: 'Python Link Shortener',
    description:
      'Python-backed link shortener: create short links that HTTP-redirect to the original URL (SPE-109)',
    specPath: 'specs/py-link-shortener.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: ShortenerState = { page: null, input: null, shortenButton: null, shortUrls: [] };

    const origin = new URL(ctx.targetUrl).origin;

    function randomLongUrl(): string {
      return `https://example.com/${ctx.rand.token(10)}?ref=${ctx.rand.token(4)}`;
    }

    async function openPage(): Promise<Page> {
      const page = await ctx.session.newPage();
      const response = await page.goto(ctx.targetUrl, {
        waitUntil: 'domcontentloaded'
      });
      if (response === null || response.status() >= 400) {
        throw new CheckFailed(
          `Target returned HTTP ${response === null ? 'unknown' : response.status()}`
        );
      }
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      state.page = page;
      return page;
    }

    /** Shorten a long URL, returning newly added page text and new links. */
    async function shorten(longUrl: string): Promise<{ newText: string; newLinks: string[] }> {
      const page = state.page;
      const input = state.input;
      const button = state.shortenButton;
      if (page === null || input === null || button === null) {
        throw new CheckFailed('Missing page/input/button (earlier checks must pass first)');
      }
      const beforeText = await pageText(page);
      const beforeLinks = new Set(await collectSameOriginLinks(page, origin));
      await input.click();
      await input.selectText().catch(() => undefined);
      await page.keyboard.press('Delete').catch(() => undefined);
      await input.fill(longUrl);
      await button.click();
      // Link creation may be async (fetch -> re-render).
      let newLinks: string[] = [];
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(300);
        newLinks = (await collectSameOriginLinks(page, origin)).filter(
          (href) => !beforeLinks.has(href)
        );
        if (newLinks.length > 0) {
          break;
        }
      }
      const newText = await newTextSince(page, beforeText);
      return { newText, newLinks };
    }

    return [
      {
        id: 'url-page-loads',
        name: 'Page loads (HTTP < 400, HTML served)',
        severity: 'required',
        run: async () => {
          const trace = await fetchHtml(ctx.targetUrl);
          await ctx.evidence.saveJson('01-http-trace.json', trace);
          const page = await openPage();
          await ctx.session.screenshot(page, '01-loaded.png');
        }
      },
      {
        id: 'url-form-present',
        name: 'A URL input and a shorten/submit button are discoverable',
        severity: 'required',
        requires: ['url-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input = await findTextInput(page, {
            prefer: /url|link|address|website|target/i,
            exclude: /search/i,
            kind: 'any'
          });
          if (input === null) {
            await ctx.session.screenshot(page, '02-no-input.png');
            throw new CheckFailed('No visible editable text input found for the long URL');
          }
          state.input = input;
          const button = await findButton(page, /shorten|create|add|submit|save|shrink/i);
          if (button === null) {
            await ctx.session.screenshot(page, '02-no-button.png');
            throw new CheckFailed('No visible shorten/submit button found');
          }
          state.shortenButton = button;
        }
      },
      {
        id: 'url-shorten-appears',
        name: 'Shortening a URL adds a visible same-origin short link',
        severity: 'required',
        requires: ['url-form-present'],
        run: async () => {
          const longUrl = randomLongUrl();
          const { newText, newLinks } = await shorten(longUrl);
          state.shortUrls.push(...newLinks);
          await ctx.evidence.saveJson('02-shorten-result.json', { longUrl, newText, newLinks });
          // Either a new anchor appeared, or new text mentions the origin with a path.
          const textLink = new RegExp(
            `${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[\\w.-]{3,}`
          );
          if (newLinks.length === 0 && !textLink.test(newText)) {
            const page = state.page;
            if (page !== null) {
              await ctx.session.screenshot(page, '03-no-short-link.png');
            }
            throw new CheckFailed(
              `No short link surfaced after submitting ${longUrl}; new text was "${newText.slice(0, 200)}"`
            );
          }
        }
      },
      {
        id: 'url-redirect-works',
        name: 'The short link HTTP-redirects (3xx) to the original URL',
        severity: 'required',
        requires: ['url-shorten-appears'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          let shortUrl = state.shortUrls[0];
          if (shortUrl === undefined) {
            // Link was rendered as text, not an anchor: try to recover it from page text.
            const text = await pageText(page);
            const match = text.match(
              new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[\\w.-]{3,}`)
            );
            if (match === null) {
              throw new CheckFailed('No short URL available to test redirect');
            }
            shortUrl = match[0];
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15_000);
          try {
            const response = await fetch(shortUrl, {
              redirect: 'manual',
              signal: controller.signal
            });
            await ctx.evidence.saveJson('03-redirect-trace.json', {
              shortUrl,
              status: response.status,
              location: response.headers.get('location')
            });
            if (response.status < 300 || response.status > 399) {
              throw new CheckFailed(
                `GET ${shortUrl} returned ${response.status}, expected a 3xx redirect`
              );
            }
            const location = response.headers.get('location');
            if (location === null || !location.startsWith('https://example.com/')) {
              throw new CheckFailed(
                `GET ${shortUrl} redirected to "${location ?? '<none>'}", expected the original example.com URL`
              );
            }
          } finally {
            clearTimeout(timer);
          }
        }
      },
      {
        id: 'url-second-link-persists',
        name: 'A second shortened URL is added and the first stays listed',
        severity: 'required',
        requires: ['url-shorten-appears'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const first = state.shortUrls[0];
          const secondLongUrl = randomLongUrl();
          const { newLinks } = await shorten(secondLongUrl);
          const allLinks = await collectSameOriginLinks(page, origin);
          await ctx.evidence.saveJson('04-links-after-second.json', { allLinks });
          const stillListed =
            first === undefined || allLinks.includes(first) || newLinks.length > 0;
          if (!stillListed) {
            throw new CheckFailed(
              `First short link ${first} no longer listed after creating a second link`
            );
          }
          if (newLinks.length === 0 && allLinks.length < 2) {
            throw new CheckFailed(
              `Second link did not appear; links on page: ${allLinks.join(', ')}`
            );
          }
          state.shortUrls.push(...newLinks);
        }
      },
      {
        id: 'url-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
