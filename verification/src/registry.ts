import type { ChallengeId } from './core/types.ts';
import type { ChallengeVerifier } from './core/verifier.ts';
import { calculatorVerifier } from './challenges/calculator/verifier.ts';
import { todoAuthVerifier } from './challenges/todo-auth/verifier.ts';
import { pdfAnalyzerVerifier } from './challenges/pdf-analyzer/verifier.ts';
import { landingPageVerifier } from './challenges/landing-page/verifier.ts';
import { chatbotVerifier } from './challenges/chatbot/verifier.ts';

/** All built-in challenge verifiers, keyed by challenge id. */
export const CHALLENGES: Readonly<Record<ChallengeId, ChallengeVerifier>> = {
  calculator: calculatorVerifier,
  'todo-auth': todoAuthVerifier,
  'pdf-analyzer': pdfAnalyzerVerifier,
  'landing-page': landingPageVerifier,
  chatbot: chatbotVerifier
};

export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[];

export function isChallengeId(value: string): value is ChallengeId {
  return Object.prototype.hasOwnProperty.call(CHALLENGES, value);
}
