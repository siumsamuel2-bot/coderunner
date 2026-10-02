import { t } from "./trpc";
import { challengesRouter } from "./routers/challenges";
import { runsRouter } from "./routers/runs";
import { verificationsRouter } from "./routers/verifications";

export const appRouter = t.router({
  challenges: challengesRouter,
  runs: runsRouter,
  verifications: verificationsRouter,
});

export type AppRouter = typeof appRouter;
