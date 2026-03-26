import axios from 'axios';
import {
  apiClient,
  applyNestAuthResponseDto,
  refreshBackendSession,
  setStoredAuthToken,
  setStoredRefreshToken,
} from '@/lib/api-client';
import type { NestTelegramAuthBody, UserProfile } from './types';

export type { NestTelegramAuthBody, UserProfile } from './types';

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

function readStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function nestTelegramBodyFromLooseObject(
  o: Record<string, unknown>,
): NestTelegramAuthBody | null {
  const idRaw = o.id ?? o.telegramId;
  if (idRaw == null || idRaw === '') return null;
  const telegramId = String(idRaw);
  const firstName = readStr(o, 'first_name', 'firstName') ?? 'User';
  const lastName = readStr(o, 'last_name', 'lastName') ?? '';
  const usernameRaw = readStr(o, 'username');
  const username =
    usernameRaw && usernameRaw.length > 0 ? usernameRaw : `user_${telegramId}`;
  return { telegramId, username, firstName, lastName };
}

/** Parse Mini App `Telegram.WebApp.initData` (URL-encoded `user` JSON). */
function nestTelegramBodyFromInitData(initData: string): NestTelegramAuthBody | null {
  const trimmed = initData?.trim() ?? '';
  if (!trimmed) return null;
  try {
    const params = new URLSearchParams(trimmed);
    const userJson = params.get('user');
    if (!userJson) return null;
    const u = JSON.parse(userJson) as Record<string, unknown>;
    return nestTelegramBodyFromLooseObject(u);
  } catch {
    return null;
  }
}

/**
 * Build Nest telegram auth body from Mini App `initData` string or Login Widget / callback fields.
 */
export function nestTelegramBodyFromSource(
  source: string | object,
): NestTelegramAuthBody | null {
  if (typeof source === 'string') {
    return nestTelegramBodyFromInitData(source);
  }
  return nestTelegramBodyFromLooseObject(source as Record<string, unknown>);
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
  const email = typeof src.email === 'string' ? src.email : undefined;
  const name = typeof src.name === 'string' ? src.name : undefined;
  const role = typeof src.role === 'string' ? src.role : undefined;
  const level = typeof src.level === 'string' ? src.level : undefined;
  return {
    id: String(id),
    telegramId: String(telegramId),
    username,
    email,
    name,
    role,
    level,
    coins: Number.isFinite(coins) ? coins : 0,
  };
}

function nestResponseMeansUserNotRegistered(
  status: number | undefined,
  body: unknown,
): boolean {
  if (status === 404) return true;
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  const code = o.code ?? o.error;
  if (code === 'USER_NOT_FOUND' || code === 'NOT_REGISTERED') return true;
  const msg = String(o.message ?? '').toLowerCase();
  if (msg.includes('not registered') || msg.includes('user not found'))
    return true;
  return false;
}

function nestResponseMeansUserAlreadyExists(
  status: number | undefined,
  body: unknown,
): boolean {
  if (status === 409) return true;
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  const code = o.code ?? o.error;
  if (
    code === 'USER_EXISTS' ||
    code === 'ALREADY_EXISTS' ||
    code === 'DUPLICATE'
  )
    return true;
  const msg = String(o.message ?? '').toLowerCase();
  if (msg.includes('already exists') || msg.includes('already registered'))
    return true;
  return false;
}

export type NestTelegramSyncResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_registered' | 'sync_failed' };

export type NestTelegramRegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'already_exists' | 'register_failed' };

export type NestTelegramExistsResult =
  | { ok: true; exists: boolean; userId?: string }
  | { ok: false };

/** `POST /auth/telegram-user-exists` */
export async function checkNestTelegramUserExists(
  telegramId: string,
): Promise<NestTelegramExistsResult> {
  try {
    const { data } = await apiClient.post<unknown>(
      '/auth/telegram-user-exists',
      { telegramId },
    );
    const inner = unwrapPayload(data);
    const o = (inner ?? data) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return { ok: false };
    return {
      ok: true,
      exists: Boolean(o.exists),
      userId: typeof o.userId === 'string' ? o.userId : undefined,
    };
  } catch {
    return { ok: false };
  }
}

