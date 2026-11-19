"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <h1>Something went wrong</h1>
          {error.digest ? <p>Error ID: {error.digest}</p> : null}
          <button onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
