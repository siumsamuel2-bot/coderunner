import { describe, expect, it } from 'vitest';
import {
  buildReport,
  canonicalJson,
  computeVerdict,
  hashReportBody,
  summarize
} from '../src/core/report.ts';
import type { CheckResult } from '../src/core/types.ts';
import { HARNESS_VERSION } from '../src/core/types.ts';

function result(
  id: string,
  status: CheckResult['status'],
  severity: CheckResult['severity']
): CheckResult {
  return { id, name: id, severity, status, durationMs: 1, error: null, evidence: [] };
}

describe('summarize', () => {
  it('counts pass/fail/skip and required failures', () => {
    const summary = summarize([
      result('a', 'pass', 'required'),
      result('b', 'fail', 'required'),
      result('c', 'skip', 'required'),
      result('d', 'fail', 'bonus'),
      result('e', 'pass', 'bonus')
    ]);
    expect(summary).toEqual({
      total: 5,
      passed: 2,
      failed: 2,
      skipped: 1,
      requiredFailed: 1
    });
  });
});

describe('computeVerdict', () => {
  it('passes when all required checks pass (bonus failures ignored)', () => {
    expect(
      computeVerdict([
        result('a', 'pass', 'required'),
        result('b', 'fail', 'bonus')
      ])
    ).toBe('pass');
  });

  it('fails when any required check fails', () => {
    expect(
      computeVerdict([
        result('a', 'pass', 'required'),
        result('b', 'fail', 'required')
      ])
    ).toBe('fail');
  });

  it('fails when a required check is skipped (dependency failed)', () => {
    expect(
      computeVerdict([
        result('a', 'pass', 'required'),
        result('b', 'skip', 'required')
      ])
    ).toBe('fail');
  });
});

describe('canonicalJson', () => {
  it('is key-order independent and stable', () => {
    const a = { z: 1, a: { y: [3, { b: 1, a: 2 }], x: null } };
    const b = { a: { x: null, y: [3, { a: 2, b: 1 }] }, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('drops undefined values', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe('buildReport + hashReportBody', () => {
  const input = {
    challenge: 'calculator',
    targetUrl: 'http://example.test',
    seed: 123,
    startedAt: '2026-09-30T10:00:00.000Z',
    finishedAt: '2026-09-30T10:00:10.000Z',
    checks: [result('a', 'pass', 'required')],
    evidenceDir: 'calculator/20260930'
  };

  it('builds a report with deterministic hash over the body', () => {
    const report = buildReport(input);
    expect(report.schemaVersion).toBe(1);
    expect(report.harnessVersion).toBe(HARNESS_VERSION);
    expect(report.verdict).toBe('pass');
    expect(report.durationMs).toBe(10_000);
    const { resultHash, ...body } = report;
    expect(resultHash).toBe(hashReportBody(body));
  });

  it('changes the hash when any verdict content changes', () => {
    const pass = buildReport(input);
    const fail = buildReport({
      ...input,
      checks: [result('a', 'fail', 'required')]
    });
    expect(pass.resultHash).not.toBe(fail.resultHash);
    expect(pass.verdict).toBe('pass');
    expect(fail.verdict).toBe('fail');
  });
});
