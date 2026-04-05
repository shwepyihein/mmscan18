/**
 * Whether we should run @telegram-apps/sdk init (initMiniApp, viewport, theme, …).
 *
 * `isTMA()` from the SDK alone is **not** reliable: we load `telegram-web-app.js`
 * globally in `_document`, and it responds to `web_app_request_theme`, so `isTMA()`
 * becomes true even in a normal top-level browser. That runs Mini App init outside
 * Telegram and can throw (e.g. undefined `.payload` on bridge events).
 */
export function shouldInitializeTelegramMiniAppSdk(): boolean {
  if (typeof window === 'undefined') return false;

  const w = window as Window & {
    TelegramWebviewProxy?: { postEvent?: unknown };
  };
  if (
    'TelegramWebviewProxy' in w &&
    w.TelegramWebviewProxy &&
    typeof w.TelegramWebviewProxy.postEvent === 'function'
  ) {
    return true;
  }

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  return false;
}
