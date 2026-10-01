import type { NextFetchEvent, NextMiddleware } from "next/server";
import type { NextAuthRequest } from "next-auth";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const authMiddleware = auth as unknown as (
  request: NextAuthRequest,
  event: NextFetchEvent
) => ReturnType<NextMiddleware>;

export function proxy(request: NextAuthRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}
