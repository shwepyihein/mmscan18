# Telegram Mini App + Better Auth — step-by-step setup

Mini App sign-in runs **only on this Next.js app** (`/api/auth/*`). It does **not** use your Nest `NEXT_PUBLIC_API_URL` for authentication. Nest is used later for wallet/content with a JWT from Better Auth.

If you see **“Mini App sign-in failed” / “Telegram sync failed”**, work through the steps below in order.

---

## 1. Create or reuse a Telegram bot

1. Open [@BotFather](https://t.me/BotFather).
2. Send `/newbot` (or use an existing bot).
3. Copy the **bot token** → this is `TELEGRAM_BOT_TOKEN` (server-only, never expose in client code).
4. Note the bot **username** (e.g. `my_bot`) → this is `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (no `@`).

---

## 2. Link the Mini App to your site

1. In BotFather, choose your bot → **Bot Settings** → **Configure Mini App** (or **Menu Button** / **Mini App URL** depending on BotFather version).
2. Set the Mini App URL to your **HTTPS** frontend origin, e.g. `https://your-domain.com` or a path like `https://your-domain.com/` (must match how you open the app in Telegram).

Telegram will open that URL inside the Mini App; your `initData` is only sent when the page is loaded in Telegram’s WebView.

---

## 3. Domain and HTTPS

- Mini Apps require a **public HTTPS** URL (not plain `http://localhost` for real Telegram clients).
- For local development, use a tunnel (**ngrok**, **Cloudflare Tunnel**, etc.), put the **tunnel hostname** in BotFather where needed, and use that same origin in env vars below.

---

## 4. Environment variables (this Next.js repo)

Copy `.env.example` → `.env` and set at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL for Better Auth (sessions, users). |
| `BETTER_AUTH_SECRET` | Long random secret (e.g. `openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | Public origin of **this** app, no trailing slash (e.g. `https://your-domain.com`). Same as what users open in the browser. |
| `NEXT_PUBLIC_SITE_URL` | Usually same as `BETTER_AUTH_URL`. Used for Telegram Login Widget and URL fallbacks. |
| `TELEGRAM_BOT_TOKEN` | From BotFather (same bot as the Mini App). |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username **without** `@`. |
| `NEXT_PUBLIC_API_URL` | Nest API base URL (for `/auth/me`, shop, etc.) — **not** used for Better Auth sign-in. |

Restart `npm run dev` after any `.env` change.

---

## 5. Database migrations

Apply Better Auth tables/columns:

```bash
npm run migrate:auth
```

(or `npx @better-auth/cli migrate -y`)

---

## 6. Deploy / run the app

- The app must be reachable at the **exact** origin in `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL`.
- In production, set the same values on your host (Vercel, Railway, etc.).

---

## 7. What happens in the browser (Mini App)

1. The client reads the Telegram user id from `initData` (to see if the current cookie session already matches).
2. If a session cookie already matches the same Telegram user, that session is reused.
3. Otherwise `POST /api/auth/telegram/miniapp/signin` — the server verifies the `initData` hash and freshness; **first visit creates** the user; **later visits sign in**.

---

## 8. Checklist if sign-in still fails

| Check | Action |
|-------|--------|
| Wrong or missing bot token | `TELEGRAM_BOT_TOKEN` must match the bot that owns the Mini App. |
| Wrong bot username | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = username only, no `@`. |
| `BETTER_AUTH_URL` mismatch | Must equal the origin users use (scheme + host + port if non-default). |
| DB not migrated | Run `npm run migrate:auth`. |
| Opening outside Telegram | Mini App `initData` is empty or invalid — open the app **from Telegram** (not a normal browser tab). |
| CORS / cookies | Same site origin; `credentials: "include"` is already used. |
| Nest errors | `NEXT_PUBLIC_API_URL` issues affect **profile/wallet after** login, not the Mini App Better Auth step. |

---

## 9. Optional: JWT for Nest

After sign-in, the app stores a Better Auth JWT for `Authorization: Bearer` to Nest. Nest should validate JWKS from `{BETTER_AUTH_URL}/api/auth/jwks` — see [NEST_JWT.md](./NEST_JWT.md).
