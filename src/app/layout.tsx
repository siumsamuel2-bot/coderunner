import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://coderunner-production-8e30.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Coderunner",
    template: "%s — Coderunner",
  },
  description:
    "Race the clock. Build software with AI. Same prompts, same rules — verified completion times on a global leaderboard.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Coderunner",
    title: "Coderunner",
    description:
      "Race the clock. Build software with AI. Verified completion times on a global leaderboard.",
  },
  twitter: {
    card: "summary",
    title: "Coderunner",
    description:
      "Race the clock. Build software with AI. Verified completion times on a global leaderboard.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
