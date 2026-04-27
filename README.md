# hotManhwammhub (frontend)

Next.js 14 app for browsing manhwa, shop/coins, Telegram auth, and reader.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env — set NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME, etc.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication

- **Nest** at `NEXT_PUBLIC_API_URL` handles Telegram (widget + Mini App `initData`) and email login; see `api/users` (`ensureNestTelegramSession`, `loginWithEmailPassword`, `fetchCurrentProfile`).
- The browser stores the **Nest access token** in `localStorage` (`lib/api-client.ts`) and sends `Authorization: Bearer …` to Nest for manhwa, wallet, and profile.
- **Telegram WebApp helpers** live in `lib/telegram-webapp.ts` (initData polling, ready, debug snapshot).
- **Telegram Mini App setup:** [docs/TELEGRAM_MINI_APP_SETUP.md](docs/TELEGRAM_MINI_APP_SETUP.md)
- **Nest JWT expectations:** [docs/NEST_JWT.md](docs/NEST_JWT.md)

## Production checklist

1. **Environment variables**

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Nest / API base (HTTPS, no trailing slash). |
   | `NEXT_PUBLIC_API_GLOBAL_PREFIX` | Optional (e.g. `api`) when Nest uses `setGlobalPrefix('api')`. |
   | `NEXT_PUBLIC_SITE_URL` | Origin users open; Telegram Login Widget. |
   | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username without `@`. |
   | `TELEGRAM_BOT_TOKEN` | If needed for server code; Nest verifies initData for auth. |
   | `NEXT_PUBLIC_DEFAULT_CHAPTER_COIN_PRICE` | Default coin price when the API omits it. |

2. **Telegram (BotFather):** set the bot domain / Mini App URL to your deployed frontend.

3. **Build**

   ```bash
   npm run build
   npm run start
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
