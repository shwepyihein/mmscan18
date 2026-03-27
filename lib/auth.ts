import { betterAuth } from 'better-auth';
import { telegram } from 'better-auth-telegram';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';

const globalForPool = globalThis as unknown as {
  betterAuthPgPool: Pool | undefined;
};

function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required for Better Auth');
  }
  if (!globalForPool.betterAuthPgPool) {
    globalForPool.betterAuthPgPool = new Pool({ connectionString: url });
  }
  return globalForPool.betterAuthPgPool;
}

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set (at least 32 characters)');
  }
  return s;
}

function getBaseURL(): string {
  const u =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000';
  return u.replace(/\/$/, '');
}

/**
 * Read at config init (including `next build`). Use placeholders when unset so
 * the bundle loads; Telegram routes fail verification until real env is set.
 */
function telegramBotToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t ?? '__MISSING_TELEGRAM_BOT_TOKEN__';
}

function telegramBotUsername(): string {
  const u = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  return (u ?? 'missing_bot').replace(/^@/, '');
}

function trustedOriginsList(): string[] {
  const base = getBaseURL();
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const set = new Set<string>([
    base,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://18.manhwammhub.com',
    ...(extra ?? []),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (site) set.add(site);
  const vercelUrl = process.env.VERCEL_URL?.trim().replace(/\/$/, '');
  if (vercelUrl) set.add(`https://${vercelUrl}`);
  return Array.from(set);
}

export const auth = betterAuth({
  database: getPool(),
  secret: getSecret(),
  baseURL: getBaseURL(),
  trustedOrigins: trustedOriginsList(),
  emailAndPassword: { enabled: false },
  advanced: {
    trustedProxyHeaders: true,
    cookie: {
      attributes: {
        sameSite: 'none',
        secure: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours
    freshAge: 0, // Always verify session validity
    cookieCache: {
      enabled: false,
    },
    bearer: {
      enabled: true,
    },
  },
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          sub: user.id,
          telegramId: user.telegramId,
        }),
        expirationTime: '7d',
      },
    }),
    telegram({
      botToken: telegramBotToken(),
      botUsername: telegramBotUsername(),
      autoCreateUser: true,
      mapTelegramDataToUser: (data) => ({
        name: data.last_name
          ? `${data.first_name} ${data.last_name}`
          : data.first_name,
        email: `tg_${data.id}@telegram.local`,
        image: data.photo_url,
      }),
      miniApp: {
        enabled: true,
        validateInitData: true,
        allowAutoSignin: true,
        mapMiniAppDataToUser: (u) => ({
          name: u.last_name ? `${u.first_name} ${u.last_name}` : u.first_name,
          email: `tg_${u.id}@telegram.local`,
          image: u.photo_url,
        }),
      },
    }),
  ],
});
