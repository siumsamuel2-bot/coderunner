import type { Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { pageText } from '../../core/ui.ts';
import * as path from 'node:path';

/**
 * PDF analyzer challenge verifier.
 *
 * Contract (see specs/pdf-analyzer.md): the app must accept a PDF file via a
 * standard file input, extract its text, and surface document metadata. The
 * harness uploads a known fixture PDF and asserts the marker text and a
 * metadata signal appear. No API shape is assumed - the UI flow is used.
 */

/** Marker phrase embedded in the fixture PDF. */
export const PDF_MARKER_TEXT = 'VERIFICATION FIXTURE ALPHA';

interface PdfState {
  page: Page | null;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

/** Waits until the page text contains the marker, up to the timeout. */
async function waitForMarker(
  page: Page,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await pageText(page);
    if (text.includes(PDF_MARKER_TEXT)) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

export const pdfAnalyzerVerifier: ChallengeVerifier = {
  meta: {
    id: 'pdf-analyzer',
    name: 'PDF analyzer',
    description:
      'Tool that accepts a PDF and extracts text/metadata (SPE-55 challenge 3)',
    specPath: 'specs/pdf-analyzer.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: PdfState = { page: null };
    const fixturePath = path.join(ctx.fixturesDir, 'sample.pdf');

    return [
      {
        id: 'pdf-page-loads',
        name: 'PDF analyzer page loads',
        severity: 'required',
        run: async () => {
          const page = await ctx.session.newPage();
          state.page = page;
          const response = await page.goto(ctx.targetUrl, {
            waitUntil: 'domcontentloaded'
          });
          if (response === null || response.status() >= 400) {
            throw new CheckFailed(
              `Target returned HTTP ${response === null ? 'unknown' : response.status()}`
            );
          }
          await settle(page);
          await ctx.session.screenshot(page, '01-loaded.png');
        }
      },
      {
        id: 'pdf-file-input',
        name: 'A file input for PDF upload is present',
        severity: 'required',
        requires: ['pdf-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const inputs = page.locator('input[type="file"]');
          if ((await inputs.count()) === 0) {
            throw new CheckFailed(
              'No <input type="file"> found on the page (uploads must use a standard file input)'
            );
          }
          const outerHtml = await inputs.first().evaluate((el) => el.outerHTML);
          await ctx.evidence.saveText('02-file-input.html', outerHtml);
        }
      },
      {
        id: 'pdf-extracts-text',
        name: 'Uploading the fixture PDF surfaces its extracted text',
        severity: 'required',
        requires: ['pdf-file-input'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input = page.locator('input[type="file"]').first();
          await input.setInputFiles(fixturePath);
          const found = await waitForMarker(page, 30_000);
          if (!found) {
            await ctx.session.screenshot(page, '03-no-extraction.png');
            throw new CheckFailed(
              `Extracted text "${PDF_MARKER_TEXT}" never appeared within 30s of upload`
            );
          }
          await ctx.session.screenshot(page, '03-extracted.png');
        }
      },
      {
        id: 'pdf-metadata',
        name: 'Document metadata is displayed (page count, file name, or size)',
        severity: 'required',
        requires: ['pdf-file-input'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const text = await pageText(page);
          const signals: string[] = [];
          if (/pages?\s*[:=]?\s*1\b/i.test(text) || /\b1\s*page\b/i.test(text)) {
            signals.push('page count');
          }
          if (/sample\.pdf/i.test(text)) {
            signals.push('file name');
          }
          if (/\b\d+(?:\.\d+)?\s*(?:kb|mb|bytes?)\b/i.test(text)) {
            signals.push('file size');
          }
          if (signals.length === 0) {
            await ctx.session.screenshot(page, '04-no-metadata.png');
            throw new CheckFailed(
              'No metadata signal found (expected page count, file name, or file size)'
            );
          }
          await ctx.evidence.saveJson('04-metadata-signals.json', signals);
        }
      },
      {
        id: 'pdf-shows-filesize',
        name: 'File size is displayed (bonus capability probe)',
        severity: 'bonus',
        requires: ['pdf-file-input'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const text = await pageText(page);
          if (!/\b\d+(?:\.\d+)?\s*(?:kb|mb|bytes?)\b/i.test(text)) {
            throw new CheckFailed('No file size indicator found in the UI');
          }
        }
      },
      {
        id: 'pdf-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          const page = state.page;
          if (page !== null) {
            await ctx.session.screenshot(page, '05-final.png');
          }
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
