import { appRouter } from "./router";
import { createContext, t } from "./trpc";

const createCaller = t.createCallerFactory(appRouter);

export async function getCaller() {
  return createCaller(await createContext());
}
