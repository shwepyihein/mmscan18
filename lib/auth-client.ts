import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { telegramClient } from "better-auth-telegram/client";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, unknown>;
        ready?: (callback?: () => void) => void;
        expand?: () => void;
        version?: string;
        platform?: string;
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
 * Notify Telegram that the Mini App UI is ready — some clients only fill `initData` after this.
 */
export function notifyTelegramWebAppReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window.Telegram?.WebApp;
  if (!w) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const once = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      if (typeof w.ready === "function") {
        w.ready(once);
        window.setTimeout(once, 4000);
      } else {
        once();
      }
    } catch {
      once();
    }
  });
}

/** Debug snapshot for Profile / support (why `initData` can be empty). */
export function getTelegramWebAppDebugSnapshot(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return { error: "SSR — no window" };
  }
  const w = window.Telegram?.WebApp;
  if (!w) {
    return {
      hasWebApp: false,
      hint: "No window.Telegram.WebApp. Load telegram-web-app.js and open inside the Telegram app (not Safari/Chrome alone).",
    };
  }
  const init = w.initData?.trim() ?? "";
  const unsafe = w.initDataUnsafe;
  const unsafeUser =
    unsafe && typeof unsafe === "object" && "user" in unsafe
      ? (unsafe as { user?: unknown }).user
      : undefined;
  const unsafeLooksEmpty =
    !unsafe ||
    (typeof unsafe === "object" && Object.keys(unsafe as object).length === 0);

  let diagnosis: string | null = null;
  if (init.length === 0) {
    if (w.platform === "unknown" && unsafeLooksEmpty) {
      diagnosis =
        "platform=unknown and initDataUnsafe is empty: this is not a Telegram Mini App launch. The WebApp script is present, but Telegram did not attach launch data. Fix: BotFather → Configure Mini App / Menu Button URL = your HTTPS origin; open via that bot entry (Menu or inline button with Mini App), not “Open in browser” or a bare web tab.";
    } else if (unsafeUser != null) {
      diagnosis =
        "initDataUnsafe has user but signed initData is empty — not a valid Mini App launch for server verification; open from the bot’s Mini App entry.";
    } else {
      diagnosis =
        "Signed initData missing. Open from the bot’s Mini App (menu or keyboard). External browsers and many t.me link flows never receive initData.";
    }
  }

  return {
    hasWebApp: true,
    initDataLength: init.length,
    initDataEmpty: init.length === 0,
    initDataUnsafe: unsafe ?? null,
    version: w.version ?? null,
    platform: w.platform ?? null,
    diagnosis,
    hint:
      init.length === 0
        ? "Signed initData is empty. Open the bot → Menu button / keyboard button that launches the Mini App. Opening the site URL in an external browser or a plain t.me link often leaves initData empty — Better Auth needs the signed string to verify."
        : null,
  };
}

/**
 * Wait for non-empty `initData` (after `ready()`, Telegram may fill it shortly).
 */
export async function waitForTelegramInitData(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const intervalMs = options?.intervalMs ?? 40;
  if (typeof window === "undefined") return Promise.resolve(null);

  await notifyTelegramWebAppReady();
  try {
    window.Telegram?.WebApp?.expand?.();
  } catch {
    /* ignore */
  }
  await new Promise<void>((r) => {
    window.setTimeout(r, 200);
  });

  const rawNow = window.Telegram?.WebApp?.initData?.trim() ?? "";
  if (rawNow) return rawNow;

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
