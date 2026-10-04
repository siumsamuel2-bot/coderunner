import type { MetadataRoute } from 'next';

import { serverTrpc } from '@/utils/trpc';

export const dynamic = 'force-dynamic';

const siteUrl =
  process.env.AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://coderunner-production-8e30.up.railway.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/leaderboard`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${siteUrl}/login`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const challenges = await serverTrpc.challenges.list();
    for (const c of challenges) {
      entries.push({
        url: `${siteUrl}/challenges/${c.slug}`,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // sitemap still serves the core pages if the DB is unavailable
  }

  return entries;
}
