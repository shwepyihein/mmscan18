# hotManhwammhub (frontend)

Next.js 14 app for browsing manhwa, shop/coins, Telegram auth, and reader.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env — at minimum set NEXT_PUBLIC_API_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production checklist

1. **Environment variables** (hosting dashboard, e.g. Vercel → Project → Settings → Environment Variables)

   | Variable | Notes |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Your backend base URL (HTTPS). |
   | `NEXT_PUBLIC_SITE_URL` | **HTTPS** origin of this frontend, no trailing slash. Enables Telegram widget **redirect** login to `/auth/telegram-callback`. |
   | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username (no `@`). |
   | `BETTER_AUTH_API_KEY` | Bearer token for Next.js `/api/auth/*` → backend. **Prefer this** over any `NEXT_PUBLIC_*` secret. |
   | `NEXT_PUBLIC_TELEGRAM_TOKEN` | Optional fallback if the proxy secret is only available under this name (avoid in production if possible). |
   | `NEXT_PUBLIC_DEFAULT_CHAPTER_COIN_PRICE` | Default coin price when the API omits it. |

2. **Telegram (BotFather)**

   - Create/configure the bot; set domain to your **`NEXT_PUBLIC_SITE_URL`** host so the Login Widget and callback URL are allowed.
   - For Mini App: point the Web App URL to your deployed site.

3. **Backend (Nest-aligned)**

   - CORS / cookies: if the API is on another domain, configure `credentials` and `SameSite` so session cookies from login work in the browser.
   - Telegram auth is proxied from Next to your API:

| Flow | Next.js route | Default upstream |
|------|----------------|-------------------|
| Browser widget **Login** | `POST /api/auth/telegram-browser` | `POST /auth/telegram-login` (upsert) |
| Browser widget **Register** | `POST /api/auth/telegram-browser-register` | `POST /auth/telegram-register` (new only) |
| **Mini App** `initData` | `POST /api/auth/telegram-sync` | `POST /auth/telegram-login` (upsert) |
| User exists | `POST /api/auth/telegram-user-exists` | `POST /auth/telegram-user-exists` (JSON `{ telegramId }`) |

   - Override paths with `TELEGRAM_BROWSER_LOGIN_PATH`, `TELEGRAM_SYNC_PATH`, `TELEGRAM_BROWSER_REGISTER_PATH`, `TELEGRAM_USER_EXISTS_PATH` if your API differs.
   - Session: auth responses should include `accessToken` (stored client-side); `GET /auth/me` returns the current user (see `api/users`).

4. **Health check**

   - `GET /api/health` returns `{ ok: true, timestamp: ... }` for uptime checks.

5. **Build**

   ```bash
   npm run build
   npm run start
   ```

## Profile / `GET /auth/me`

The UI expects `coins` for the wallet pill; if your Nest `getCurrentUser` does not return `coins` yet, the client defaults to `0` until you add a field or a separate wallet endpoint.

## Telegram login modes

- **Redirect (production):** set `NEXT_PUBLIC_SITE_URL` to the **exact** origin users use (HTTPS, no trailing slash). The widget uses `data-auth-url` → `/auth/telegram-callback?mode=…`. On **localhost**, redirect mode is disabled automatically so it does not clash with a production `NEXT_PUBLIC_SITE_URL`.
- **Inline callback:** used on localhost or when `NEXT_PUBLIC_SITE_URL` is unset — same-page `onTelegramAuth` handlers.

### “Bot domain invalid” (Telegram widget)

Telegram only allows the Login Widget on domains you register for the bot:

1. Open [@BotFather](https://t.me/BotFather) → your bot → **Bot Settings** → **Domain** (or `/setdomain`) and set the **exact** host users open (no `http://`, e.g. `app.example.com` or `www.example.com` — match `www` with how you deploy).
2. **Localhost is not allowed.** Use a tunnel (e.g. ngrok) with HTTPS, add that hostname in BotFather, and open the app via that URL — not `http://localhost:3000`.
3. Ensure `NEXT_PUBLIC_SITE_URL` matches the browser’s origin when redirect mode is on (the app shows a warning if they differ).
4. **Bot username:** use the bot’s `@username` without `@` (e.g. `hotmmmanhwapremium_bot`). Display titles like “Hot MM Manhwa Premium Bot” are not valid for the widget.

### Mini App “not found” / 404 (not the widget domain)

The Mini App calls your API via `POST /api/auth/telegram-sync` → Nest `POST /auth/telegram-login` with `{ initData }`. A **404** means the URL or route is wrong: fix `NEXT_PUBLIC_API_URL`, confirm the Nest route exists, and CORS. This is separate from Telegram’s “Bot domain invalid” (browser Login Widget only).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
