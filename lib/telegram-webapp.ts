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

function isTelegramMiniAppEnvironment(): boolean {
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

export function getTelegramWebAppDebugSnapshot(): Record<string, unknown> {
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

export async function waitForTelegramInitData(options?: {
  timeoutMs?: number;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  await notifyTelegramWebAppReady();
  try {
    window.Telegram?.WebApp?.expand?.();
  } catch {
    /* ignore */
  }

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
