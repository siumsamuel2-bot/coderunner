import { appRouter } from './appRouter';
import { createCallerFactory } from './_trpc';

export * from './context';
export { appRouter };
export const createAppCaller = createCallerFactory(appRouter);
