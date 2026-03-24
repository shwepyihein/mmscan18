import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { telegramClient } from "better-auth-telegram/client";

function resolveBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  fetchOptions: {
    credentials: "include",
  },
  plugins: [jwtClient(), telegramClient()],
});
