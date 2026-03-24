# Nest.js: validating Better Auth JWTs

Sessions for end users are issued by **Better Auth** on this Next.js app. The browser stores an **httpOnly session cookie** for `/api/auth/*`. For calls from the browser to **Nest** (manhwa, shop, `GET /auth/me`), the frontend attaches a **JWT** from Better Auth’s JWT plugin (`Authorization: Bearer <jwt>`).

## What Nest should do

1. **Fetch JWKS** from the Next app (cache aggressively; rotate when `kid` changes):

   `GET {BETTER_AUTH_URL}/api/auth/jwks`

2. **Verify** the JWT with a JWKS-aware verifier (for example [`jose`](https://github.com/panva/jose)):

   - Resolve keys from the URL above (or embed cached JWKS).
   - **`iss`** and **`aud`** default to `BETTER_AUTH_URL` (the public origin of the Next app, no trailing slash). Match your deployed `BETTER_AUTH_URL` / `NEXT_PUBLIC_SITE_URL`.
   - **`sub`** is the Better Auth user id (string). Map it to your Nest user if you keep a separate table, or trust `telegramId` in the payload if you added it via `definePayload` in `lib/auth.ts`.

3. **Reject** requests without a valid Bearer token on protected routes.

## Example (Node, `jose`)

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`),
);

export async function verifyBetterAuthJwt(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: process.env.BETTER_AUTH_URL,
    audience: process.env.BETTER_AUTH_URL,
  });
  return payload;
}
```

Set `BETTER_AUTH_URL` in Nest to the **same** public origin the browser uses for the Next app (e.g. `https://app.example.com`).

## Alternative: BFF only

If you prefer Nest **not** to verify end-user JWTs, keep sensitive operations behind a **server-to-server** route on Next that calls Nest with a **service key**. That pattern is heavier but avoids exposing JWKS validation in Nest.
