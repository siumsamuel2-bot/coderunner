import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare Workers adapter for Next.js (SPE-123). @cloudflare/next-on-pages
// is deprecated and does not support Next 16, so the official OpenNext
// adapter is used. Deployed as a Worker with static assets (the successor to
// Pages projects).
export default defineCloudflareConfig();
