// Coderunner production deploy (SPE-123).
//
// One-command restore for when valid Board credentials land. Runs, in order:
//   1. Load + validate credentials from .env.deploy.local (never committed)
//   2. Pre-flight: live Neon query, R2 bucket existence, Cloudflare token check
//   3. prisma db push against Neon (schema has no migration history -> db push)
//   4. OpenNext build + Cloudflare deploy (npm run cf:deploy)
//   5. wrangler secret put for every runtime secret
//   6. E2E smoke check on /, /challenges, /feedback
//
// Usage:
//   node scripts/deploy.mjs --dry-run            # pre-flight only (safe, no deploy)
//   node scripts/deploy.mjs                      # full deploy
//   node scripts/deploy.mjs --file creds.env     # custom creds file
//   node scripts/deploy.mjs --skip-db-push       # schema already applied
//
// The script fails fast with the exact Board action needed whenever a
// credential is a placeholder, rejected, or missing permissions.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function optionValue(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

const DRY_RUN = flag('--dry-run');
const SKIP_DB_PUSH = flag('--skip-db-push');
const SKIP_PREFLIGHT = flag('--skip-preflight');
const CREDS_FILE = optionValue('--file') ?? path.join(ROOT, '.env.deploy.local');

const log = (...m) => console.log(...m);
const warn = (...m) => console.warn('WARN:', ...m);
const die = (...m) => {
  console.error('\nDEPLOY ABORTED:', ...m);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// 1. Load credentials
// ---------------------------------------------------------------------------

function loadCredsFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileCreds = loadCredsFile(CREDS_FILE);
const env = { ...process.env, ...fileCreds }; // file wins over stale shell env

const GENERATED = {};
function secret(name, { generate = false } = {}) {
  let v = env[name];
  if (!v && generate) {
    v = crypto.randomBytes(32).toString('hex');
    GENERATED[name] = v;
    warn(`${name} missing -> generated a random value for this deploy.`);
  }
  return v;
}

const required = [
  'DATABASE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'NEXT_PUBLIC_APP_URL',
];

const missing = required.filter((k) => !env[k]);
if (missing.length) {
  die(
    `missing credentials: ${missing.join(', ')}\n` +
      `Fill them in ${path.relative(ROOT, CREDS_FILE)} (see .env.deploy.example).`,
  );
}

const VERIFICATION_WEBHOOK_SECRET = secret('VERIFICATION_WEBHOOK_SECRET', { generate: true });
const CRON_SECRET = secret('CRON_SECRET', { generate: true });
const ADMIN_EMAILS = env.ADMIN_EMAILS ?? '';
const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
if (!env.RESEND_FROM_EMAIL) {
  warn(`RESEND_FROM_EMAIL not set -> defaulting to ${RESEND_FROM_EMAIL} (Resend test sender).`);
}
if (!ADMIN_EMAILS) {
  warn('ADMIN_EMAILS not set -> nobody will have admin panel access.');
}

// ---------------------------------------------------------------------------
// 2. Pre-flight
// ---------------------------------------------------------------------------

async function checkNeon() {
  const { neon } = await import('@neondatabase/serverless');
  const url = env.DATABASE_URL;
  const u = new URL(url);
  log(`  Neon ${u.hostname} ...`);
  const client = neon(url);
  const rows = await client`select 1 as ok`;
  if (rows[0]?.ok !== 1) throw new Error('unexpected query result');
}

async function checkR2() {
  const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  log(`  R2 bucket ${env.R2_BUCKET} ...`);
  await s3.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET }));
}

