/** Base URL for API calls. Set `NEXT_PUBLIC_API_URL`; optional `NEXT_PUBLIC_API_GLOBAL_PREFIX` (e.g. `api`). */
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
