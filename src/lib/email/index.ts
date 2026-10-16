import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@coderunner.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email send");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function sendVerificationEmail(
  email: string,
  username: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CodeRunner</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Competitive programming for AI-native developers</p>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${username}!</h2>
          <p style="color: #4b5563;">Your account has been created. You're now ready to start competing.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/challenges" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Start Competing</a>
          </div>
          <p style="color: #9ca3af; font-size: 14px;">Build with AI. Ship it. Get verified. Beat the clock. Climb the leaderboard.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 12px;">If you didn't create this account, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Welcome to CodeRunner — Start competing!",
    html,
    text: `Welcome to CodeRunner, ${username}! Your account is ready. Visit ${APP_URL}/challenges to start competing.`,
  });
}

export async function sendSubmissionVerifiedEmail(
  email: string,
  username: string,
  challengeTitle: string,
  score: number,
  rank: number,
  completionTime: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Verified!</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin-top: 0;">Submission Verified</h2>
          <p style="color: #4b5563;">Hey ${username}, your submission for <strong>${challengeTitle}</strong> has been verified.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #6b7280;">Score</span>
              <strong style="color: #1f2937;">${score} / 1000</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #6b7280;">Rank</span>
              <strong style="color: #1f2937;">#${rank}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Time</span>
              <strong style="color: #1f2937;">${completionTime}</strong>
            </div>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/challenges" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Try Another Challenge</a>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `✅ Verified: ${challengeTitle} — Score ${score}, Rank #${rank}`,
    html,
    text: `Your submission for ${challengeTitle} has been verified! Score: ${score}/1000, Rank: #${rank}, Time: ${completionTime}. View at ${APP_URL}/challenges`,
  });
}

export async function sendChallengeCompletedEmail(
  email: string,
  username: string,
  challengeTitle: string,
  status: "verified" | "failed",
  details?: string
): Promise<void> {
  const isVerified = status === "verified";
  const color = isVerified ? "#10b981" : "#ef4444";
  const icon = isVerified ? "✅" : "❌";
  const title = isVerified ? "Verified" : "Failed";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${icon} Submission ${title}</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin-top: 0;">${challengeTitle}</h2>
          <p style="color: #4b5563;">Hey ${username}, your submission has been <strong>${status}</strong>.</p>
          ${details ? `<p style="color: #6b7280; font-size: 14px;">${details}</p>` : ""}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/challenges" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">View Challenges</a>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `${icon} ${challengeTitle} — ${title}`,
    html,
    text: `Your submission for ${challengeTitle} has been ${status}. ${details ?? ""} View at ${APP_URL}/challenges`,
  });
}