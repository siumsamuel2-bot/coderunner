import type { EvidenceStore } from './evidence.ts';
import type { BrowserSession } from './browser.ts';
import type { Rng } from './rand.ts';
import type { ChallengeVerifierMeta, Check } from './types.ts';

/** Everything a challenge verifier needs to build and run its checks. */
export interface VerifierContext {
  readonly targetUrl: string;
  readonly seed: number;
  readonly rand: Rng;
  readonly evidence: EvidenceStore;
  readonly session: BrowserSession;
  readonly defaultTimeoutMs: number;
  /** Absolute path to the fixture directory (PDF sample etc.). */
  readonly fixturesDir: string;
}

/** A challenge verifier: metadata plus a check-suite factory. */
export interface ChallengeVerifier {
  readonly meta: ChallengeVerifierMeta;
  buildChecks(ctx: VerifierContext): Promise<readonly Check[]>;
}
