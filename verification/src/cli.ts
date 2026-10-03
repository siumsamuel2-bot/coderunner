import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { EvidenceStore } from './core/evidence.ts';
import { BrowserSession } from './core/browser.ts';
import { Rng, randomSeed } from './core/rand.ts';
import { runChecks } from './core/harness.ts';
import { buildReport, formatSummary, writeReport } from './core/report.ts';
import type { VerificationReport } from './core/types.ts';
import type { ChallengeId } from './core/types.ts';
import { CHALLENGES, CHALLENGE_IDS, isChallengeId } from './registry.ts';

const ROOT_DIR = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));

interface VerifyArgs {
  challenge: string;
  target: string | null;
  config: string | null;
  seed: number | null;
  out: string;
  headed: boolean;
}

function printUsage(): void {
  console.log(`Coderunner verification harness

Usage:
  node src/cli.ts list
  node src/cli.ts verify --challenge <id|all> --target <url> [options]

Options:
  --challenge <id>   Challenge id (or "all"). Ids: ${CHALLENGE_IDS.join(', ')}
  --target <url>     Submission base URL (ignored for "all" when --config is set)
  --config <file>    JSON file mapping challenge id -> target URL (for "all")
  --seed <number>    Seed for reproducible test vectors (default: random)
  --out <dir>        Output directory for results/evidence (default: results)
  --headed           Run the browser headed (debugging; not for CI)
  --help             Show this help

Exit codes:
  0  all requested challenges passed
  1  at least one required check failed
  2  harness/usage error`);
}

function parseArgs(argv: readonly string[]): VerifyArgs | null {
  const args: VerifyArgs = {
    challenge: '',
    target: null,
    config: null,
    seed: null,
    out: 'results',
    headed: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--challenge' || flag === '-c') {
      args.challenge = next ?? '';
      i += 1;
    } else if (flag === '--target' || flag === '-t') {
      args.target = next ?? '';
      i += 1;
    } else if (flag === '--config') {
      args.config = next ?? '';
      i += 1;
    } else if (flag === '--seed') {
      const parsed = Number(next);
      if (!Number.isFinite(parsed)) {
        console.error(`Invalid --seed: ${next ?? '(missing)'}`);
        return null;
      }
      args.seed = parsed >>> 0;
      i += 1;
    } else if (flag === '--out') {
      args.out = next ?? 'results';
      i += 1;
    } else if (flag === '--headed') {
      args.headed = true;
    } else {
      console.error(`Unknown argument: ${flag}`);
      return null;
    }
  }
  if (args.challenge === '') {
    console.error('Missing --challenge. Use --challenge <id|all>.');
    return null;
  }
  return args;
}

/** Resolves the challenge -> target map for the requested run. */
async function resolveTargets(
  args: VerifyArgs
): Promise<Map<ChallengeId, string>> {
  const targets = new Map<ChallengeId, string>();
  if (args.challenge === 'all') {
    if (args.config !== null) {
      const raw = await fs.readFile(path.resolve(args.config), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Config file must be a JSON object of challenge -> URL');
      }
      for (const [key, value] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (!isChallengeId(key) || typeof value !== 'string') {
          continue;
        }
        targets.set(key, value);
      }
    } else if (args.target !== null) {
      for (const id of CHALLENGE_IDS) {
        targets.set(id, args.target);
      }
    } else {
      throw new Error(
        '"--challenge all" needs either --target <url> or --config <file>'
      );
    }
  } else {
    if (!isChallengeId(args.challenge)) {
      throw new Error(
        `Unknown challenge "${args.challenge}". Valid ids: ${CHALLENGE_IDS.join(', ')}`
      );
    }
    if (args.target === null) {
      throw new Error(
        `Missing --target for challenge "${args.challenge}" (or use --config)`
      );
    }
    targets.set(args.challenge, args.target);
  }
  return targets;
}

export interface RunVerificationOptions {
  readonly challengeId: ChallengeId;
  readonly targetUrl: string;
  readonly seed: number;
  readonly outDir: string;
  readonly headless: boolean;
}

/**
 * Runs one challenge verifier against its target URL and produces a report
 * (report.json + evidence). Exported for tests and programmatic use.
 */
export async function runVerification(
  options: RunVerificationOptions
): Promise<VerificationReport> {
  const { challengeId, targetUrl, seed, outDir, headless } = options;
  const verifier = CHALLENGES[challengeId];
  const rand = new Rng(seed);
  const stamp = new Date()
    .toISOString()
    .replaceAll(':', '')
    .replaceAll('.', '');
  const evidence = new EvidenceStore(path.resolve(outDir), challengeId, stamp);
  await evidence.ensure();
  const session = new BrowserSession({
    headless,
    evidence,
    defaultTimeoutMs: 15_000
  });

  const startedAt = new Date().toISOString();
  let report: VerificationReport;
  try {
    const checks = await verifier.buildChecks({
      targetUrl,
      seed,
      rand,
      evidence,
      session,
      defaultTimeoutMs: 15_000,
      fixturesDir: path.join(ROOT_DIR, 'fixtures')
    });
    const results = await runChecks(checks);
    const finishedAt = new Date().toISOString();
    report = buildReport({
      challenge: challengeId,
      targetUrl,
      seed,
      startedAt,
      finishedAt,
      checks: results,
      evidenceDir: evidence.relativeDir
    });
  } finally {
    await session.close();
  }

  await writeReport(report, evidence.dir);
  await evidence.saveJson('console-log.json', {
    errors: session.failures(),
    all: session.consoleRecords
  });
  return report;
}

async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0];
  const rest = argv.slice(1);

  if (command === 'list') {
    for (const id of CHALLENGE_IDS) {
      const verifier = CHALLENGES[id];
      console.log(`${id.padEnd(14)} ${verifier.meta.name} - ${verifier.meta.description}`);
      console.log(`${' '.repeat(14)} spec: ${verifier.meta.specPath}`);
    }
    return 0;
  }

  if (command === 'verify') {
    const args = parseArgs(rest);
    if (args === null) {
      printUsage();
      return 2;
    }
    let targets: Map<ChallengeId, string>;
    try {
      targets = await resolveTargets(args);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }

    const reports: VerificationReport[] = [];
    for (const [challengeId, targetUrl] of targets) {
      console.log(`\n=== Verifying "${challengeId}" against ${targetUrl} ===`);
      try {
        const report = await runVerification({
          challengeId,
          targetUrl,
          seed: args.seed ?? randomSeed(),
          outDir: args.out,
          headless: !args.headed
        });
        reports.push(report);
        console.log(formatSummary(report));
      } catch (err) {
        // Harness-level failure (browser launch, fixture problems...).
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`Harness error while verifying "${challengeId}": ${message}`);
        return 2;
      }
    }

    console.log('\n=== Summary ===');
    for (const report of reports) {
      console.log(
        `${report.challenge.padEnd(14)} ${report.verdict.toUpperCase().padEnd(5)} ${report.resultHash}`
      );
    }
    return reports.some((r) => r.verdict === 'fail') ? 1 : 0;
  }

  printUsage();
  return command === '--help' || command === 'help' ? 0 : 2;
}

function isDirectRun(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }
  const invoked = path.resolve(process.argv[1]);
  const self = path.resolve(url.fileURLToPath(import.meta.url));
  return invoked === self;
}

if (isDirectRun()) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (err) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(2);
    }
  );
}
