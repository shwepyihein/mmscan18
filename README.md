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

3. **Backend**

   - CORS / cookies: if the API is on another domain, configure `credentials` and `SameSite` so session cookies from login work in the browser.
   - Telegram auth is proxied from Next to your API:
     - **Browser widget (login)** → `POST /auth/telegram-login` (via `/api/auth/telegram-browser`)
     - **Browser widget (register)** → `POST /auth/telegram-register` (via `/api/auth/telegram-browser-register`)
     - **Mini App `initData`** → `POST /auth/telegram-register` (via `/api/auth/telegram-sync`)
     - **User exists** → `GET` or `POST /auth/telegram-user-exists` (via `/api/auth/telegram-user-exists`; optional `fetchTelegramUserExists` in `api/users`)
   - Override paths with `TELEGRAM_BROWSER_LOGIN_PATH`, `TELEGRAM_REGISTER_PATH`, `TELEGRAM_USER_EXISTS_PATH` if your API differs.
   - Profile: `GET /users/profile` (direct to `NEXT_PUBLIC_API_URL`).

4. **Health check**

   - `GET /api/health` returns `{ ok: true, timestamp: ... }` for uptime checks.

5. **Build**

   ```bash
   npm run build
   npm run start
   ```

## Telegram login modes

- **Redirect (production):** set `NEXT_PUBLIC_SITE_URL`. The widget uses `data-auth-url` → `/auth/telegram-callback`, then redirects to `/profile` (or `?next=/path` if you add that query on the widget URL later).
- **Inline callback (local):** leave `NEXT_PUBLIC_SITE_URL` unset. The widget uses `onTelegramAuth` on the same page (e.g. Profile).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
