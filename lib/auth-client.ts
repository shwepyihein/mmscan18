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

/**
 * Better Auth's default JSON parser returns `null` for empty bodies; the client
 * then does `(unwrap(res)).user` and throws "null is not an object" in Mini
 * App / Telegram WebView when `/get-session` or `/token` returns empty or `null`.
 */
function safeAuthJsonParser(text: string): Record<string, unknown> {
  if (text == null || !String(text).trim()) {
    return {};
  }
  try {
    const v = JSON.parse(String(text)) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return {};
    }
    return v as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  fetchOptions: {
    credentials: "include",
    jsonParser: safeAuthJsonParser,
  },
  plugins: [jwtClient(), telegramClient()],
});
