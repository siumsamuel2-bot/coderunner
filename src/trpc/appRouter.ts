import { challengesRouter } from './routers/challenges';
import { runsRouter } from './routers/runs';
import { verificationsRouter } from './routers/verifications';
import { router } from './_trpc';

export const appRouter = router({
  challenges: challengesRouter,
  runs: runsRouter,
  verifications: verificationsRouter
});

// Export type router type signature,
// NOT the actual router.
export type AppRouter = typeof appRouter;
