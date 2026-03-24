import {
  verifyTelegramLoginWidget,
  verifyTelegramMiniAppInitData,
} from '@/lib/telegram-verify';
import { createAuthEndpoint } from '@better-auth/core/api';
import type { BetterAuthPlugin } from 'better-auth';
import { setSessionCookie } from 'better-auth/cookies';
import { parseUserOutput } from 'better-auth/db';
import * as z from 'zod';

const widgetBodySchema = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .transform((obj) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'string' ? v : String(v);
    }
    return out;
  });

const initDataBodySchema = z.object({
  initData: z.string(),
});

const userExistsBodySchema = z.object({
  telegramId: z.string(),
});

function getBotToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!t) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  return t;
}

function displayNameFromTelegram(p: {
  first_name?: string;
  last_name?: string;
  username?: string;
  id: number | string;
}): string {
  const parts = [p.first_name, p.last_name].filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  if (parts.length) return parts.join(' ');
  if (typeof p.username === 'string' && p.username.length > 0) {
    return p.username;
  }
  return `User ${p.id}`;
}

export function telegramAuthPlugin(): BetterAuthPlugin {
  return {
    id: 'telegram-auth',
    endpoints: {
      signInTelegramWidget: createAuthEndpoint(
        '/telegram/sign-in-widget',
        {
          method: 'POST',
          body: widgetBodySchema,
        },
        async (ctx) => {
          const botToken = getBotToken();
          const v = verifyTelegramLoginWidget(ctx.body, botToken);
          if (!v.ok) {
            throw ctx.error('UNAUTHORIZED', { message: v.reason });
          }
          const id = ctx.body.id;
          if (!id) throw ctx.error('BAD_REQUEST', { message: 'Missing id' });
          const telegramId = String(id);

          const users = await ctx.context.internalAdapter.listUsers(
            1,
            0,
            undefined,
            [{ field: 'telegramId', value: telegramId }],
          );
          const existing = users[0] ?? null;
          if (!existing) {
            throw ctx.error('NOT_FOUND', {
              message: 'No account for this Telegram user. Register first.',
            });
          }

          const name = displayNameFromTelegram({
            id: telegramId,
            first_name: ctx.body.first_name,
            last_name: ctx.body.last_name,
            username: ctx.body.username,
          });
          const image =
            typeof ctx.body.photo_url === 'string'
              ? ctx.body.photo_url
              : undefined;

          const user = await ctx.context.internalAdapter.updateUser(
            String(existing.id),
            {
              name,
              image: image ?? null,
              updatedAt: new Date(),
            },
          );
          if (!user)
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Update failed',
            });

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          if (!session) {
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Could not create session',
            });
          }
          await setSessionCookie(ctx, { session, user });
          return ctx.json({
            user: parseUserOutput(ctx.context.options, user),
          });
        },
      ),

      registerTelegramWidget: createAuthEndpoint(
        '/telegram/register-widget',
        {
          method: 'POST',
          body: widgetBodySchema,
        },
        async (ctx) => {
          const botToken = getBotToken();
          const v = verifyTelegramLoginWidget(ctx.body, botToken);
          if (!v.ok) {
            throw ctx.error('UNAUTHORIZED', { message: v.reason });
          }
          const id = ctx.body.id;
          if (!id) throw ctx.error('BAD_REQUEST', { message: 'Missing id' });
          const telegramId = String(id);

          const users = await ctx.context.internalAdapter.listUsers(
            1,
            0,
            undefined,
            [{ field: 'telegramId', value: telegramId }],
          );
          const existing = users[0] ?? null;
          if (existing) {
            throw ctx.error('BAD_REQUEST', {
              message:
                'This Telegram account is already registered. Use Log in.',
            });
          }

          const name = displayNameFromTelegram({
            id: telegramId,
            first_name: ctx.body.first_name,
            last_name: ctx.body.last_name,
            username: ctx.body.username,
          });
          const image =
            typeof ctx.body.photo_url === 'string'
              ? ctx.body.photo_url
              : undefined;

          const newUser = await ctx.context.internalAdapter.createUser({
            email: `tg_${telegramId}@telegram.local`,
            emailVerified: true,
            name,
            image: image ?? undefined,
            telegramId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          if (!newUser) {
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Could not create user',
            });
          }

          const session = await ctx.context.internalAdapter.createSession(
            newUser.id,
          );
          if (!session) {
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Could not create session',
            });
          }
          await setSessionCookie(ctx, { session, user: newUser });
          return ctx.json({
            user: parseUserOutput(ctx.context.options, newUser),
          });
        },
      ),

      syncTelegramMiniApp: createAuthEndpoint(
        '/telegram/sync-mini-app',
        {
          method: 'POST',
          body: initDataBodySchema,
        },
        async (ctx) => {
          const botToken = getBotToken();
          const v = verifyTelegramMiniAppInitData(ctx.body.initData, botToken);
          if (!v.ok) {
            throw ctx.error('UNAUTHORIZED', { message: v.reason });
          }

          const telegramId = String(v.user.id);
          const name = displayNameFromTelegram(v.user);
          const image =
            typeof v.user.photo_url === 'string' ? v.user.photo_url : undefined;

          const users = await ctx.context.internalAdapter.listUsers(
            1,
            0,
            undefined,
            [{ field: 'telegramId', value: telegramId }],
          );
          const existing = users[0] ?? null;
          let user = existing
            ? await ctx.context.internalAdapter.updateUser(
                String(existing.id),
                {
                  name,
                  image: image ?? null,
                  updatedAt: new Date(),
                },
              )
            : await ctx.context.internalAdapter.createUser({
                email: `tg_${telegramId}@telegram.local`,
                emailVerified: true,
                name,
                image: image ?? undefined,
                telegramId,
                createdAt: new Date(),
                updatedAt: new Date(),
              });

          if (!user) {
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Could not resolve user',
            });
          }

          const session = await ctx.context.internalAdapter.createSession(
            String(user.id),
          );
          if (!session) {
            throw ctx.error('INTERNAL_SERVER_ERROR', {
              message: 'Could not create session',
            });
          }
          await setSessionCookie(ctx, { session, user });
          return ctx.json({
            user: parseUserOutput(ctx.context.options, user),
          });
        },
      ),

      telegramUserExists: createAuthEndpoint(
        '/telegram/user-exists',
        {
          method: 'POST',
          body: userExistsBodySchema,
        },
        async (ctx) => {
          const rows = await ctx.context.internalAdapter.listUsers(
            1,
            0,
            undefined,
            [{ field: 'telegramId', value: ctx.body.telegramId }],
          );
          const u = rows[0];
          return ctx.json({
            exists: Boolean(u),
            userId: u && typeof u.id === 'string' ? u.id : undefined,
          });
        },
      ),
    },
  };
}
