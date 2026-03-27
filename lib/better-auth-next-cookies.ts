import type { BetterAuthPlugin } from 'better-auth';
import {
  createAuthMiddleware,
  setShouldSkipSessionRefresh,
} from 'better-auth/api';
import { parseSetCookieHeader } from 'better-auth/cookies';

function getSetCookieHeaderValues(headers: Headers): string[] {
  const withGetter = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetter.getSetCookie === 'function') {
    const lines = withGetter.getSetCookie();
    if (lines?.length) return lines;
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

/**
 * Like `nextCookies()` from better-auth, but applies every `Set-Cookie` line.
 * `Headers.get("set-cookie")` only returns the first cookie under Node/Undici,
 * so the stock helper can skip the session cookie when several are set.
 */
export function nextCookiesFixed(): BetterAuthPlugin {
  return {
    id: 'next-cookies-fixed',
    hooks: {
      before: [
        {
          matcher(ctx) {
            return ctx.path === '/get-session';
          },
          handler: createAuthMiddleware(async () => {
            let cookieStore;
            try {
              const { cookies } = await import('next/headers');
              cookieStore = await cookies();
            } catch {
              return;
            }
            try {
              cookieStore.set('__better-auth-cookie-store', '1', { maxAge: 0 });
              cookieStore.delete('__better-auth-cookie-store');
            } catch {
              await setShouldSkipSessionRefresh(true);
            }
          }),
        },
      ],
      after: [
        {
          matcher() {
            return true;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.responseHeaders;
            if ('_flag' in ctx && ctx._flag === 'router') return;
            if (!(returned instanceof Headers)) return;

            const lines = getSetCookieHeaderValues(returned);
            if (!lines.length) return;

            const merged = new Map<
              string,
              NonNullable<
                ReturnType<typeof parseSetCookieHeader> extends Map<
                  string,
                  infer V
                >
                  ? V
                  : never
              >
            >();
            for (const line of lines) {
              parseSetCookieHeader(line).forEach((v, k) => {
                if (k) merged.set(k, v);
              });
            }

            const { cookies } = await import('next/headers');
            let cookieHelper;
            try {
              cookieHelper = await cookies();
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.startsWith(
                  '`cookies` was called outside a request scope.',
                )
              ) {
                return;
              }
              throw error;
            }

            merged.forEach((value, key) => {
              if (!key) return;
              const sameSiteValue =
                value.samesite?.toLowerCase() === 'none'
                  ? 'none'
                  : value.samesite;
              const opts = {
                sameSite: sameSiteValue as any,
                secure: value.secure,
                maxAge: value['max-age'],
                httpOnly: value.httponly,
                domain: value.domain,
                path: value.path,
              };
              try {
                cookieHelper.set(key, value.value, opts);
              } catch {
                /* ignore invalid combos for this runtime */
              }
            });
          }),
        },
      ],
    },
  };
}
