# Nest JWT (API auth)

This frontend talks to **Nest** at `NEXT_PUBLIC_API_URL`. After Telegram or email login, the browser stores the **access token** Nest returns (`localStorage`, key managed in `lib/api-client.ts`) and sends it as `Authorization: Bearer <token>` on API requests.

There is **no** Better Auth or `/api/auth/jwks` on this Next.js app.

**On the Nest side:** validate Bearer tokens using whatever scheme your API already uses (HS256 secret, RS256 JWKS, etc.). The frontend does not embed Nest’s signing keys; configure verification only in your API service.
