import { describe, expect, it } from 'vitest';
import { buildSamplePdf, PDF_MARKER_TEXT } from '../fixtures/make-pdf.ts';

describe('fixture PDF', () => {
  it('builds a deterministic document', () => {
    const first = buildSamplePdf();
    const second = buildSamplePdf();
    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
  });

  it('is structurally valid (header, xref, trailer, EOF)', () => {
    const text = Buffer.from(buildSamplePdf()).toString('latin1');
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Type /Page ');
  });

  it('has correct xref offsets', () => {
    const bytes = Buffer.from(buildSamplePdf());
    const text = bytes.toString('latin1');
    const xrefMatch = text.match(/xref\n0 (\d+)\n/);
    expect(xrefMatch).not.toBeNull();
    const count = Number(xrefMatch?.[1] ?? 0);
    const entries = text.match(/^\d{10} 00000 n /gm) ?? [];
    expect(entries.length).toBe(count - 1);
    // Every recorded offset must point at "N 0 obj".
    for (const line of entries) {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset, offset + 8)).toMatch(/^\d 0 obj/);
    }
  });

  it('contains the extraction marker in the text layer', () => {
    const text = Buffer.from(buildSamplePdf()).toString('latin1');
    expect(text).toContain(`(${PDF_MARKER_TEXT}) Tj`);
  });
});
