import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Telegram Login Widget (browser) — https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidget(
  fields: Record<string, string>,
  botToken: string,
): { ok: true } | { ok: false; reason: string } {
  const hash = fields.hash;
  if (!hash) return { ok: false, reason: 'Missing hash' };
  const pairs = Object.entries(fields)
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const hmac = createHmac('sha256', secretKey).update(pairs).digest('hex');
  return timingSafeEqualHex(hmac, hash)
    ? { ok: true }
    : { ok: false, reason: 'Invalid Telegram widget signature' };
}

export type ParsedTelegramInitUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/**
 * Telegram Mini App `initData` — https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramMiniAppInitData(
  initData: string,
  botToken: string,
):
  | { ok: true; user: ParsedTelegramInitUser; authDate: number }
  | { ok: false; reason: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'Missing hash' };

  const entries = Array.from(params.entries()).filter(([k]) => k !== 'hash');
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const hmac = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  if (!timingSafeEqualHex(hmac, hash)) {
    return { ok: false, reason: 'Invalid initData signature' };
  }

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : NaN;
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: 'Missing auth_date' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'Missing user' };
  try {
    const user = JSON.parse(userRaw) as ParsedTelegramInitUser;
    if (typeof user?.id !== 'number') {
      return { ok: false, reason: 'Invalid user in initData' };
    }
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: 'Invalid user JSON in initData' };
  }
}
