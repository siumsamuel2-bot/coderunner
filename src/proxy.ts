import { clerkMiddleware } from '@clerk/nextjs/server';

// Next.js 16 proxy (middleware.ts was renamed to proxy.ts).
// clerkMiddleware() sets the auth context for Clerk server helpers;
// route protection stays in-app via auth() guards (dashboard, admin, API).
export const proxy = clerkMiddleware();

export const config = {
  matcher: ['/((?!.+\\.[^\\/]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
