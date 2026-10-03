import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { fetchHtml } from '../../core/http.ts';
import { findButton, findLink, pageText } from '../../core/ui.ts';

/**
 * Landing page challenge verifier.
 *
 * Contract (see specs/landing-page.md): a marketing landing page with hero
 * (h1), features section, call-to-action control, and pricing section; served
 * as HTML with a viewport meta tag and no console errors. HTTP-level checks
 * run first (fast, browser-free), then render-level checks.
 */

const CTA_PATTERN =
  /(get started|start now|start building|sign[\s-]?up|try now|try it|join now|join us|book a|request a|contact us|get .{0,20} now|start free|launch)/i;

interface LandingState {
  renderedOk: boolean;
}

export const landingPageVerifier: ChallengeVerifier = {
  meta: {
    id: 'landing-page',
    name: 'Landing page that converts',
    description:
      'Marketing landing page with hero, features, CTA and pricing (SPE-55 challenge 4)',
    specPath: 'specs/landing-page.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: LandingState = { renderedOk: false };

    async function openPage() {
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
      state.renderedOk = true;
      return page;
    }

    return [
      {
        id: 'land-http-ok-html',
        name: 'Root URL serves HTML with HTTP 200',
        severity: 'required',
        run: async () => {
          const trace = await fetchHtml(ctx.targetUrl);
          await ctx.evidence.saveJson('01-http-trace.json', trace);
        }
      },
      {
        id: 'land-title',
        name: 'Page has a non-empty <title>',
        severity: 'required',
        run: async () => {
          const trace = await fetchHtml(ctx.targetUrl);
          const match = trace.bodyText.match(/<title[^>]*>([^<]*)<\/title>/i);
          const title = match === null ? '' : match[1]?.trim() ?? '';
          if (title.length === 0) {
            throw new CheckFailed('No non-empty <title> element found in the HTML');
          }
        }
      },
      {
        id: 'land-viewport-meta',
        name: 'HTML declares a viewport meta tag',
        severity: 'required',
        run: async () => {
          const trace = await fetchHtml(ctx.targetUrl);
          if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(trace.bodyText)) {
            throw new CheckFailed(
              'No <meta name="viewport"> tag found (page is not mobile-ready)'
            );
          }
        }
      },
      {
        id: 'land-hero-h1',
        name: 'Hero section with a visible, non-empty h1',
        severity: 'required',
        run: async () => {
          const page = await openPage();
          const h1 = page.locator('h1');
          let found = false;
          const count = await h1.count();
          for (let i = 0; i < count; i += 1) {
            const heading = h1.nth(i);
            if (!(await heading.isVisible().catch(() => false))) {
              continue;
            }
            const text = (await heading.innerText().catch(() => '')).trim();
            if (text.length > 0) {
              found = true;
              break;
            }
          }
          if (!found) {
            await ctx.session.screenshot(page, '02-no-hero.png');
            throw new CheckFailed('No visible non-empty <h1> found (hero heading)');
          }
          await ctx.session.screenshot(page, '02-hero.png');
        }
      },
      {
        id: 'land-features',
        name: 'Features section is present',
        severity: 'required',
        run: async () => {
          const page = await openPage();
          const heading = page
            .locator('h1, h2, h3, h4, [role="heading"]')
            .filter({ hasText: /feature/i });
          if ((await heading.count()) === 0) {
            // Fallback signal: several feature-like blocks.
            const blocks = page.locator('h3, h2');
            if ((await blocks.count()) < 3) {
              await ctx.session.screenshot(page, '03-no-features.png');
              throw new CheckFailed(
                'No features section found (no "features" heading and fewer than 3 feature-like headings)'
              );
            }
          }
        }
      },
      {
        id: 'land-cta',
        name: 'A call-to-action control is present and visible',
        severity: 'required',
        run: async () => {
          const page = await openPage();
          const cta =
            (await findButton(page, CTA_PATTERN)) ??
            (await findLink(page, CTA_PATTERN));
          if (cta === null) {
            await ctx.session.screenshot(page, '04-no-cta.png');
            throw new CheckFailed(
              'No visible CTA button/link found (expected action text like "Get started", "Sign up", "Try it")'
            );
          }
          await ctx.evidence.saveText(
            '04-cta.txt',
            `CTA found: ${(await cta.innerText().catch(() => '')).trim()}`
          );
        }
      },
      {
        id: 'land-pricing',
        name: 'Pricing section is present',
        severity: 'required',
        run: async () => {
          const page = await openPage();
          const text = await pageText(page);
          if (!/pricing|prices?\b|plans?\b/i.test(text)) {
            await ctx.session.screenshot(page, '05-no-pricing.png');
            throw new CheckFailed(
              'No pricing content found (expected "pricing", "price" or "plans" copy)'
            );
          }
        }
      },
      {
        id: 'land-mobile-no-overflow',
        name: 'No horizontal overflow at mobile width (bonus capability probe)',
        severity: 'bonus',
        run: async () => {
          const page = await ctx.session.newPage();
          await page.setViewportSize({ width: 375, height: 667 });
          await page.goto(ctx.targetUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          const overflowing = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          );
          if (overflowing > 1) {
            await ctx.session.screenshot(page, '06-mobile-overflow.png');
            throw new CheckFailed(
              `Page is ${overflowing}px wider than the 375px mobile viewport (horizontal scroll)`
            );
          }
        }
      },
      {
        id: 'land-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          if (!state.renderedOk) {
            // No browser page was ever successfully opened; HTTP-level
            // failures will have already failed the run.
            throw new CheckFailed('Landing page never rendered in a browser');
          }
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
