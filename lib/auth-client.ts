import { telegramClient } from 'better-auth-telegram/client';
import { jwtClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

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
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
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
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
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
    credentials: 'include',
    jsonParser: safeAuthJsonParser,
  },
  plugins: [jwtClient(), telegramClient()],
});

function toStringFields(fields: object): Record<string, string> {
  const stringFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    stringFields[k] = typeof v === 'string' ? v : String(v);
  }
  return stringFields;
}

/**
 * Telegram Login Widget (browser) or `/auth/telegram-callback` query → Better Auth
 * `POST /api/auth/telegram/signin`. First visit creates the user; later visits sign in.
 * Does not call Nest (`NEXT_PUBLIC_API_URL` / `/auth/telegram-login`).
 */
export async function signInWithTelegramBrowser(fields: object): Promise<void> {
  const stringFields = toStringFields(fields);
  const base = resolveBaseURL();
  const res = await fetch(`${base}/api/auth/telegram/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(stringFields),
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'Telegram sign-in failed',
    );
  }
}

/**
 * True only for a real Mini App launch, not a normal browser tab that loaded
 * `telegram-web-app.js` (those still get `window.Telegram.WebApp` with `platform: "unknown"`
 * and empty `initData`).
 */
function isRealTelegramMiniAppContext(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.Telegram?.WebApp;
  if (!w) return false;

  const initData = w.initData?.trim() ?? '';
  if (initData.length > 0) return true;

  const platform = (w.platform ?? '').trim().toLowerCase();
  if (platform === '' || platform === 'unknown') return false;

  const unsafe = w.initDataUnsafe;
  if (
    unsafe &&
    typeof unsafe === 'object' &&
    !Array.isArray(unsafe) &&
    Object.keys(unsafe).length > 0
  ) {
    return true;
  }

  return false;
}

/**
 * `window.Telegram.WebApp` exists and looks like Telegram actually opened this URL as a Mini App.
 */
export function isTelegramMiniAppEnvironment(): boolean {
  return isRealTelegramMiniAppContext();
}

/**
 * Wait until this tab looks like a Telegram Mini App (signed `initData` or real client `platform` +
 * launch payload). Plain browsers that only define `WebApp` as a stub will time out as `false`.
 */
export function waitForTelegramWebApp(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 40;
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (isRealTelegramMiniAppContext()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isRealTelegramMiniAppContext()) {
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
  if (typeof window === 'undefined') return Promise.resolve();
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
      if (typeof w.ready === 'function') {
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
  if (typeof window === 'undefined') {
    return { error: 'SSR — no window' };
  }
  const w = window.Telegram?.WebApp;
  if (!w) {
    return {
      hasWebApp: false,
      hint: 'No window.Telegram.WebApp. Load telegram-web-app.js and open inside the Telegram app (not Safari/Chrome alone).',
    };
  }
  const init = w.initData?.trim() ?? '';
  const unsafe = w.initDataUnsafe;
  const unsafeUser =
    unsafe && typeof unsafe === 'object' && 'user' in unsafe
      ? (unsafe as { user?: unknown }).user
      : undefined;
  const unsafeLooksEmpty =
    !unsafe ||
    (typeof unsafe === 'object' && Object.keys(unsafe as object).length === 0);

  let diagnosis: string | null = null;
  if (init.length === 0) {
    if (w.platform === 'unknown' && unsafeLooksEmpty) {
      diagnosis =
        'platform=unknown and initDataUnsafe is empty: this is not a Telegram Mini App launch. The WebApp script is present, but Telegram did not attach launch data. Fix: BotFather → Configure Mini App / Menu Button URL = your HTTPS origin; open via that bot entry (Menu or inline button with Mini App), not “Open in browser” or a bare web tab.';
    } else if (unsafeUser != null) {
      diagnosis =
        'initDataUnsafe has user but signed initData is empty — not a valid Mini App launch for server verification; open from the bot’s Mini App entry.';
    } else {
      diagnosis =
        'Signed initData missing. Open from the bot’s Mini App (menu or keyboard). External browsers and many t.me link flows never receive initData.';
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
        ? 'Signed initData is empty. Open the bot → Menu button / keyboard button that launches the Mini App. Opening the site URL in an external browser or a plain t.me link often leaves initData empty — Better Auth needs the signed string to verify.'
        : null,
  };
}

/**
 * Wait for non-empty `initData` (after `ready()`, Telegram may fill it shortly).
 */
/** One reload per tab session if Telegram WebApp exists but `initData` is still empty (race / cold start). */
const TELEGRAM_INITDATA_RELOAD_KEY = 'tg_miniapp_initdata_reload_v1';

/**
 * If `Telegram.WebApp` is present, `initData` is empty, and we have not reloaded this tab yet,
 * set a flag and reload. Returns `true` if a reload was triggered (navigation follows).
 */
export function reloadOnceForTelegramInitData(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.Telegram?.WebApp) return false;
  const raw = window.Telegram.WebApp.initData?.trim() ?? '';
  if (raw) return false;
  if (sessionStorage.getItem(TELEGRAM_INITDATA_RELOAD_KEY) === '1') {
    return false;
  }
  sessionStorage.setItem(TELEGRAM_INITDATA_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}

/** Call after successful Mini App sign-in so a later empty `initData` edge case can retry once. */
export function clearTelegramInitDataReloadFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TELEGRAM_INITDATA_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

export async function waitForTelegramInitData(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const intervalMs = options?.intervalMs ?? 40;
  if (typeof window === 'undefined') return Promise.resolve(null);

  await notifyTelegramWebAppReady();
  try {
    window.Telegram?.WebApp?.expand?.();
  } catch {
    /* ignore */
  }
  await new Promise<void>((r) => {
    window.setTimeout(r, 200);
  });

  const rawNow = window.Telegram?.WebApp?.initData?.trim() ?? '';
  if (rawNow) return rawNow;

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const raw = window.Telegram?.WebApp?.initData?.trim() ?? '';
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
  if (typeof window === 'undefined') {
    throw new Error('Mini App sign-in requires a browser.');
  }
  const c = authClient as unknown as {
    autoSignInFromMiniApp: () => Promise<MiniAppSignInResult>;
  };
  const result = await c.autoSignInFromMiniApp();
  if (result?.error) {
    throw new Error(result.error.message ?? 'Telegram Mini App sign-in failed');
  }
  clearTelegramInitDataReloadFlag();
}
