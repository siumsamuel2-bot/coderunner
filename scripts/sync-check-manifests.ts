/**
 * Sync check manifests from verification/specs into Challenge.testSpec
 * (SPE-132, dep D5 from the SPE-127 spec §4.3).
 *
 * For every verification/specs/<slug>.md, parses the Required/Bonus check
 * tables and writes:
 *   Challenge.testSpec.checkManifest = {
 *     source: 'verification/specs/<slug>.md',
 *     checks: [{ id, severity, passesWhen }, ...]
 *   }
 *
 * The legacy `testSpec.checks` array (simplified seed summary) is left
 * untouched for backward compatibility; the UI reads only `checkManifest`.
 * Unknown ids in the DB that no longer exist in the spec files are not
 * removed — re-running after removing a check from a spec leaves a stale
 * entry; review diffs before deleting checks.
 *
 * Usage: npx tsx scripts/sync-check-manifests.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { prisma } from '../src/lib/prisma-node';
import { parseCheckManifest } from '../src/lib/check-manifest';
import type { Prisma } from '../src/generated/prisma-node/client';

const ROOT_DIR = path.dirname(
  path.dirname(url.fileURLToPath(import.meta.url))
);
const SPECS_DIR = path.join(ROOT_DIR, 'verification', 'specs');

async function main() {
  const specFiles = readdirSync(SPECS_DIR).filter((f) => f.endsWith('.md'));
  let updated = 0;

  for (const file of specFiles) {
    const slug = file.replace(/\.md$/, '');
    const content = readFileSync(path.join(SPECS_DIR, file), 'utf8');
    const manifest = parseCheckManifest(content, `verification/specs/${file}`);

    if (manifest.checks.length === 0) {
      console.warn(`[${slug}] no checks parsed from ${file} — skipped`);
      continue;
    }

    const challenge = await prisma.challenge.findUnique({
      where: { slug },
      select: { id: true, testSpec: true },
    });
    if (!challenge) {
      console.warn(`[${slug}] no challenge row — skipped`);
      continue;
    }

    const existing =
      (challenge.testSpec as Record<string, unknown> | null) ?? {};
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        testSpec: {
          ...existing,
          checkManifest: manifest,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    updated += 1;
    console.log(
      `[${slug}] ${manifest.checks.length} checks (required: ${
        manifest.checks.filter((c) => c.severity === 'required').length
      }, bonus: ${
        manifest.checks.filter((c) => c.severity === 'bonus').length
      })`
    );
  }

  console.log(`Sync complete: ${updated} challenge(s) updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
