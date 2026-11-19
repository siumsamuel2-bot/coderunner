import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server';

import { prisma } from '@/lib/prisma';

// Clerk-backed auth shim (SPE-123 migration from NextAuth). Keeps the
// NextAuth-shaped `auth()` API so all call sites (`session.user.id`, email,
// name, image) work unchanged. The Prisma User row is synced from Clerk via
// the user.created/updated webhook (src/app/api/webhooks/clerk/route.ts);
// auth() self-heals by upserting from Clerk if the webhook has not landed yet.

export interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}

export async function auth(): Promise<AuthSession | null> {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    // Webhook not landed yet (or local dev) — sync directly from Clerk.
    const cu = await currentUser();
    if (!cu) return null;
    const email = cu.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
    user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        email: email ?? undefined,
        name: cu.fullName ?? email?.split('@')[0] ?? undefined,
        image: cu.imageUrl || undefined,
      },
      create: {
        clerkId: userId,
        email,
        name: cu.fullName ?? email?.split('@')[0] ?? null,
        image: cu.imageUrl || null,
        emailVerified: email ? new Date() : null,
      },
    });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
  };
}
