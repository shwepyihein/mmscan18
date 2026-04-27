# Telegram Mini App — setup (Nest auth)

Mini App and browser Telegram login **exchange `initData` / widget payload with your Nest API** (`NEXT_PUBLIC_API_URL`). This Next.js app only hosts the UI and stores the Nest access token for later calls.

If you see **“Mini App sign-in failed” / “Sync failed”**, work through the steps below.

---

## 1. Create or reuse a Telegram bot

1. Open [@BotFather](https://t.me/BotFather).
2. Send `/newbot` (or use an existing bot).
3. Copy the **bot token** — Nest must use the **same** token to verify `initData` / widget signatures.
4. Bot **username** (e.g. `my_bot`) → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (no `@`).

---

## 2. Link the Mini App to your site

1. In BotFather: your bot → **Bot Settings** → **Configure Mini App** (or **Menu Button** / **Mini App URL**).
2. Set the Mini App URL to your **HTTPS** frontend (this Next app), e.g. `https://your-domain.com/`.

Telegram loads that URL in a WebView and provides `Telegram.WebApp.initData` when appropriate.

---

## 3. Domain and HTTPS

- Real devices need **public HTTPS** (not plain `http://localhost`).
- For local dev, use a tunnel (ngrok, Cloudflare Tunnel, etc.), register that host with the bot where required, and set `NEXT_PUBLIC_SITE_URL` to the same origin.

---

## 4. Environment variables (this repo)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Origin users open in the browser; Telegram Login Widget / redirects. |
| `NEXT_PUBLIC_API_URL` | Nest base URL — **auth** (`ensureNestTelegramSession`, `/auth/me`, wallet, reader) must work here. |
| `NEXT_PUBLIC_API_GLOBAL_PREFIX` | Optional (e.g. `api`) if Nest uses `setGlobalPrefix('api')`. |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username without `@`. |
| `TELEGRAM_BOT_TOKEN` | Only if any **server-side** code in this repo needs it (most verification happens on Nest). |

Restart `npm run dev` after `.env` changes.

---

## 5. What happens in the Mini App

1. `AuthProvider` waits for `Telegram.WebApp` and `initData`.
2. It calls **`ensureNestTelegramSession(initData)`** (see `api/users`) — your Nest endpoint must validate `initData` and return tokens.
3. The client stores the Nest access token and loads profile / unlocked chapters.

---

## 6. If sign-in still fails

| Check | Action |
|-------|--------|
| Wrong bot / token on Nest | Token must match the Mini App bot. |
| Wrong username | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` without `@`. |
| `NEXT_PUBLIC_API_URL` wrong | Auth requests go here; fix URL / prefix / CORS. |
| Opening outside Telegram | `initData` empty — open from Telegram’s Mini App entry. |
| initData expired | Close and reopen the Mini App. |

---

## 7. JWT notes

See [NEST_JWT.md](./NEST_JWT.md) — Nest issues and verifies API tokens; this app only forwards `Authorization: Bearer`.
