/**
 * Verification transparency notice (SPE-126/SPE-132, from the SPE-127 spec
 * §4.2). Copy is whitelisted against what the backend actually does
 * (§4.1): automated browser on the live URL, randomized seeded inputs,
 * required vs bonus checks, per-check evidence, server-side timing.
 *
 * Never claims: hidden tests, performance checks, AI-usage detection, or a
 * distinct deployment-verification phase — none exist.
 */
export function VerificationNotice({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details
      open={defaultOpen}
      className='rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800'
    >
      <summary className='cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'>
        How verification works
      </summary>
      <p className='mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400'>
        We load the URL you submit and drive the real UI with an automated
        browser. Each run uses randomized, seeded inputs — a submission that
        hardcodes the expected answers will fail. All required checks must
        pass for a result to be verified; bonus checks are reported but do
        not affect the verdict. Your official completion time is computed
        server-side, and the pass/fail for every check — with captured
        evidence — is shown on your result.
      </p>
    </details>
  );
}

/** Compact trust line for footers/leaderboards (SPE-127 §4.2 compact variant). */
export function VerificationTrustLine() {
  return (
    <p className='text-xs text-gray-500 dark:text-gray-400'>
      Every verified result passed automated browser checks on the live app.
    </p>
  );
}
