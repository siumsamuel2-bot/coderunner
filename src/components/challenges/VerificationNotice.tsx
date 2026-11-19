/**
 * Verification transparency notice (SPE-126/SPE-132, from the SPE-127 spec
 * §4.2). Copy is whitelisted against what the backend actually does
 * (§4.1): automated browser on the live URL, randomized seeded inputs,
 * required vs bonus checks, per-check evidence, server-side timing.
 *
 * Copy whitelist (SPE-127 §4.1) — the notice may only describe what the
 * backend actually does. It must never claim capabilities the system lacks
 * (no phantom check categories, no usage detection, no absolute
 * tamper-proofing promises): none of those exist.
 */
export function VerificationNotice({
  defaultOpen = false,
  id,
}: {
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details
      id={id}
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

/** Compact trust line (SPE-127 §4.2 compact variant): shield + text, linking
 * to the full notice when a target id is provided. */
export function VerificationTrustLine({ href }: { href?: string }) {
  const content = (
    <>
      <svg
        aria-hidden='true'
        className='h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
          d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
        />
      </svg>
      <span>
        Every verified result passed automated browser checks on the live app.
        {href && ' View how verification works'}
      </span>
    </>
  );
  const className =
    'inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400';
  if (href) {
    return (
      <a href={href} className={`${className} hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}>
        {content}
      </a>
    );
  }
  return <p className={className}>{content}</p>;
}