async function checkCloudflareToken() {
  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
  });
  const vj = await verify.json();
  if (!vj.success) throw new Error(`token invalid: ${JSON.stringify(vj.errors)}`);
  log(`  CF token status: ${vj.result?.status}`);
  const scripts = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`,
    { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } },
  );
  if (!scripts.ok) {
    throw new Error(
      `token cannot list Workers scripts (HTTP ${scripts.status}) — needs "Workers Scripts: Edit".`,
    );
  }
}

async function preflight() {
  log('\n== Pre-flight ==');
  const checks = [
    ['Neon', checkNeon],
    ['R2', checkR2],
    ['Cloudflare token', checkCloudflareToken],
  ];
  for (const [name, fn] of checks) {
    try {
      await fn();
    } catch (err) {
      die(
        `${name} check failed: ${err instanceof Error ? err.message : err}` +
          (name === 'Neon'
            ? '\n  -> Board: post the real pooled connection string from Neon Console -> Connection Details -> Pooled.'
            : name === 'R2'
              ? '\n  -> Board: create bucket "coderunner-evidence" in the Cloudflare dashboard (R2 -> Create bucket) and scope the R2 token to it with Object Read & Write.'
              : '\n  -> Board: create/repair the API token with Account -> Workers Scripts: Edit permission.'),
      );
    }
  }
  log('Pre-flight OK.\n');
}

if (!SKIP_PREFLIGHT) {
  await preflight();
} else {
  warn('Pre-flight skipped.');
}

if (DRY_RUN) {
  log('Dry run complete — credentials validated, nothing deployed.');
  if (Object.keys(GENERATED).length) {
    log(`Generated secrets (also written to ${path.relative(ROOT, CREDS_FILE)}.generated):`);
    const genPath = `${CREDS_FILE}.generated`;
    fs.writeFileSync(
      genPath,
      Object.entries(GENERATED)
        .map(([k, v]) => `${k}="${v}"`)
        .join('\n'),
    );
    for (const [k, v] of Object.entries(GENERATED)) log(`  ${k}=${v.slice(0, 8)}...`);
    log(`  (saved to ${path.relative(ROOT, genPath)} — gitignored by .env* rule)`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 3. prisma db push
// ---------------------------------------------------------------------------

function run(cmd, { env: childEnv = {}, cwd = ROOT } = {}) {
  log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, {
    shell: true,
    cwd,
    stdio: 'inherit',
    env: { ...env, ...childEnv },
  });
  if (r.status !== 0) die(`command failed (exit ${r.status}): ${cmd}`);
}

// Build-time env: NEXT_PUBLIC_* are inlined into the bundle at build time.
const buildEnv = {
  DATABASE_URL: env.DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
};

if (!SKIP_DB_PUSH) {
  log('\n== prisma db push (Neon) ==');
  run('npx prisma db push', { env: buildEnv });
} else {
  warn('Skipping prisma db push.');
}

// ---------------------------------------------------------------------------
// 4. Build + deploy (creates the Worker so secrets can be attached)
// ---------------------------------------------------------------------------

log('\n== Build + deploy to Cloudflare ==');
run('npm run cf:deploy', { env: buildEnv });

// ---------------------------------------------------------------------------
// 5. Runtime secrets via wrangler
// ---------------------------------------------------------------------------

log('\n== wrangler secrets ==');

const wranglerEnv = {
  CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
};

const runtimeSecrets = {
  DATABASE_URL: env.DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SECRET: env.CLERK_WEBHOOK_SECRET,
  RESEND_API_KEY: env.RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: env.R2_BUCKET,
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  VERIFICATION_WEBHOOK_SECRET,
  CRON_SECRET,
  ...(ADMIN_EMAILS ? { ADMIN_EMAILS } : {}),
};

for (const [name, value] of Object.entries(runtimeSecrets)) {
  if (!value) {
    warn(`secret ${name} empty — skipped`);
    continue;
  }
  log(`put ${name}`);
  const r = spawnSync('npx wrangler secret put ' + name, {
    shell: true,
    cwd: ROOT,
    input: `${value}\n`,
    encoding: 'utf8',
    env: { ...env, ...wranglerEnv },
  });
  if (r.status !== 0) {
    die(`wrangler secret put ${name} failed:\n${r.stdout}${r.stderr}`);
  }
}

// ---------------------------------------------------------------------------
// 6. E2E smoke check
// ---------------------------------------------------------------------------

log('\n== E2E smoke check ==');
const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
const failures = [];
for (const p of ['/', '/challenges', '/feedback']) {
  try {
    const res = await fetch(`${base}${p}`, { redirect: 'manual' });
    log(`  GET ${p} -> ${res.status}`);
    if (res.status >= 500) failures.push(`${p} -> ${res.status}`);
  } catch (err) {
    failures.push(`${p} -> ${err instanceof Error ? err.message : err}`);
  }
}
if (failures.length) {
  die(`E2E failures (deployment may be missing secrets):\n  ${failures.join('\n  ')}`);
}

log('\n==========================================================');
log('DEPLOY COMPLETE');
log(`App: ${base}`);
log('==========================================================');
log('\nRemaining manual steps:');
log(`1. Clerk dashboard -> Webhooks -> endpoint: ${base}/api/webhooks/clerk`);
log('   (subscribed to user.created/user.updated; secret = CLERK_WEBHOOK_SECRET)');
if (ADMIN_EMAILS) log(`2. Admin panel allowlist deployed: ${ADMIN_EMAILS}`);
else log('2. Set ADMIN_EMAILS (wrangler secret put ADMIN_EMAILS) to enable the admin panel.');
log('3. GitHub repo secrets for the verification worker: DATABASE_URL');
log('   (Actions -> Verification Worker uses secrets.DATABASE_URL)');
log('4. Resend: verify a sending domain, then set RESEND_FROM_EMAIL to it.');
