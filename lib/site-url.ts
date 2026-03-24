/** Public site origin for Telegram widget `data-auth-url` (no trailing slash). */
export function getPublicSiteUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!u) return undefined;
  return u.replace(/\/$/, "");
}
