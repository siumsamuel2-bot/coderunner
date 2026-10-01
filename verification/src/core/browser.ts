import type { Browser, Page } from 'playwright';
import { CheckFailed } from './types.ts';
import type { EvidenceStore } from './evidence.ts';

export interface ConsoleRecord {
  readonly type: 'error' | 'warning';
  readonly text: string;
  readonly pageUrl: string;
  readonly at: string;
}

/**
 * Owns a single Playwright browser instance for one challenge run and
 * collects console errors / page errors across all pages it opens, so the
 * "no console errors" check can run against the whole session.
 */
export class BrowserSession {
  private readonly browserPromise: Promise<Browser>;
  private readonly headless: boolean;
  private readonly evidence: EvidenceStore;
  private readonly defaultTimeoutMs: number;
  readonly consoleRecords: ConsoleRecord[] = [];
  readonly pageErrors: string[] = [];

  constructor(options: {
    readonly headless: boolean;
    readonly evidence: EvidenceStore;
    readonly defaultTimeoutMs: number;
  }) {
    this.headless = options.headless;
    this.evidence = options.evidence;
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.browserPromise = this.launch();
  }

  private async launch(): Promise<Browser> {
    const { chromium } = await import('playwright');
    return chromium.launch({
      headless: this.headless,
      args: ['--disable-dev-shm-usage']
    });
  }

  /** Opens a new page with console/page-error tracking wired up. */
  async newPage(): Promise<Page> {
    const browser = await this.browserPromise;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    });
    context.setDefaultTimeout(this.defaultTimeoutMs);
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleRecords.push({
          type: 'error',
          text: msg.text(),
          pageUrl: page.url(),
          at: new Date().toISOString()
        });
      } else if (msg.type() === 'warning') {
        this.consoleRecords.push({
          type: 'warning',
          text: msg.text(),
          pageUrl: page.url(),
          at: new Date().toISOString()
        });
      }
    });
    page.on('pageerror', (err) => {
      this.pageErrors.push(`${err.name}: ${err.message}`);
    });
    return page;
  }

  /** Captures a full-page screenshot into the evidence store. */
  async screenshot(page: Page, name: string): Promise<string> {
    const bytes = await page.screenshot({ fullPage: true });
    return this.evidence.saveBinary(name, bytes);
  }

  /** Saves the current DOM HTML snapshot into the evidence store. */
  async saveHtml(page: Page, name: string): Promise<string> {
    const html = await page.content();
    return this.evidence.saveText(name, html);
  }

  /** All console errors and uncaught page errors recorded this session. */
  failures(): string[] {
    return [
      ...this.consoleRecords.filter((r) => r.type === 'error').map((r) => `[console.error] ${r.text}`),
      ...this.pageErrors.map((e) => `[pageerror] ${e}`)
    ];
  }

  /** Throws CheckFailed when any console/page error was recorded. */
  assertNoConsoleErrors(): void {
    const failures = this.failures();
    if (failures.length > 0) {
      throw new CheckFailed(
        `${failures.length} console error(s)/page error(s) recorded during the session`,
        []
      );
    }
  }

  async close(): Promise<void> {
    const browser = await this.browserPromise;
    await browser.close().catch(() => undefined);
  }
}

/** Probes whether a headless browser can actually launch on this host. */
export async function canLaunchBrowser(headless: boolean): Promise<boolean> {
  let session: BrowserSession | null = null;
  try {
    session = new BrowserSession({
      headless,
      evidence: { saveBinary: async () => '' } as unknown as EvidenceStore,
      defaultTimeoutMs: 5_000
    });
    const page = await session.newPage();
    await page.setContent('<html><body>probe</body></html>');
    await session.close();
    session = null;
    return true;
  } catch {
    if (session !== null) {
      await session.close().catch(() => undefined);
    }
    return false;
  }
}
