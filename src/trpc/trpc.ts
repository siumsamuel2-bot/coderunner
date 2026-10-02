import { initTRPC } from "@trpc/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type Context = {
  prisma: typeof prisma;
  session: Session | null;
};

export const t = initTRPC.context<Context>().create();

export async function createContext(): Promise<Context> {
  return { prisma, session: await auth() };
}
