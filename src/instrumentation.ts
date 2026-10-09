import type { Instrumentation } from "next";

export async function register() {
  // Only initialize Sentry when a DSN is configured (see .env.example).
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Route all unhandled server-side errors (RSC renders, route handlers,
// server actions) to Sentry. No-op when Sentry isn't initialized.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(err, request, context);
};
