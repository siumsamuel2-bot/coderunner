// Clerk authentication configuration
// Replaces NextAuth (zero-factor credentials provider) with Clerk
// Clerk handles: sign-up, sign-in, email verification, sessions, OAuth
// We sync Clerk users to our Prisma User table via webhook

import { clerkClient, auth as clerkAuth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export { clerkClient };

// Re-export Clerk auth primitives so existing call sites keep working
export const auth = clerkAuth;

// Resolve the synced Prisma user for the current Clerk session
export async function currentUser() {
  const { userId } = await clerkAuth();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, name: true, email: true, image: true, clerkId: true },
  });
}

// Admin emails - configured in Clerk dashboard as organization admins
// Migration from: email === 'admin@example.com' (NextAuth)
// Now: Clerk organization membership with admin role
export const ADMIN_EMAILS = ["admin@example.com"];

// Helper to check if user is admin
export async function isAdmin(clerkUserId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    // Check if user has admin role in organization or is in admin emails
    const isAdminEmail = ADMIN_EMAILS.includes(
      user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? ""
    );
    // Check organization memberships for admin role
    const orgMemberships = await client.users.getOrganizationMembershipList({
      userId: clerkUserId,
    });
    const isOrgAdmin = orgMemberships.data.some(
      (m) => m.role === "org:admin" || m.role === "org:owner"
    );
    return isAdminEmail || isOrgAdmin;
  } catch {
    return false;
  }
}

// Get user's public metadata for role/permissions
export async function getUserPublicMetadata(clerkUserId: string) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    return user.publicMetadata;
  } catch {
    return {};
  }
}
