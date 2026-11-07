import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/challenges(.*)",
  "/leaderboard(.*)",
  "/api/health",
  "/api/cron/sweeper",
  "/api/cron/verify",
  "/api/cron/verification-maintenance",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk", // Clerk webhook endpoint
]);

// Routes that require admin access
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  // Redirect unauthenticated users from protected routes
  if (!isPublicRoute(req) && !userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Admin route protection
  if (isAdminRoute(req) && userId) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const isAdminEmail = ["admin@example.com"].includes(
      user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? ""
    );
    const orgMemberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    const isOrgAdmin = orgMemberships.data.some(
      (m) => m.role === "org:admin" || m.role === "org:owner"
    );

    if (!isAdminEmail && !isOrgAdmin) {
      return NextResponse.redirect(new URL("/challenges", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};