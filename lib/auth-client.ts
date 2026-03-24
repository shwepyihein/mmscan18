import { createAuthClient } from "better-auth/client";

/** Points at your API / Better Auth routes when you wire `useSession` server-side. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
});

export const { useSession, signIn, signOut } = authClient;
