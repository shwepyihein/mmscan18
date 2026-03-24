import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { telegramClient } from "better-auth-telegram/client";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: (callback?: () => void) => void;
      };
    };
  }
}

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

/** True when Telegram injects `window.Telegram.WebApp` (Mini App WebView). */
export function isTelegramMiniAppEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp);
}

/**
 * Wait for `window.Telegram.WebApp` — it often appears after first paint in a Mini App.
 */
export function waitForTelegramWebApp(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 40;
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Telegram?.WebApp) return Promise.resolve(true);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (window.Telegram?.WebApp) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/**
 * Wait for non-empty `initData` (Telegram can fill it shortly after WebApp is ready).
 */
export function waitForTelegramInitData(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const intervalMs = options?.intervalMs ?? 40;
  if (typeof window === "undefined") return Promise.resolve(null);

  const rawNow = window.Telegram?.WebApp?.initData?.trim() ?? "";
  if (rawNow) return Promise.resolve(rawNow);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const raw = window.Telegram?.WebApp?.initData?.trim() ?? "";
      if (raw) {
        resolve(raw);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

type MiniAppSignInResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

/**
 * Mini App sign-in via better-auth-telegram (`autoSignInFromMiniApp` → `POST /telegram/miniapp/signin`).
 * Reads `Telegram.WebApp.initData` internally — no @telegram-apps/sdk required for auth.
 */
export async function signInTelegramMiniApp(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Mini App sign-in requires a browser.");
  }
  const c = authClient as unknown as {
    autoSignInFromMiniApp: () => Promise<MiniAppSignInResult>;
  };
  const result = await c.autoSignInFromMiniApp();
  if (result?.error) {
    throw new Error(result.error.message ?? "Telegram Mini App sign-in failed");
  }
}
