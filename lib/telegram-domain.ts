/** Hosts where Telegram Login Widget cannot use localhost (BotFather domain list). */
export function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local")
  );
}

/**
 * True when the page is opened on a host that differs from `NEXT_PUBLIC_SITE_URL`
 * (Telegram requires the embed origin to match the domain configured for the bot).
 */
export function isPublicSiteUrlHostMismatch(): boolean {
  if (typeof window === "undefined") return false;
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return false;
  if (isLocalhostHostname(window.location.hostname)) return false;
  try {
    const expected = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return expected.host !== window.location.host;
  } catch {
    return false;
  }
}

/**
 * When non-null, skip loading the Login Widget. Telegram still requires @BotFather
 * `/setdomain` for the host users open; localhost cannot be used.
 *
 * Host vs `NEXT_PUBLIC_SITE_URL` mismatches are not blocked here — the widget builds
 * `data-auth-url` from `window.location.origin` so embed and redirect stay aligned.
 */
export function getTelegramLoginWidgetBlockReason(): string | null {
  if (typeof window === "undefined") return null;

  if (isLocalhostHostname(window.location.hostname)) {
    return "Telegram Login cannot use localhost. Use HTTPS (e.g. ngrok) on a host added in @BotFather, and set NEXT_PUBLIC_SITE_URL to that same origin.";
  }

  return null;
}
