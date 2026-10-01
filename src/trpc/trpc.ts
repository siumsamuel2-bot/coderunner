import { initTRPC } from "@trpc/server";

export const t = initTRPC.create();
export const trpc = t;

export type User = {
  id: string;
  name: string | null;
  email: string | null;
};

export const createContext = () => ({
  prisma: null,
  user: {} as User,
  session: null,
});