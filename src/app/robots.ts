import type { MetadataRoute } from "next";

const siteUrl =
  process.env.AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://coderunner-production-8e30.up.railway.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
