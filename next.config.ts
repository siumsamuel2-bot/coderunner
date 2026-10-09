import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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

