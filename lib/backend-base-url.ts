/**
 * Backend base URL for all API calls (browser + Next.js proxies).
 *
 * Nest often uses `app.setGlobalPrefix('api')` so auth lives at `/api/auth/...`, not `/auth/...`.
 *
 * Either set:
 * - `NEXT_PUBLIC_API_URL=https://your-host.railway.app/api` (prefix included), or
 * - `NEXT_PUBLIC_API_URL=https://your-host.railway.app` and `NEXT_PUBLIC_API_GLOBAL_PREFIX=api`
 */
export function getBackendBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (!raw) return "";

  let base = raw.replace(/\/$/, "");
  const prefix = (process.env.NEXT_PUBLIC_API_GLOBAL_PREFIX ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (prefix) {
    const suffix = `/${prefix}`;
    if (!base.toLowerCase().endsWith(suffix)) {
      base = `${base}${suffix}`;
    }
  }

  return base.replace(/\/$/, "");
}
