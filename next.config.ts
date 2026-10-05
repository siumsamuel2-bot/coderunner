import type { NextConfig } from "next";
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

export default nextConfig;
