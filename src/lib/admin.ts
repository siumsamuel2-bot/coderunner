import { redirect } from 'next/navigation';

import { auth } from '@/auth';

/**
 * Server-owned admin allowlist. Replaces the previous hardcoded
 * `email === 'admin@example.com'` check (SPE-118 risk #4).
 *
 * Configure with a comma-separated ADMIN_EMAILS env var, e.g.
 *   ADMIN_EMAILS="sam@coderunner.dev,ops@coderunner.dev"
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export const hasAdminConfigured = (): boolean => getAdminEmails().length > 0;

export interface AuthedSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}

/**
 * Server-only guard for admin pages and server actions. Redirects
 * unauthenticated/non-admin callers to the sign-in page.
 */
export async function requireAdmin(): Promise<AuthedSession> {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    redirect('/auth/signin');
  }
  return session as AuthedSession;
}
