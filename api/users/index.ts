import { apiClient, setStoredAuthToken } from "@/lib/api-client";
import type { TelegramUserExistsResponse, UserProfile } from "./types";

export type { TelegramUserExistsResponse, UserProfile } from "./types";

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

/** Telegram Mini App: verify `initData` with Better Auth (session cookie). */
export async function syncTelegramUser(initData: string): Promise<UserProfile> {
  const res = await fetch("/api/auth/telegram/sync-mini-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ initData }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      errorMessageFromResponse(
        data,
        res.status,
        "Telegram sync failed",
      ),
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
  const res = await fetch("/api/auth/telegram/sign-in-widget", {
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

/** Browser: Telegram Login Widget → register-only flow. */
export async function registerWithTelegramWidget(
  widgetFields: Record<string, string>,
): Promise<UserProfile> {
  const res = await fetch("/api/auth/telegram/register-widget", {
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

/** Whether a Telegram id already has a Better Auth account (for register UX). */
export async function fetchTelegramUserExists(body: {
  telegramId: string;
}): Promise<TelegramUserExistsResponse> {
  const res = await fetch("/api/auth/telegram/user-exists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as
    | TelegramUserExistsResponse
    | Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof (data as Record<string, unknown>)?.message === "string"
        ? String((data as Record<string, unknown>).message)
        : "Request failed",
    );
  }
  return data as TelegramUserExistsResponse;
}
