import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the output file tracing root to this project. A stray lockfile in the
  // parent workspace otherwise makes Next nest standalone output under
  // standalone/coderunner/, which breaks the OpenNext bundle step (SPE-123).
  outputFileTracingRoot: projectDir,
  async redirects() {
    return [
      { source: "/login", destination: "/auth/signin", permanent: true },
    ];
  },
  // The verification harness lives in the sibling ../verification package
  // (linked via file:), so Turbopack needs the workspace root to follow it.
  turbopack: {
    root: resolve(projectDir, ".."),
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@coderunner/verification-harness",
    "playwright",
  ],
  // Prisma's workerd-runtime client imports its query compiler as
  // `./query_compiler_fast_bg.wasm?module` (the wrangler convention). Webpack
  // must NOT bundle it (its async-wasm runtime reads the file from disk, which
  // does not exist on Workers). Externalizing it keeps the import in the
  // server output so the OpenNext esbuild step (wrangler-externals plugin)
  // marks it external and wrangler bundles it as a native WebAssembly module.
  webpack(config) {
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      function wasmModuleExternal(
        ctx: { context?: string; request?: string },
        callback: (err: unknown, result?: string) => void
      ) {
        const request = ctx.request ?? "";
        if (/\.wasm(\?module)?$/.test(request) && ctx.context) {
          const abs = resolve(ctx.context, request);
          return callback(null, `module ${abs}`);
        }
        callback(null);
      },
    ];
    return config;
  },
};

// Sentry is a no-op without NEXT_PUBLIC_SENTRY_DSN (see .env.example).
// withSentryConfig wires in source-map upload when SENTRY_AUTH_TOKEN is set.
const sentryDisabled = !process.env.NEXT_PUBLIC_SENTRY_DSN;

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // Don't upload source maps in local/dev builds without a token.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Route React Server Component lifecycle events to Sentry for tracing.
  reactComponentAnnotation: { enabled: false },
};

export default sentryDisabled
  ? nextConfig
  : withSentryConfig(nextConfig, sentryWebpackPluginOptions);

