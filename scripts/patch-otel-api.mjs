// Removes the ESM-only "module"/"esnext" fields from @opentelemetry/api's
// package.json. OpenNext's external-node-middleware bundle traces only the
// package's CJS build (build/src) into .open-next/middleware/node_modules, but
// esbuild prefers the "module" field and then fails on the missing
// build/esm. Forcing CJS resolution keeps the middleware bundle working
// (SPE-123). Idempotent; run on postinstall.
import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.resolve('node_modules/@opentelemetry/api/package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let changed = false;
  for (const field of ['module', 'esnext']) {
    if (field in pkg) {
      delete pkg[field];
      changed = true;
    }
  }
  const dotExports = pkg.exports?.['.'];
  if (dotExports) {
    for (const field of ['module', 'esnext']) {
      if (field in dotExports) {
        delete dotExports[field];
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[patch-otel-api] removed ESM fields from @opentelemetry/api');
  }
}
