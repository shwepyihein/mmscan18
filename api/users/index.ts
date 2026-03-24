import { apiClient, setStoredAuthToken } from '@/lib/api-client';
import type { TelegramUserExistsResponse, UserProfile } from './types';

export type { TelegramUserExistsResponse, UserProfile } from './types';

function pickToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const t = p.accessToken ?? p.token ?? p.access_token ?? p.jwt;
  return typeof t === 'string' && t.length > 0 ? t : null;
}

function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  const raw =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  if (!raw) return null;
  const inner = raw.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return raw;
}

function normalizeProfile(payload: unknown): UserProfile | null {
  const p = unwrapPayload(payload);
  if (!p) return null;
  const user = (p.user ?? p.profile) as Record<string, unknown> | undefined;
  const src = user && typeof user === 'object' ? user : p;
  const id = src.id ?? src._id;
  if (id == null) return null;
  const telegramId = src.telegramId ?? src.telegram_id ?? src.telegramID ?? id;
  const coins = Number(src.coins ?? 0);
  const username =
    typeof src.username === 'string'
      ? src.username
      : typeof src.first_name === 'string'
        ? src.first_name
        : typeof src.firstName === 'string'
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

/** Telegram Mini App: sync `initData` (proxied — API key stays server-side). */
export async function syncTelegramUser(initData: string): Promise<UserProfile> {
  const res = await fetch('/api/auth/telegram-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ initData }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Telegram sync failed',
    );
  }
  const profile = applyAuthPayload(data);
  if (!profile) {
    throw new Error('Invalid profile response');
  }
  return profile;
}

/** Browser: Telegram Login Widget → `/auth/telegram-login`. */
export async function loginWithTelegramWidget(
  widgetFields: Record<string, string>,
): Promise<UserProfile> {
  const res = await fetch('/api/auth/telegram-browser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(widgetFields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Telegram login failed',
    );
  }
  const profile = applyAuthPayload(data);
  if (!profile) {
    throw new Error('Invalid profile response');
  }
  return profile;
}

/** Browser: Telegram Login Widget → `/auth/telegram-register`. */
export async function registerWithTelegramWidget(
  widgetFields: Record<string, string>,
): Promise<UserProfile> {
  const res = await fetch('/api/auth/telegram-browser-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(widgetFields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Telegram register failed',
    );
  }
  const profile = applyAuthPayload(data);
  if (!profile) {
    throw new Error('Invalid profile response');
  }
  return profile;
}

export async function fetchCurrentProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<unknown>(`/auth/me`);
  const profile = applyAuthPayload(data) ?? normalizeProfile(data);
  if (!profile) {
    throw new Error('Invalid profile');
  }
  return profile;
}

export function clearClientAuthSession(): void {
  setStoredAuthToken(null);
}

/**
 * Proxied `POST /auth/telegram-user-exists` with JSON `{ telegramId }`.
 */
export async function fetchTelegramUserExists(body: {
  telegramId: string;
}): Promise<TelegramUserExistsResponse> {
  const res = await fetch('/api/auth/telegram-user-exists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as
    | TelegramUserExistsResponse
    | Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof (data as Record<string, unknown>)?.error === 'string'
        ? String((data as Record<string, unknown>).error)
        : 'Request failed',
    );
  }
  return data as TelegramUserExistsResponse;
}
