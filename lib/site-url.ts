import { isLocalhostHostname } from "@/lib/telegram-domain";

/**
 * Public site origin for Telegram widget `data-auth-url` (no trailing slash).
 * On localhost, returns `undefined` so we use inline `onTelegramAuth` only — mixing
 * a production `NEXT_PUBLIC_SITE_URL` with a localhost embed breaks Telegram domain checks.
 */
export function getPublicSiteUrl(): string | undefined {
  if (typeof window !== "undefined") {
    if (isLocalhostHostname(window.location.hostname)) {
      return undefined;
    }
  }
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!u) return undefined;
  return u.replace(/\/$/, "");
}
