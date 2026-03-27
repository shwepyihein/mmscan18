import { telegramClient } from 'better-auth-telegram/client';
import { parseJSON } from 'better-auth/client';
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
  if (typeof window !== 'undefined') return window.location.origin;
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

const BETTER_AUTH_TOKEN_KEY = 'better_auth_session_token';

export const getStoredBetterAuthToken = () =>
  typeof window !== 'undefined'
    ? localStorage.getItem(BETTER_AUTH_TOKEN_KEY)
    : null;

export const setStoredBetterAuthToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(BETTER_AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(BETTER_AUTH_TOKEN_KEY);
};

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  fetchOptions: {
    /** Explicitly omit cookies to rely entirely on headers. */
    credentials: 'omit',
    jsonParser: (text: string) =>
      text ? parseJSON(text, { strict: false }) : null,
    hooks: {
      beforeRequest: async ({ request }: any) => {
        const token = getStoredBetterAuthToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
        return request;
      },
    },
  },
  plugins: [jwtClient(), telegramClient()],
});

const toStringFields = (fields: object): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v != null) out[k] = String(v);
  }
  return out;
};

export async function signInWithTelegramBrowser(fields: object): Promise<void> {
  const res = await fetch(`${resolveBaseURL()}/api/auth/telegram/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    /** Omit cookies here too. */
    credentials: 'omit',
    body: JSON.stringify(toStringFields(fields)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || 'Telegram sign-in failed');
  
  // Use the session token from the response for header fallback
  if (body.session?.token) {
    setStoredBetterAuthToken(body.session.token);
  }
}

export function isTelegramMiniAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.Telegram?.WebApp;
  if (!w) return false;
  if ((w.initData?.trim() ?? '').length > 0) return true;
  const p = (w.platform ?? '').trim().toLowerCase();
  if (p && p !== 'unknown') return true;
  return !!(w.initDataUnsafe && Object.keys(w.initDataUnsafe).length > 0);
}

export async function waitForTelegramWebApp(options?: {
  timeoutMs?: number;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  if (typeof window === 'undefined') return false;
  if (isTelegramMiniAppEnvironment()) return true;

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isTelegramMiniAppEnvironment()) return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 50);
    };
    tick();
  });
}

export async function notifyTelegramWebAppReady(): Promise<void> {
  const w = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  if (!w?.ready) return;
  return new Promise((resolve) => {
    let done = false;
    const once = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    w.ready!(once);
    setTimeout(once, 4000);
  });
}

export function getTelegramWebAppDebugSnapshot(): Record<string, any> {
  if (typeof window === 'undefined') return { error: 'SSR' };
  const w = window.Telegram?.WebApp;
  if (!w) return { hasWebApp: false };
  const init = w.initData?.trim() ?? '';
  return {
    hasWebApp: true,
    initDataLength: init.length,
    initDataEmpty: init.length === 0,
    initDataUnsafe: w.initDataUnsafe,
    version: w.version,
    platform: w.platform,
  };
}

const TG_RELOAD_KEY = 'tg_miniapp_reload_v1';
export function reloadOnceForTelegramInitData(): boolean {
  if (
    typeof window === 'undefined' ||
    !window.Telegram?.WebApp ||
    (window.Telegram.WebApp.initData?.trim() ?? '')
  )
    return false;
  if (sessionStorage.getItem(TG_RELOAD_KEY) === '1') return false;
  sessionStorage.setItem(TG_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}

export function clearTelegramInitDataReloadFlag() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(TG_RELOAD_KEY);
}

export async function waitForTelegramInitData(options?: {
  timeoutMs?: number;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  await notifyTelegramWebAppReady();
  try {
    window.Telegram?.WebApp?.expand?.();
  } catch {}

  const timeoutMs = options?.timeoutMs ?? 15000;
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const raw = window.Telegram?.WebApp?.initData?.trim() ?? '';
      if (raw) return resolve(raw);
      if (Date.now() - start >= timeoutMs) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

export async function signInTelegramMiniApp(initData: string): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Requires browser');
  const raw = initData?.trim();
  if (!raw) throw new Error('initData empty');

  const client = authClient as any;
  if (typeof client.signInWithMiniApp !== 'function')
    throw new Error('Missing plugin');

  const result = await client.signInWithMiniApp(raw, {
    fetchOptions: {
      credentials: 'omit',
    }
  });
  if (result.error) throw new Error(result.error.message || 'Sign-in failed');
  
  // Use the session token from the response for header fallback
  if (result.data?.session?.token) {
    setStoredBetterAuthToken(result.data.session.token);
  }

  (authClient as any).$store?.notify('$sessionSignal');
  clearTelegramInitDataReloadFlag();
}
