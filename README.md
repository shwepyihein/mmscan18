# hotManhwammhub (frontend)

Next.js 14 app for browsing manhwa, shop/coins, Telegram auth, and reader.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL, BETTER_AUTH_SECRET, TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_API_URL, etc.
npx @better-auth/cli migrate -y
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication (Better Auth on Next.js)

- **Sessions and Telegram login** run on this app via [Better Auth](https://www.better-auth.com/): App Router handler `app/api/auth/[...all]/route.ts`, config in `lib/auth.ts`, PostgreSQL (`DATABASE_URL`).
- **Telegram**: [better-auth-telegram](https://github.com/vcode-sh/better-auth-telegram) verifies the Login Widget and Mini App `initData` using `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
- **JWT for Nest**: the JWT plugin exposes `GET /api/auth/token` (client: `authClient.token()`). The axios client (`lib/api-client.ts`) sends `Authorization: Bearer …` to your **Nest** base URL for `GET /auth/me` and other APIs.
- **Nest** should validate those JWTs using JWKS at `{BETTER_AUTH_URL}/api/auth/jwks`. See [docs/NEST_JWT.md](docs/NEST_JWT.md).
- **Telegram Mini App setup** (bot, env, tunnel, troubleshooting): [docs/TELEGRAM_MINI_APP_SETUP.md](docs/TELEGRAM_MINI_APP_SETUP.md).

### Telegram endpoints (same-origin)

| Flow | Route |
|------|--------|
| Mini App `initData` | `POST /api/auth/telegram/miniapp/validate` then `POST /api/auth/telegram/miniapp/signin` |
| Browser Login Widget | `POST /api/auth/telegram/signin` (creates user if missing when `autoCreateUser` is enabled) |

## Production checklist

1. **Environment variables** (hosting dashboard, e.g. Vercel)

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | PostgreSQL for Better Auth. |
   | `BETTER_AUTH_SECRET` | At least 32 characters (`openssl rand -base64 32`). |
   | `BETTER_AUTH_URL` | Public HTTPS origin of this Next app (no trailing slash). |
   | `TELEGRAM_BOT_TOKEN` | From @BotFather (server-only). |
   | `NEXT_PUBLIC_API_URL` | Nest / API base (HTTPS, no trailing slash). |
   | `NEXT_PUBLIC_API_GLOBAL_PREFIX` | Optional (e.g. `api`) when Nest uses `setGlobalPrefix('api')`. |
   | `NEXT_PUBLIC_SITE_URL` | Same origin users open in the browser; Telegram Login Widget redirect. |
   | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username without `@`. |
   | `NEXT_PUBLIC_DEFAULT_CHAPTER_COIN_PRICE` | Default coin price when the API omits it. |

2. **Database**: run `npx @better-auth/cli migrate -y` after deploy when schema changes (or use your own migration pipeline).

3. **Telegram (BotFather)**: set the bot domain to your **`NEXT_PUBLIC_SITE_URL`** host. For Mini App, point the Web App URL to your deployed site.

4. **Nest**: configure JWT verification as in [docs/NEST_JWT.md](docs/NEST_JWT.md); align `GET /auth/me` with the JWT `sub` / `telegramId` you expect.

5. **Health check**: `GET /api/health` returns `{ ok: true, timestamp: ... }`.

6. **Build**

   ```bash
   npm run build
   npm run start
   ```

## Profile / `GET /auth/me`

The UI expects `coins` for the wallet pill. Responses are merged with Better Auth’s user when Nest is unavailable; coins default to `0` if omitted.

## Telegram login modes

- **Redirect (production):** set `NEXT_PUBLIC_SITE_URL` to the **exact** origin users use (HTTPS, no trailing slash). The widget uses `data-auth-url` → `/auth/telegram-callback?mode=…`. On **localhost**, redirect mode is disabled automatically so it does not clash with a production `NEXT_PUBLIC_SITE_URL`.
- **Inline callback:** used on localhost or when `NEXT_PUBLIC_SITE_URL` is unset — same-page `onTelegramAuth` handlers.

### “Bot domain invalid” (Telegram widget)

Telegram only allows the Login Widget on domains you register for the bot:

1. Open [@BotFather](https://t.me/BotFather) → your bot → **Bot Settings** → **Domain** (or `/setdomain`) and set the **exact** host users open (no `http://`, e.g. `app.example.com` or `www.example.com` — match `www` with how you deploy).
2. **Localhost is not allowed.** Use a tunnel (e.g. ngrok) with HTTPS, add that hostname in BotFather, and open the app via that URL — not `http://localhost:3000`.
3. Ensure `NEXT_PUBLIC_SITE_URL` matches the browser’s origin when redirect mode is on (the app shows a warning if they differ).
4. **Bot username:** use the bot’s `@username` without `@`. Display titles are not valid for the widget.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npx @better-auth/cli migrate -y` | Apply Better Auth DB migrations |
