/** Backend routes (relative to `NEXT_PUBLIC_API_URL`). Override via env if needed. */

export const DEFAULT_TELEGRAM_BROWSER_LOGIN_PATH = "/auth/telegram-login";

/** Telegram Mini App: `initData` sync / register. */
export const DEFAULT_TELEGRAM_REGISTER_PATH = "/auth/telegram-register";

/** Optional: check if a Telegram user already exists before login/register. */
export const DEFAULT_TELEGRAM_USER_EXISTS_PATH = "/auth/telegram-user-exists";
