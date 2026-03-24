import { apiClient, setStoredAuthToken } from "@/lib/api-client";
import type { UserProfile } from "./types";

export type { UserProfile } from "./types";

function pickToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const t = p.accessToken ?? p.token ?? p.access_token ?? p.jwt;
  return typeof t === "string" && t.length > 0 ? t : null;
}

function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  if (!raw) return null;
  const inner = raw.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return raw;
}

function normalizeProfile(payload: unknown): UserProfile | null {
  const p = unwrapPayload(payload);
  if (!p) return null;
  const user = (p.user ?? p.profile) as Record<string, unknown> | undefined;
  const src = user && typeof user === "object" ? user : p;
  const id = src.id ?? src._id;
  if (id == null) return null;
  const telegramId = src.telegramId ?? src.telegram_id ?? src.telegramID ?? id;
  const coins = Number(src.coins ?? 0);
  const username =
    typeof src.username === "string"
      ? src.username
      : typeof src.first_name === "string"
        ? src.first_name
        : typeof src.firstName === "string"
          ? src.firstName
          : undefined;
  return {
    id: String(id),
    telegramId: String(telegramId),
    username,
    coins: Number.isFinite(coins) ? coins : 0,
  };
}

function applyAuthPayload(payload: unknown): UserProfile | null {
  const inner = unwrapPayload(payload);
  const token = pickToken(payload) ?? (inner ? pickToken(inner) : null);
  if (token) setStoredAuthToken(token);
  return normalizeProfile(payload);
}

function errorMessageFromResponse(
  data: Record<string, unknown>,
  status: number,
  fallback: string,
): string {
  const nestMsg = data.message;
  if (typeof nestMsg === "string" && nestMsg.length > 0) return nestMsg;
  const err = data.error;
  if (typeof err === "string" && err.length > 0) return err;
  if (status === 404) {
    return `${fallback}: backend returned 404. Confirm NEXT_PUBLIC_API_URL and that GET /auth/me exists.`;
  }
  if (status === 502) {
    return `${fallback}: could not reach the API (502). Check NEXT_PUBLIC_API_URL and that the server is running.`;
  }
  return fallback;
}

/** Unwrap Better Auth / better-call JSON (`{ data: T }` or `T`). */
function unwrapAuthJson<T extends Record<string, unknown>>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const inner = o.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as T;
  }
  return o as T;
}

type MiniAppValidateShape = {
  valid?: boolean;
  data?: { user?: { id?: number } } | null;
};

function parseMiniAppValidate(body: unknown): MiniAppValidateShape | null {
  const a = unwrapAuthJson<Record<string, unknown>>(body);
  if (!a) return null;
  if (typeof a.valid === "boolean" && "data" in a) {
    return a as MiniAppValidateShape;
  }
  const nested = unwrapAuthJson<Record<string, unknown>>(a);
  if (nested && typeof nested.valid === "boolean") {
    return nested as MiniAppValidateShape;
  }
  return null;
}

async function fetchBetterAuthSessionUser(): Promise<Record<string, unknown> | null> {
  const res = await fetch("/api/auth/get-session", { credentials: "include" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const root = unwrapAuthJson<Record<string, unknown>>(body) ?? body;
  const user = root.user;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    return user as Record<string, unknown>;
  }
  return null;
}

/**
 * Telegram Mini App:
 * 1. Validate `initData` (signature / freshness).
 * 2. If a Better Auth session already matches this Telegram user, reuse it (login path).
 * 3. Otherwise `POST /telegram/miniapp/signin` — creates the user on first visit or signs in (register vs login is server-side).
 */
export async function syncTelegramUser(initData: string): Promise<UserProfile> {
  const validateRes = await fetch("/api/auth/telegram/miniapp/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ initData }),
  });
  const validateBody = (await validateRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!validateRes.ok) {
    throw new Error(
      errorMessageFromResponse(
        validateBody,
        validateRes.status,
        "Mini App initData validation failed",
      ),
    );
  }

  const parsed = parseMiniAppValidate(validateBody);
  const tgUserId = parsed?.data?.user?.id;
  if (parsed?.valid !== true || tgUserId == null) {
    throw new Error("Invalid or expired Telegram Mini App initData");
  }
  const telegramId = String(tgUserId);

  const sessionUser = await fetchBetterAuthSessionUser();
  const sessionTg =
    sessionUser?.telegramId != null
      ? String(sessionUser.telegramId)
      : sessionUser?.telegram_id != null
        ? String(sessionUser.telegram_id)
        : null;
  if (sessionTg === telegramId) {
    const profile = normalizeProfile({ user: sessionUser });
    if (profile) {
      return profile;
    }
  }

  const signinRes = await fetch("/api/auth/telegram/miniapp/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ initData }),
  });
  const data = (await signinRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!signinRes.ok) {
    throw new Error(
      errorMessageFromResponse(data, signinRes.status, "Telegram Mini App sign-in failed"),
    );
  }
  const profile = normalizeProfile(data);
  if (!profile) {
    throw new Error("Invalid profile response");
  }
  return profile;
}

/** Browser: Telegram Login Widget → Better Auth (also used from `/auth/telegram-callback`). */
export async function loginWithTelegramWidget(
  widgetFields: Record<string, string>,
): Promise<UserProfile> {
  const res = await fetch("/api/auth/telegram/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(widgetFields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Telegram login failed",
    );
  }
  const profile = normalizeProfile(data);
  if (!profile) {
    throw new Error("Invalid profile response");
  }
  return profile;
}

/** Browser: same as `loginWithTelegramWidget` (`better-auth-telegram` auto-creates users). */
export async function registerWithTelegramWidget(
  widgetFields: Record<string, string>,
): Promise<UserProfile> {
  const res = await fetch("/api/auth/telegram/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(widgetFields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Telegram register failed",
    );
  }
  const profile = normalizeProfile(data);
  if (!profile) {
    throw new Error("Invalid profile response");
  }
  return profile;
}

/** Nest (or other backend) profile; sends Better Auth JWT from `apiClient`. */
export async function fetchCurrentProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<unknown>(`/auth/me`);
  const profile = applyAuthPayload(data) ?? normalizeProfile(data);
  if (!profile) {
    throw new Error("Invalid profile");
  }
  return profile;
}

export function clearClientAuthSession(): void {
  setStoredAuthToken(null);
}
