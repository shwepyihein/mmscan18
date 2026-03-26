import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Must stay aligned with `advanced.cookiePrefix` in `lib/auth.ts` (default `better-auth`).
 * Chunked cache cookies use names like `__Secure-better-auth.session_data.0`.
 */
const SESSION_DATA_COOKIE =
  /^(?:__Secure-)?better-auth\.session_data(?:\.\d+)?$/;

function withoutSessionDataCookies(cookieHeader: string): string | null {
  const parts = cookieHeader.split(/;\s*/).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    const name = (eq === -1 ? part : part.slice(0, eq)).trim();
    if (SESSION_DATA_COOKIE.test(name)) continue;
    kept.push(part);
  }
  if (kept.length === parts.length) return null;
  return kept.join('; ');
}

/**
 * Better Auth verifies `session_data` before falling back to the DB. A stale or
 * invalid `session_data` cookie (secret rotation, strategy change, partial write)
 * makes `/get-session` return `null` even when `session_token` is valid.
 *
 * With `session.cookieCache.enabled: false` those cookies should not be needed;
 * stripping them here forces DB resolution. See:
 * https://better-auth.com/docs/concepts/session-management
 */
export function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return NextResponse.next();

  const nextCookies = withoutSessionDataCookies(cookieHeader);
  if (nextCookies === null) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  if (nextCookies === '') requestHeaders.delete('cookie');
  else requestHeaders.set('cookie', nextCookies);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: '/api/auth/get-session',
};
