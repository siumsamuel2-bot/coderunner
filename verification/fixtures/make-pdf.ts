import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

/**
 * Deterministic fixture PDF generator.
 *
 * Produces a minimal, valid single-page PDF whose text layer contains the
 * harness marker phrase plus supporting copy. The PDF analyzer verifier
 * uploads this file and asserts the marker appears in the app's output.
 *
 * Run standalone to (re)generate fixtures/sample.pdf:
 *   node fixtures/make-pdf.ts
 */

export const PDF_MARKER_TEXT = 'VERIFICATION FIXTURE ALPHA';

const SECONDARY_LINES = [
  'The quick brown fox jumps over the lazy dog.',
  'Coderunner verification sample 42. This text exists so the',
  'extraction check can assert on content that cannot be faked',
  'without actually parsing the document.'
];

/** Escapes a string for use inside a PDF literal string. */
function escapePdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Builds the complete fixture PDF as raw bytes. */
export function buildSamplePdf(): Uint8Array {
  const objects: string[] = [];

  const contentLines = [
    'BT',
    '/F1 20 Tf',
    '72 720 Td',
    `(${escapePdfString(PDF_MARKER_TEXT)}) Tj`,
    '/F1 12 Tf',
    '0 -28 Td',
    ...SECONDARY_LINES.flatMap((line) => [
      `(${escapePdfString(line)}) Tj`,
      '0 -16 Td'
    ]),
    'ET'
  ];
  const content = contentLines.join('\n');
  const contentLength = Buffer.byteLength(content, 'latin1');

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

/** Standalone regeneration of fixtures/sample.pdf. */
async function main(): Promise<void> {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const target = path.join(here, 'sample.pdf');
  const bytes = buildSamplePdf();
  await fs.writeFile(target, bytes);
  console.log(`Wrote ${target} (${bytes.byteLength} bytes)`);
}

if (process.argv[1] !== undefined) {
  const invoked = path.resolve(process.argv[1]);
  const self = path.resolve(url.fileURLToPath(import.meta.url));
  if (invoked === self) {
    await main();
  }
}
