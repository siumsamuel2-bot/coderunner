import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export interface Context {
  prisma: typeof prisma;
  userId: string | null;
  isAdmin: boolean;
}

export async function createContext(): Promise<Context> {
  const { userId } = await auth();
  let isAdmin = false;

  if (userId) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const adminEmails = ["admin@example.com"];
    const isAdminEmail = adminEmails.includes(
      user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? ""
    );
    const orgMemberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    const isOrgAdmin = orgMemberships.data.some(
      (m) => m.role === "org:admin" || m.role === "org:owner"
    );
    isAdmin = isAdminEmail || isOrgAdmin;
  }

  return { prisma, userId, isAdmin };
}
