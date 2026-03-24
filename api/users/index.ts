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

/**
 * Read Telegram user id from raw `initData` (same shape Telegram sends in Mini Apps).
 * Used only to compare with the current Better Auth session before calling sign-in.
 * Cryptographic verification still happens on `POST .../miniapp/signin`.
 */
export function parseTelegramUserIdFromInitData(initData: string): string | null {
  const raw = initData.trim();
  if (!raw) return null;
  try {
    const params = new URLSearchParams(raw);
    const userJson = params.get("user");
    if (!userJson) return null;
    const u = JSON.parse(userJson) as { id?: number };
    return u.id != null ? String(u.id) : null;
  } catch {
    return null;
  }
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
 * 1. Parse `user.id` from `initData` (for session short-circuit only).
 * 2. If a Better Auth session already matches this Telegram user, reuse it.
 * 3. Otherwise `POST /telegram/miniapp/signin` — server verifies HMAC + freshness; creates user or signs in.
 *
 * We do not rely on `POST .../validate` here: Better Auth may wrap that JSON, which broke parsing and
 * produced false "Invalid or expired initData" errors even when sign-in would succeed.
 */
export async function syncTelegramUser(initData: string): Promise<UserProfile> {
  const trimmed = initData.trim();
  if (!trimmed) {
    throw new Error(
      "Missing Telegram Mini App initData. Open this app from Telegram (not a normal browser tab).",
    );
  }

  const telegramId = parseTelegramUserIdFromInitData(trimmed);
  if (!telegramId) {
    throw new Error(
      "Could not read Telegram user from initData. Open the Mini App inside Telegram.",
    );
  }

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
