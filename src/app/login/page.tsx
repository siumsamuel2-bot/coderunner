"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">Sign in to Coderunner</h1>
      <p className="text-sm opacity-70">
        Race the clock. Build software with AI.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          className="rounded-md border px-6 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Continue with GitHub
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="rounded-md border px-6 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}
