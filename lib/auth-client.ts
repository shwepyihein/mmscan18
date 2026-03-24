import { createAuthClient } from "better-auth/client";
import { getBackendBaseUrl } from "@/lib/backend-base-url";

/** Points at your API / Better Auth routes when you wire `useSession` server-side. */
export const authClient = createAuthClient({
  baseURL: getBackendBaseUrl() || "http://localhost:8000",
});

export const { useSession, signIn, signOut } = authClient;
