/** Backend routes (relative to `getBackendBaseUrl()` — includes optional `/api` prefix). */

export const DEFAULT_TELEGRAM_BROWSER_LOGIN_PATH = "/auth/telegram-login";

/** Telegram Mini App: `initData` → upsert login (same as browser login). */
export const DEFAULT_TELEGRAM_SYNC_PATH = "/auth/telegram-login";

/** Browser “Register” widget only (reject if telegramId exists). */
export const DEFAULT_TELEGRAM_BROWSER_REGISTER_PATH = "/auth/telegram-register";

/** Optional: check if a Telegram user already exists. */
export const DEFAULT_TELEGRAM_USER_EXISTS_PATH = "/auth/telegram-user-exists";
