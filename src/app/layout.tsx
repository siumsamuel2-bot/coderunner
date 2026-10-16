import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://coderunner.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CodeRunner",
    template: "%s - CodeRunner",
  },
  description:
    "Race the clock. Build software with AI. Same prompts, same rules - verified completion times on a global leaderboard.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "CodeRunner",
    title: "CodeRunner",
    description:
      "Race the clock. Build software with AI. Verified completion times on a global leaderboard.",
  },
  twitter: {
    card: "summary",
    title: "CodeRunner",
    description:
      "Race the clock. Build software with AI. Verified completion times on a global leaderboard.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