/** `POST /auth/telegram-login` — Nest `AuthResponseDto`. */
export async function syncNestTelegramLogin(
  body: NestTelegramAuthBody,
): Promise<NestTelegramSyncResult> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/telegram-login', body);
    applyNestAuthResponseDto(data);
    const token = pickToken(unwrapPayload(data) ?? data);
    if (token) {
      return { ok: true, token };
    }
    return { ok: false, reason: 'sync_failed' };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const rspBody = error.response.data;
      if (nestResponseMeansUserNotRegistered(status, rspBody)) {
        return { ok: false, reason: 'not_registered' };
      }
    }
    console.error('NestJS Telegram login failed:', error);
    return { ok: false, reason: 'sync_failed' };
  }
}

/** `POST /auth/telegram-register` — Nest `AuthResponseDto`. */
export async function registerNestTelegram(
  body: NestTelegramAuthBody,
): Promise<NestTelegramRegisterResult> {
  try {
    const { data } = await apiClient.post<unknown>(
      '/auth/telegram-register',
      body,
    );
    applyNestAuthResponseDto(data);
    const token = pickToken(unwrapPayload(data) ?? data);
    if (token) {
      return { ok: true, token };
    }
    return { ok: false, reason: 'register_failed' };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const rspBody = error.response.data;
      if (nestResponseMeansUserAlreadyExists(status, rspBody)) {
        return { ok: false, reason: 'already_exists' };
      }
    }
    console.error('NestJS Telegram register failed:', error);
    return { ok: false, reason: 'register_failed' };
  }
}

/**
 * Resolve Mini App / widget payload → `POST /auth/telegram-user-exists` → login or register.
 */
export async function ensureNestTelegramSession(
  initDataOrFields: string | object,
): Promise<NestTelegramSyncResult> {
  const body = nestTelegramBodyFromSource(initDataOrFields);
  if (!body) {
    return { ok: false, reason: 'sync_failed' };
  }

  const existsRes = await checkNestTelegramUserExists(body.telegramId);
  if (!existsRes.ok) {
    return { ok: false, reason: 'sync_failed' };
  }

  if (existsRes.exists) {
    return syncNestTelegramLogin(body);
  }

  const reg = await registerNestTelegram(body);
  if (reg.ok) {
    return { ok: true, token: reg.token };
  }
  if (reg.reason === 'already_exists') {
    return syncNestTelegramLogin(body);
  }
  return { ok: false, reason: 'sync_failed' };
}

/** `POST /auth/login` */
export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<NestTelegramSyncResult> {
  try {
    const { data } = await apiClient.post<unknown>('/auth/login', {
      email,
      password,
    });
    applyNestAuthResponseDto(data);
    const token = pickToken(unwrapPayload(data) ?? data);
    if (token) return { ok: true, token };
    return { ok: false, reason: 'sync_failed' };
  } catch (error) {
    console.error('NestJS login failed:', error);
    return { ok: false, reason: 'sync_failed' };
  }
}

/** `POST /auth/refresh` — uses stored refresh token (also used by apiClient 401 retry). */
export async function refreshNestAuth(): Promise<boolean> {
  return refreshBackendSession();
}

/** `GET /auth/me` (Bearer accessToken). */
export async function fetchCurrentProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<unknown>(`/auth/me`);
  const profile = normalizeProfile(data);
  if (!profile) {
    throw new Error('Invalid profile');
  }
  return profile;
}

export interface UserTransaction {
  id: string;
  type: 'TOPUP' | 'UNLOCK';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  description?: string;
}

/**
 * GET /users/transactions — Transaction history for current user.
 * (Adjusted to match your NestJS controller structure).
 */
export async function getUserTransactions(): Promise<UserTransaction[]> {
  try {
    const { data } = await apiClient.get<unknown>('/users/transactions');
    const inner = unwrapPayload(data);
    const list = Array.isArray(inner) ? inner : Array.isArray(data) ? data : [];
    return list.map((item: any) => ({
      id: String(item.id ?? item._id),
      type: item.type,
      amount: Number(item.amount),
      status: item.status,
      createdAt: item.createdAt ?? item.created_at,
      description: item.description,
    }));
  } catch {
    return [];
  }
}

export function clearClientAuthSession(): void {
  setStoredAuthToken(null);
  setStoredRefreshToken(null);
}
