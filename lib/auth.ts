import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";
import { telegramAuthPlugin } from "@/lib/telegram-plugin";

const globalForPool = globalThis as unknown as { betterAuthPgPool: Pool | undefined };

function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for Better Auth");
  }
  if (!globalForPool.betterAuthPgPool) {
    globalForPool.betterAuthPgPool = new Pool({ connectionString: url });
  }
  return globalForPool.betterAuthPgPool;
}

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set (at least 32 characters)");
  }
  return s;
}

function getBaseURL(): string {
  const u =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return u.replace(/\/$/, "");
}

function trustedOriginsList(): string[] {
  const base = getBaseURL();
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const set = new Set<string>([
    base,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(extra ?? []),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) set.add(site);
  return Array.from(set);
}

export const auth = betterAuth({
  database: getPool(),
  secret: getSecret(),
  baseURL: getBaseURL(),
  trustedOrigins: trustedOriginsList(),
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      telegramId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          sub: user.id,
          telegramId: user.telegramId,
        }),
        expirationTime: "7d",
      },
    }),
    telegramAuthPlugin(),
    nextCookies(),
  ],
});
