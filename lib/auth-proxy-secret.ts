/**
 * Bearer token for Next.js → backend (Better Auth / Telegram) proxy routes.
 *
 * Prefer `BETTER_AUTH_API_KEY` (server-only, not exposed to the browser bundle).
 * If unset, `NEXT_PUBLIC_TELEGRAM_TOKEN` is used so local setups can match
 * backend env naming; avoid using a public env for production secrets.
 */
export function getBetterAuthProxySecret(): string | undefined {
  const fromApiKey = process.env.BETTER_AUTH_API_KEY?.trim();
  if (fromApiKey) return fromApiKey;
  const fromTelegram = process.env.NEXT_PUBLIC_TELEGRAM_TOKEN?.trim();
  if (fromTelegram) return fromTelegram;
  return undefined;
}
