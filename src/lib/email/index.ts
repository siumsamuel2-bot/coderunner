import { Resend } from 'resend';

// App-transactional email via Resend (auth email itself is handled by Clerk).
// Disabled as a no-op when RESEND_API_KEY is absent so local/dev builds work.

const apiKey = process.env.RESEND_API_KEY;
const defaultFrom =
  process.env.RESEND_FROM_EMAIL ?? 'Coderunner <noreply@coderunner.app>';

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export function isEmailEnabled(): boolean {
  return Boolean(apiKey);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set - skipping send to', options.to);
    return false;
  }

  const { error } = await resend.emails.send({
    from: options.from ?? defaultFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    console.error('[email] Resend send failed:', error);
    return false;
  }
  return true;
}

export function welcomeEmail(name?: string | null): { subject: string; html: string } {
  const greeting = name ? `Hey ${name},` : 'Hey,';
  return {
    subject: 'Welcome to Coderunner',
    html: `<p>${greeting}</p><p>Your Coderunner account is ready. Find a challenge, start the clock, and put a verified time on the leaderboard.</p>`,
  };
}

export function verificationResultEmail(options: {
  passed: boolean;
  challengeTitle: string;
  elapsedMs?: number | null;
}): { subject: string; html: string } {
  const { passed, challengeTitle, elapsedMs } = options;
  const time =
    typeof elapsedMs === 'number' ? ` in ${(elapsedMs / 1000).toFixed(2)}s` : '';
  return {
    subject: passed
      ? `Verified: ${challengeTitle}`
      : `Verification failed: ${challengeTitle}`,
    html: `<p>Your run on <strong>${challengeTitle}</strong> ${
      passed ? `passed verification${time}.` : 'did not pass verification.'
    }</p>`,
  };
}
