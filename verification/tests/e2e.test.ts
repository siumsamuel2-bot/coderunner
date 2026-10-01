import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canLaunchBrowser } from '../src/core/browser.ts';
import { runVerification } from '../src/cli.ts';
import { hashReportBody } from '../src/core/report.ts';
import type { CheckResult, VerificationReport } from '../src/core/types.ts';
import { startMockApp } from './helpers/mock-app.ts';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));

const hasBrowser = await canLaunchBrowser(true);

/** Shared structural assertions for every produced report. */
function assertReportShape(report: VerificationReport, seed: number): void {
  expect(report.schemaVersion).toBe(1);
  expect(report.harnessVersion).toBe('1.0.0');
  expect(report.seed).toBe(seed);
  expect(report.resultHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(report.durationMs).toBeGreaterThan(0);
  expect(report.checks.length).toBeGreaterThan(0);
  expect(report.summary.total).toBe(report.checks.length);
  expect(report.summary.passed + report.summary.failed + report.summary.skipped).toBe(
    report.summary.total
  );
  const ids = new Set(report.checks.map((c) => c.id));
  expect(ids.size).toBe(report.checks.length);
  const { resultHash, ...body } = report;
  expect(resultHash).toBe(hashReportBody(body));
}

function required(report: VerificationReport): CheckResult[] {
  return report.checks.filter((c) => c.severity === 'required');
}

describe.skipIf(!hasBrowser).sequential('e2e: harness vs reference app', () => {
  let app: Awaited<ReturnType<typeof startMockApp>>;
  let outDir: string;

  beforeAll(async () => {
    app = await startMockApp();
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-e2e-'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('calculator: PASS on the reference app (all required, incl. bonus keyboard)', async () => {
    const report = await runVerification({
      challengeId: 'calculator',
      targetUrl: `${app.url}/calc`,
      seed: 20260930,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260930);
    expect(report.verdict).toBe('pass');
    expect(required(report).every((c) => c.status === 'pass')).toBe(true);
    expect(report.summary.requiredFailed).toBe(0);
    // report.json + evidence written to disk
    const reportFile = path.join(outDir, report.evidenceDir, 'report.json');
    const onDisk = JSON.parse(await fs.readFile(reportFile, 'utf8')) as VerificationReport;
    expect(onDisk.resultHash).toBe(report.resultHash);
  });

  it('todo-auth: PASS on the reference app (auth gate, CRUD, persistence, isolation)', async () => {
    const report = await runVerification({
      challengeId: 'todo-auth',
      targetUrl: `${app.url}/todo`,
      seed: 20260931,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260931);
    expect(report.verdict).toBe('pass');
    expect(required(report).every((c) => c.status === 'pass')).toBe(true);
  });

  it('pdf-analyzer: PASS on the reference app (marker text + metadata)', async () => {
    const report = await runVerification({
      challengeId: 'pdf-analyzer',
      targetUrl: `${app.url}/pdf`,
      seed: 20260932,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260932);
    expect(report.verdict).toBe('pass');
    expect(required(report).every((c) => c.status === 'pass')).toBe(true);
  });

  it('landing-page: PASS on the reference app', async () => {
    const report = await runVerification({
      challengeId: 'landing-page',
      targetUrl: `${app.url}/`,
      seed: 20260933,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260933);
    expect(report.verdict).toBe('pass');
    expect(required(report).every((c) => c.status === 'pass')).toBe(true);
  });

  it('chatbot: PASS on the reference app (echo bot replies)', async () => {
    const report = await runVerification({
      challengeId: 'chatbot',
      targetUrl: `${app.url}/chat`,
      seed: 20260934,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260934);
    expect(report.verdict).toBe('pass');
    expect(required(report).every((c) => c.status === 'pass')).toBe(true);
  });

  it('calculator: FAIL with skip cascade when a required button is missing', async () => {
    const report = await runVerification({
      challengeId: 'calculator',
      targetUrl: `${app.url}/calc-broken`,
      seed: 20260935,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260935);
    expect(report.verdict).toBe('fail');
    const buttons = report.checks.find((c) => c.id === 'calc-buttons-present');
    expect(buttons?.status).toBe('fail');
    expect(buttons?.error).toContain('clear');
    // Everything downstream of display discovery is skipped, not failed.
    const chained = report.checks.find((c) => c.id === 'calc-chained');
    expect(chained?.status).toBe('skip');
    expect(report.summary.skipped).toBeGreaterThan(0);
  });

  it('landing-page: FAIL when pricing and viewport meta are missing', async () => {
    const report = await runVerification({
      challengeId: 'landing-page',
      targetUrl: `${app.url}/landing-broken`,
      seed: 20260936,
      outDir,
      headless: true
    });
    assertReportShape(report, 20260936);
    expect(report.verdict).toBe('fail');
    expect(report.checks.find((c) => c.id === 'land-pricing')?.status).toBe('fail');
    expect(report.checks.find((c) => c.id === 'land-viewport-meta')?.status).toBe('fail');
    expect(report.summary.requiredFailed).toBe(2);
  });

  it('reproduces the exact same result when re-run with the same seed', async () => {
    const run = () =>
      runVerification({
        challengeId: 'calculator',
        targetUrl: `${app.url}/calc`,
        seed: 777,
        outDir,
        headless: true
      });
    const first = await run();
    const second = await run();
    // Same seed + same target => identical check statuses (hash differs only
    // by wall-clock timing fields; statuses must be identical).
    const statuses = (r: VerificationReport) => r.checks.map((c) => `${c.id}:${c.status}`);
    expect(statuses(second)).toEqual(statuses(first));
    expect(second.verdict).toBe('pass');
  });
});

describe('e2e: CLI process (arg parsing + exit codes)', () => {
  let app: Awaited<ReturnType<typeof startMockApp>>;

  beforeAll(async () => {
    app = await startMockApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('list prints all 5 challenges and exits 0', async () => {
    const { stdout } = await execFileAsync('node', ['src/cli.ts', 'list'], {
      cwd: ROOT_DIR
    });
    expect(stdout).toContain('calculator');
    expect(stdout).toContain('todo-auth');
    expect(stdout).toContain('pdf-analyzer');
    expect(stdout).toContain('landing-page');
    expect(stdout).toContain('chatbot');
  });

  it.skipIf(!hasBrowser)('verify exits 0 when the submission passes', async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-cli-'));
    const { stdout } = await execFileAsync(
      'node',
      [
        'src/cli.ts',
        'verify',
        '--challenge',
        'calculator',
        '--target',
        `${app.url}/calc`,
        '--seed',
        '5',
        '--out',
        outDir
      ],
      { cwd: ROOT_DIR }
    );
    expect(stdout).toContain('verdict        : PASS');
  }, 120_000);

  it.skipIf(!hasBrowser)('verify exits 1 when a required check fails', async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-cli-'));
    const exit = await execFileAsync(
      'node',
      [
        'src/cli.ts',
        'verify',
        '--challenge',
        'calculator',
        '--target',
        `${app.url}/calc-broken`,
        '--seed',
        '6',
        '--out',
        outDir
      ],
      { cwd: ROOT_DIR }
    ).then(
      () => 0,
      (err: { code?: number; stdout?: string }) => err.code ?? -1
    );
    expect(exit).toBe(1);
  }, 120_000);

  it('verify exits 2 on usage errors', async () => {
    const exit = await execFileAsync('node', ['src/cli.ts', 'verify', '--challenge', 'nope', '--target', 'http://x.test'], {
      cwd: ROOT_DIR
    }).then(
      () => 0,
      (err: { code?: number }) => err.code ?? -1
    );
    expect(exit).toBe(2);
  });
});
