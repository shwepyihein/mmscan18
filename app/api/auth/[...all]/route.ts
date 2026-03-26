import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CookieStore = ReturnType<typeof cookies>;

/** Merge `next/headers` cookies onto the request when `Cookie` is incomplete. */
function withMergedCookieHeader(request: Request, store: CookieStore): Request {
  const headerLine = request.headers.get('cookie')?.trim() ?? '';
  const presentNames = new Set(
    headerLine
      .split(/;\s*/)
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        return (eq === -1 ? part : part.slice(0, eq)).trim();
      }),
  );

  const extra: string[] = [];
  for (const { name, value } of store.getAll()) {
    if (name && !presentNames.has(name)) {
      extra.push(`${name}=${value}`);
    }
  }
  if (extra.length === 0) return request;

  const merged = [headerLine, ...extra].filter(Boolean).join('; ');
  const headers = new Headers(request.headers);
  headers.set('cookie', merged);

  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Request(request.url, { method: request.method, headers });
  }

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    duplex: 'half',
  } as RequestInit);
}

async function handler(request: Request): Promise<Response> {
  const store = cookies();
  const req = withMergedCookieHeader(request, store);
  return auth.handler(req);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
