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
